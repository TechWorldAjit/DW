import app from '../server/app';
import { connectToDatabase } from '../server/db';
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    await connectToDatabase();
  } catch (err: any) {
    console.error('Database connection error in Vercel serverless handler:', err);
  }
  return app(req, res);
}
