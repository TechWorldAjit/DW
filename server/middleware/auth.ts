import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db';
import { AuthTokenPayload, UserDoc } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;

    // Verify user is still active in DB
    const { db } = await connectToDatabase();
    const user = await db.collection<UserDoc>('users').findOne({
      _id: new ObjectId(payload.userId),
    });

    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({ error: 'Account has been disabled. Please contact the administrator.' });
      return;
    }

    // Attach up-to-date role and info
    req.user = {
      userId: user._id!.toString(),
      username: user.username,
      role: user.role,
    };

    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
}
