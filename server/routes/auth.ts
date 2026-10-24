import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../db';
import { UserDoc, SettingDoc, AuthTokenPayload } from '../types';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123';

function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// Check public registration status
router.get('/registration-status', async (_req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection<UserDoc>('users').countDocuments();
    // If no users exist yet, first registration is always allowed (first user becomes admin)
    if (count === 0) {
      res.json({ registrationEnabled: true, isInitialSetup: true });
      return;
    }

    const setting = await db.collection<SettingDoc>('settings').findOne({ key: 'registration_enabled' });
    const enabled = setting ? Boolean(setting.value) : true;
    res.json({ registrationEnabled: enabled, isInitialSetup: false });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

// User Registration
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters long' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' });
      return;
    }

    const { db } = await connectToDatabase();
    const normalizedUsername = trimmedUsername.toLowerCase();

    // Check if registration is enabled
    const totalUsers = await db.collection<UserDoc>('users').countDocuments();
    if (totalUsers > 0) {
      const setting = await db.collection<SettingDoc>('settings').findOne({ key: 'registration_enabled' });
      const enabled = setting ? Boolean(setting.value) : true;
      if (!enabled) {
        res.status(403).json({
          error: 'Public registration is currently disabled by the administrator.',
        });
        return;
      }
    }

    // Check for existing username (case-insensitive)
    const existing = await db.collection<UserDoc>('users').findOne({ normalizedUsername });
    if (existing) {
      res.status(400).json({ error: 'Username is already taken' });
      return;
    }

    // First user is automatically granted 'admin' role
    const role = totalUsers === 0 ? 'admin' : 'user';

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser: UserDoc = {
      username: trimmedUsername,
      normalizedUsername,
      passwordHash,
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection<UserDoc>('users').insertOne(newUser);
    const userId = insertResult.insertedId.toString();

    // If first user, ensure default settings exist
    if (totalUsers === 0) {
      await db.collection<SettingDoc>('settings').updateOne(
        { key: 'registration_enabled' },
        { $set: { value: true, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    const token = generateToken({
      userId,
      username: trimmedUsername,
      role,
    });

    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: userId,
        username: trimmedUsername,
        role,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// User Login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { db } = await connectToDatabase();
    const normalizedUsername = username.trim().toLowerCase();

    const user = await db.collection<UserDoc>('users').findOne({ normalizedUsername });
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({ error: 'Account has been disabled. Please contact the administrator.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = generateToken({
      userId: user._id!.toString(),
      username: user.username,
      role: user.role,
    });

    setAuthCookie(res, token);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id!.toString(),
        username: user.username,
        role: user.role,
        isTempPassword: Boolean(user.isTempPassword),
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
});

// Get Current User Profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
