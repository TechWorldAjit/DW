import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI || '';
if (!uri) {
  console.warn('⚠️ Warning: MONGO_URI is not set in environment variables');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    throw new Error('MONGO_URI is missing from environment variables');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  const db = client.db('company_career_directory');

  cachedClient = client;
  cachedDb = db;

  // Initialize essential indexes asynchronously
  initIndexes(db).catch((err) => console.error('Error creating indexes:', err));

  return { client, db };
}

let indexesCreated = false;
async function initIndexes(db: Db) {
  if (indexesCreated) return;
  try {
    // Users collection indexes
    await db.collection('users').createIndex(
      { normalizedUsername: 1 },
      { unique: true, background: true }
    );

    // Companies collection indexes
    await db.collection('companies').createIndex(
      { userId: 1, normalizedName: 1 },
      { unique: true, background: true }
    );
    await db.collection('companies').createIndex(
      { userId: 1, isPinned: -1, createdAt: -1 },
      { background: true }
    );
    await db.collection('companies').createIndex(
      { userId: 1, isFavorite: 1 },
      { background: true }
    );
    await db.collection('companies').createIndex(
      { userId: 1, categories: 1 },
      { background: true }
    );

    // Canonical companies cache index
    await db.collection('canonical_companies').createIndex(
      { normalizedName: 1 },
      { unique: true, background: true }
    );

    // Settings collection index
    await db.collection('settings').createIndex(
      { key: 1 },
      { unique: true, background: true }
    );

    indexesCreated = true;
    console.log('✅ MongoDB indexes ensured successfully');
  } catch (err: any) {
    console.error('Failed to create indexes:', err.message);
  }
}
