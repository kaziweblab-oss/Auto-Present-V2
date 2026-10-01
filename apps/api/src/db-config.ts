import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

// MongoDB URI is NEVER in env. Super Admin provides it once via
// POST /api/v1/setup/database (dashboard); stored in data/mongo.json (git-ignored).
const CONFIG_FILE = process.env.DB_CONFIG_FILE ?? path.join(process.cwd(), 'data', 'mongo.json');

export function isDbConfigured(): boolean {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { uri?: string };
    return typeof parsed.uri === 'string' && parsed.uri.length > 0;
  } catch {
    return false;
  }
}

export function readDbUri(): string | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { uri?: string };
    return parsed.uri ?? null;
  } catch {
    return null;
  }
}

export function saveDbUri(uri: string): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ uri }), { mode: 0o600 });
}

export async function connectDb(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  await mongoose.connect(uri);
}
