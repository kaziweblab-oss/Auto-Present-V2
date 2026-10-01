import { Router } from 'express';
import { z } from 'zod';
import { User, AcademicSession, AuditLog, audit } from './models.js';
import { dbOk } from './db-guard.js';
import { requireAuth, requirePermission, type AuthedRequest } from './rbac.js';

export const superAdminRouter = Router();
superAdminRouter.use(requireAuth);

// Users + role assignment (SUPER_ADMIN only). Super Admin account itself is seeded later via env.
superAdminRouter.get('/users', requirePermission('user.manage'), async (_req, res) => {
  if (!dbOk(res)) return;
  const users = await User.find().lean().limit(200);
  res.json({ success: true, data: users });
});

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL','CI','TEACHER','STUDENT']),
});

superAdminRouter.post('/assign-role', requirePermission('role.assign'), async (req: AuthedRequest, res) => {
  if (!dbOk(res)) return;
  const parsed = assignRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } });
  const user = (await User.findByIdAndUpdate(parsed.data.userId, { $addToSet: { roles: parsed.data.role } }, { new: true }).lean()) as unknown as ({ _id: string } & Record<string, unknown>) | null;
  if (!user || Array.isArray(user)) return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND' } });
  await audit({ actorUserId: req.user!.id, role: 'SUPER_ADMIN', action: 'role.assign', entity: 'User', entityId: String(user._id), after: { role: parsed.data.role } });
  res.json({ success: true, data: user });
});

// Audit viewer (SUPER_ADMIN + PRINCIPAL)
superAdminRouter.get('/audit', requirePermission('audit.read'), async (_req, res) => {
  if (!dbOk(res)) return;
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: logs });
});

// Session read (create/activate/close belongs to Principal, Phase 3)
superAdminRouter.get('/sessions', requirePermission('audit.read'), async (_req, res) => {
  if (!dbOk(res)) return;
  const sessions = await AcademicSession.find().lean();
  res.json({ success: true, data: sessions });
});
