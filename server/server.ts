import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectToDatabase } from './db';

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await connectToDatabase();
    console.log('✅ Connected to MongoDB Atlas');

    app.listen(PORT, () => {
      console.log(`🚀 Company Career Directory API running on http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
