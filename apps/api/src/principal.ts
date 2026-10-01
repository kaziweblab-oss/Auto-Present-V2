import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { AcademicSession, User, AuditLog, audit } from './models.js';
import { canTransition } from './session-flow.js';
import { dbOk } from './db-guard.js';
import { requireAuth, requirePermission, type AuthedRequest } from './rbac.js';

export const principalRouter = Router();
principalRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(4).max(20),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

// Institute overview for the Principal dashboard.
principalRouter.get('/overview', requirePermission('session.read'), async (_req, res) => {
  if (!dbOk(res)) return;
  const [sessions, users, audits] = await Promise.all([
    AcademicSession.find().lean(),
    User.aggregate([{ $unwind: '$roles' }, { $group: { _id: '$roles', n: { $sum: 1 } } }]),
    AuditLog.countDocuments(),
  ]);
  res.json({ success: true, data: { sessions, usersByRole: users, auditCount: audits } });
});

principalRouter.get('/sessions', requirePermission('session.read'), async (_req, res) => {
  if (!dbOk(res)) return;
  const sessions = await AcademicSession.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: sessions });
});

principalRouter.post('/sessions', requirePermission('session.create'), async (req: AuthedRequest, res) => {
  if (!dbOk(res)) return;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } });
  try {
    const s = await AcademicSession.create({
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      dbKey: `primary:${parsed.data.name}`,
    });
    await audit({ actorUserId: req.user!.id, role: 'PRINCIPAL', action: 'session.create', entity: 'Session', entityId: String(s._id), after: { name: s.name } });
    res.status(201).json({ success: true, data: s });
  } catch {
    res.status(409).json({ success: false, error: { code: 'SESSION_EXISTS' } });
  }
});

async function transition(req: AuthedRequest, res: Response, id: string, to: 'ACTIVE' | 'CLOSED' | 'ARCHIVED') {
  if (!dbOk(res)) return;
  const s = await AcademicSession.findById(id);
  if (!s) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND' } });
  if (!canTransition(s.state as 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED', to)) {
    return res.status(409).json({ success: false, error: { code: 'INVALID_TRANSITION', from: s.state } });
  }
  if (to === 'ACTIVE') {
    await AcademicSession.updateMany({ state: 'ACTIVE' }, { $set: { state: 'CLOSED' } });
  }
  const before = s.state;
  s.state = to;
  await s.save();
  await audit({ actorUserId: req.user!.id, role: 'PRINCIPAL', action: `session.${to.toLowerCase()}`, entity: 'Session', entityId: String(s._id), before: { state: before }, after: { state: to } });
  res.json({ success: true, data: s });
}

principalRouter.post('/sessions/:id/activate', requirePermission('session.activate'), (req: AuthedRequest, res) => transition(req, res, String(req.params.id), 'ACTIVE'));
principalRouter.post('/sessions/:id/close', requirePermission('session.close'), (req: AuthedRequest, res) => transition(req, res, String(req.params.id), 'CLOSED'));
principalRouter.post('/sessions/:id/archive', requirePermission('session.close'), (req: AuthedRequest, res) => transition(req, res, String(req.params.id), 'ARCHIVED'));
