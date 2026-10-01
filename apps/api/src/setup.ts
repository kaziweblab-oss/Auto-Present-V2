import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { isDbConfigured, readDbUri, saveDbUri, connectDb } from './db-config.js';
import { audit } from './models.js';
import { requireAuth, requirePermission } from './rbac.js';

export const setupRouter = Router();

const uriSchema = z.object({ uri: z.string().min(10).max(2000) });

// Public status: tells the Super Admin dashboard whether first-time setup is needed.
setupRouter.get('/status', (_req, res) => {
  res.json({ success: true, data: { dbConfigured: isDbConfigured() } });
});

// First-time setup: open ONLY while no DB is configured yet.
// After that, rotating the URI requires SUPER_ADMIN.
setupRouter.post('/database', async (req: Request, res) => {
  const parsed = uriSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } });

  if (isDbConfigured()) {
    const id = req.header('x-demo-user-id');
    const roles = (req.header('x-demo-user-roles') ?? '').split(',');
    if (!id || !roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
  }

  try {
    await connectDb(parsed.data.uri);
  } catch {
    return res.status(400).json({ success: false, error: { code: 'DB_CONNECT_FAILED' } });
  }
  saveDbUri(parsed.data.uri);
  try {
    await audit({ actorUserId: req.header('x-demo-user-id') ?? 'setup', role: 'SUPER_ADMIN', action: 'db.configure', entity: 'Database' });
  } catch { /* audit needs the same DB; connection was just verified above */ }
  res.json({ success: true, data: { dbConfigured: true } });
});

// Current connection (masked, SUPER_ADMIN only) for the dashboard.
setupRouter.get('/database', requireAuth, requirePermission('audit.read'), (_req, res) => {
  res.json({ success: true, data: { dbConfigured: isDbConfigured(), current: currentDbMasked() } });
});

function currentDbMasked(): string | null {
  const uri = readDbUri();
  if (!uri) return null;
  // Never leak credentials: show only host/db part.
  const m = uri.match(/@([^/]+)\/(.+?)(\?|$)/);
  return m ? `${m[1]}/${m[2]}` : '(custom uri)';
}
