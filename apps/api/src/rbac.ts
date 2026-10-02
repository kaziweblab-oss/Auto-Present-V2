import type { Request, Response, NextFunction } from "express";
import {
  hasPermission,
  normalizeRole,
  permissionsFor,
  type Permission,
  type Role,
} from "@auto-present-v2/shared";
import { User } from "./models.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: Role[];
    departmentScope?: string | null;
  };
}

// Demo header auth (OAuth lands before production).
// Headers: x-demo-user-id (required), x-demo-user-email, x-demo-user-roles,
// x-demo-dept-scope (department ObjectId for CI scoping in dev).
export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const id = req.header("x-demo-user-id");
  const email = req.header("x-demo-user-email") ?? "";
  const rawRoles = (req.header("x-demo-user-roles") ?? "")
    .split(",")
    .filter(Boolean);
  if (!id)
    return res
      .status(401)
      .json({ success: false, error: { code: "UNAUTHENTICATED" } });
  const roles = rawRoles
    .map((r) => normalizeRole(r.trim()))
    .filter((r): r is Role => r !== null);
  const departmentScope = req.header("x-demo-dept-scope") ?? null;
  req.user = { id, email, roles, departmentScope };
  next();
}

/** Hydrate departmentScope from DB when demo header is absent (prod path). */
export async function hydrateScope(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (
      process.env.AUTH_STRICT === "true" ||
      process.env.NODE_ENV === "production"
    ) {
      // Strict: client roles are NEVER trusted — DB is the source of truth.
      try {
        const doc = (await User.findById(req.user!.id)
          .select("roles departmentScope status")
          .lean()) as unknown as {
          roles: string[];
          departmentScope?: unknown;
          status?: string;
        } | null;
        if (!doc || doc.status === "INACTIVE") {
          req.user!.roles = [];
          req.user!.departmentScope = null;
          return next();
        }
        req.user!.roles = (doc.roles ?? [])
          .map((r) => normalizeRole(String(r)))
          .filter((r): r is Role => r !== null);
        req.user!.departmentScope = doc.departmentScope
          ? String(doc.departmentScope)
          : null;
        return next();
      } catch {
        req.user!.roles = [];
        return next();
      }
    }
    if (req.user && !req.user.departmentScope && req.user.id) {
      const doc = (await User.findById(req.user.id)
        .select("departmentScope")
        .lean()) as unknown as { departmentScope?: unknown } | null;
      if (doc?.departmentScope)
        req.user.departmentScope = String(doc.departmentScope);
    }
  } catch {
    /* degraded mode: keep header scope */
  }
  next();
}

export function requirePermission(perm: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    const ok = roles.some((r) => hasPermission(r, perm));
    if (!ok)
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", permission: perm },
      });
    next();
  };
}

export function requireAnyPermission(...perms: Permission[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    const ok = perms.some((p) => roles.some((r) => hasPermission(r, p)));
    if (!ok)
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", permissions: perms },
      });
    next();
  };
}

/**
 * DEPARTMENT_HEAD_CI must act inside their own department.
 * SUPER_ADMIN/PRINCIPAL bypass scope. Others must match `departmentId` param/body.
 */
export function requireDepartmentScope(
  source: { param?: string; body?: string } = {},
) {
  const paramKey = source.param ?? "departmentId";
  const bodyKey = source.body ?? "departmentId";
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    if (roles.includes("SUPER_ADMIN") || roles.includes("PRINCIPAL"))
      return next();
    if (!roles.includes("DEPARTMENT_HEAD_CI"))
      return res
        .status(403)
        .json({ success: false, error: { code: "FORBIDDEN_SCOPE" } });
    const scope = req.user?.departmentScope;
    const target =
      (req.params?.[paramKey] as string | undefined) ??
      (req.body?.[bodyKey] as string | undefined);
    if (!scope)
      return res
        .status(403)
        .json({ success: false, error: { code: "NO_DEPARTMENT_SCOPE" } });
    if (target && String(target) !== String(scope))
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    next();
  };
}

export function myPermissions(roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of permissionsFor(r)) set.add(p);
  return [...set];
}
