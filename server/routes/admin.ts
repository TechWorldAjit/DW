import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db';
import { UserDoc, SettingDoc, CompanyDoc } from '../types';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Strictly protect all admin routes
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/settings
 * Get current system settings
 */
router.get('/settings', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { db } = await connectToDatabase();
    const setting = await db.collection<SettingDoc>('settings').findOne({ key: 'registration_enabled' });
    const registrationEnabled = setting !== null ? Boolean(setting.value) : true;

    res.json({ registrationEnabled });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * POST /api/admin/settings
 * Update system settings (e.g. toggle public registration)
 */
router.post('/settings', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { registrationEnabled } = req.body;
    if (typeof registrationEnabled !== 'boolean') {
      res.status(400).json({ error: 'registrationEnabled must be a boolean' });
      return;
    }

    const { db } = await connectToDatabase();
    await db.collection<SettingDoc>('settings').updateOne(
      { key: 'registration_enabled' },
      { $set: { value: registrationEnabled, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({
      message: `Public registration has been ${registrationEnabled ? 'enabled' : 'disabled'}`,
      registrationEnabled,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/admin/users
 * View all student and user accounts with status and company count
 */
router.get('/users', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { db } = await connectToDatabase();

    // Fetch users (excluding password hashes)
    const users = await db
      .collection<UserDoc>('users')
      .find({})
      .sort({ createdAt: -1 })
      .project({ passwordHash: 0 })
      .toArray();

    // Aggregate company counts per user
    const companyCounts = await db
      .collection<CompanyDoc>('companies')
      .aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = new Map<string, number>();
    for (const item of companyCounts) {
      if (item._id) {
        countMap.set(item._id.toString(), item.count);
      }
    }

    const enrichedUsers = users.map((u) => ({
      id: u._id!.toString(),
      username: u.username,
      role: u.role,
      isActive: u.isActive !== false,
      isTempPassword: Boolean(u.isTempPassword),
      companyCount: countMap.get(u._id!.toString()) || 0,
      createdAt: u.createdAt,
    }));

    res.json({ users: enrichedUsers });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/users
 * Administrator creates a student account with username and temporary password
 */
router.post('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

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

    const normalizedUsername = trimmedUsername.toLowerCase();
    const { db } = await connectToDatabase();

    const existing = await db.collection<UserDoc>('users').findOne({ normalizedUsername });
    if (existing) {
      res.status(400).json({ error: 'Username is already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser: UserDoc = {
      username: trimmedUsername,
      normalizedUsername,
      passwordHash,
      role: 'student',
      isActive: true,
      isTempPassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection<UserDoc>('users').insertOne(newUser);

    res.status(201).json({
      message: 'Student account created successfully',
      user: {
        id: result.insertedId.toString(),
        username: trimmedUsername,
        role: 'student',
        tempPassword: password,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create student account' });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Enable or disable a user or student account
 */
router.patch('/users/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isActive } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive boolean is required' });
      return;
    }

    // Prevent admin from disabling themselves
    if (id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot disable your own administrator account' });
      return;
    }

    const { db } = await connectToDatabase();
    const result = await db.collection<UserDoc>('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: `User account has been ${isActive ? 'enabled' : 'disabled'}`,
      isActive,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

/**
 * PATCH /api/admin/users/:id/reset-password
 * Set a new temporary password for a student account
 */
router.patch('/users/:id/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { newPassword } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { db } = await connectToDatabase();
    const result = await db.collection<UserDoc>('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { passwordHash, isTempPassword: true, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'Temporary password set successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
