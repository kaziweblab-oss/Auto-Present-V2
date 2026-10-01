import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { superAdminRouter } from './super-admin.js';
import { setupRouter } from './setup.js';
import { principalRouter } from './principal.js';
import { isDbConfigured, readDbUri, connectDb } from './db-config.js';
import { User } from './models.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health/live', (_req, res) => res.json({ success: true, data: { status: 'alive' } }));
app.get('/api/v1/health/ready', (_req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ success: ok, data: { mongodb: ok ? 'connected' : 'disconnected' } });
});
app.use('/api/v1/setup', setupRouter);
app.use('/api/v1/super-admin', superAdminRouter);
app.use('/api/v1/principal', principalRouter);

// Single-service deploy: serve the built website from the same process.
// Resolved from the compiled server file location, NOT process.cwd().
const serverDir = path.dirname(fileURLToPath(import.meta.url)); // apps/api/dist
const webDist = [
  path.resolve(serverDir, '../../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
].find((p) => fs.existsSync(path.join(p, 'index.html')));
if (webDist) {
  console.log(`Serving website from ${webDist}`);
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  console.warn('Website dist not found, running API-only mode');
}

const PORT = Number(process.env.PORT ?? 4000);

async function seedSuperAdmin() {
  // Super Admin is seeded LATER via env when owner is ready. No hard-coded email in logic.
  const email = (process.env.INITIAL_SUPER_ADMIN_EMAIL ?? '').toLowerCase();
  if (!email) return;
  const existing = await User.findOne({ email }).lean();
  if (existing) return;
  await User.create({ googleSubject: `seed:${email}`, email, displayName: 'Super Admin', roles: ['SUPER_ADMIN'] });
  console.log(`Seeded SUPER_ADMIN ${email}`);
}

async function main() {
  // MongoDB URI is NEVER in env. Super Admin provides it once via
  // POST /api/v1/setup/database (dashboard); stored in data/mongo.json (git-ignored).
  if (isDbConfigured()) {
    try {
      await connectDb(readDbUri()!);
      console.log('MongoDB connected');
      await seedSuperAdmin();
    } catch (err) {
      console.warn('MongoDB unavailable, starting degraded:', (err as Error).message);
    }
  } else {
    console.log('No database configured yet. Open the Super Admin dashboard to set it up (SETUP_NEEDED).');
  }
  app.listen(PORT, () => console.log(`API on :${PORT}`));
}

main();
export default app;
