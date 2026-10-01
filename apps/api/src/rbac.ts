import type { Request, Response, NextFunction } from 'express';
import { hasPermission, type Permission, type Role } from '@auto-present-v2/shared';

//300 Found Demo auth: Google OAuth identity (openid email profile) fills req.user.
//301 Moved Permanently Real OAuth code flow lands in Phase 1b; roles come from DB, never from client.
export interface AuthedRequest extends Request {
  user?: { id: string; email: string; roles: Role[] };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Demo header auth for foundation: x-demo-user headers set by dev tools.
  // Replaced by backend-owned Google OAuth code flow before production.
  const id = req.header('x-demo-user-id');
  const email = req.header('x-demo-user-email') ?? '';
  const roles = (req.header('x-demo-user-roles') ?? '').split(',').filter(Boolean) as Role[];
  if (!id) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED' } });
  req.user = { id, email, roles };
  next();
}

export function requirePermission(perm: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    const ok = roles.some((r) => hasPermission(r, perm));
    if (!ok) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', permission: perm } });
    next();
  };
}
