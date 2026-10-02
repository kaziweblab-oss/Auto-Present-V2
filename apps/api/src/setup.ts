import { Router } from "express";
import { z } from "zod";
import {
  isDbConfigured,
  readDbUri,
  saveDbUri,
  connectDb,
} from "./db-config.js";
import { audit } from "./models.js";
import { requireAuth, requirePermission } from "./rbac.js";

export const setupRouter = Router();

const uriSchema = z.object({ uri: z.string().min(10).max(2000) });

setupRouter.get("/status", (_req, res) => {
  res.json({ success: true, data: { dbConfigured: isDbConfigured() } });
});

setupRouter.post("/database", async (req, res) => {
  const parsed = uriSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ success: false, error: { code: "VALIDATION_ERROR" } });

  if (isDbConfigured()) {
    const id = req.header("x-demo-user-id");
    const roles = (req.header("x-demo-user-roles") ?? "").split(",");
    if (!id || !roles.includes("SUPER_ADMIN")) {
      return res
        .status(403)
        .json({ success: false, error: { code: "FORBIDDEN" } });
    }
  }

  try {
    await connectDb(parsed.data.uri);
  } catch {
    return res
      .status(400)
      .json({ success: false, error: { code: "DB_CONNECT_FAILED" } });
  }
  saveDbUri(parsed.data.uri);
  try {
    await audit({
      actorUserId: req.header("x-demo-user-id") ?? "setup",
      role: "SUPER_ADMIN",
      action: "db.configure",
      entity: "Database",
    });
  } catch {
    /* audit table may not exist yet on first connect */
  }
  res.json({ success: true, data: { dbConfigured: true } });
});

setupRouter.get(
  "/database",
  requireAuth,
  requirePermission("audit.read"),
  (_req, res) => {
    res.json({
      success: true,
      data: { dbConfigured: isDbConfigured(), current: currentDbMasked() },
    });
  },
);

function currentDbMasked(): string | null {
  const uri = readDbUri();
  if (!uri) return null;
  const m = uri.match(/@([^/]+)\/(.+?)(\?|$)/);
  return m ? `${m[1]}/${m[2]}` : "(custom uri)";
}
