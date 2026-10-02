import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { setupRouter } from "./setup.js";
import { foundationRouter } from "./foundation.js";
import { authRouter } from "./users.js";
import { sessionsRouter } from "./sessions.js";
import { studentsRouter } from "./students.js";
import { teachersRouter } from "./teachers.js";
import { routinesRouter } from "./routines.js";
import { attendanceRouter } from "./attendance.js";
import { replacementsRouter } from "./replacements.js";
import { timeChangesRouter } from "./time-changes.js";
import { resultsRouter } from "./results.js";
import { revisionsRouter } from "./revisions.js";
import { transfersRouter } from "./transfers.js";
import { noticesRouter } from "./notices.js";
import { calendarRouter } from "./calendar.js";
import { shiftsRouter } from "./shifts.js";
import { adminRouter } from "./admin.js";
import { vpRouter } from "./vp.js";
import { ciRouter } from "./ci.js";
import { teacherDashRouter } from "./teacher-dash.js";
import { studentDashRouter } from "./student-dash.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDbConfigured, readDbUri, connectDb } from "./db-config.js";
import { User } from "./models.js";

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),
  }),
);
app.use(express.json({ limit: "1mb" }));

// Rate limits: global burst guard + strict lane for auth/setup/imports.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Consistent error envelope (§51): every response carries meta.requestId.
app.use((req, res, next) => {
  res.locals.requestId = (req.header("x-request-id") as string) || randomUUID();
  res.setHeader("x-request-id", res.locals.requestId);
  next();
});

app.get("/api/v1/health/live", (_req, res) =>
  res.json({ success: true, data: { status: "alive" } }),
);
app.get("/api/v1/health/ready", (_req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: { mongodb: ok ? "connected" : "disconnected" },
  });
});
app.use("/api/v1/setup", sensitiveLimiter, setupRouter);
app.use("/api/v1/foundation", foundationRouter);
app.use("/api/v1/auth", sensitiveLimiter, authRouter);
app.use("/api/v1/sessions", sessionsRouter);
app.use("/api/v1/students", studentsRouter);
app.use("/api/v1/teachers", teachersRouter);
app.use("/api/v1/routines", routinesRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/replacements", replacementsRouter);
app.use("/api/v1/time-changes", timeChangesRouter);
app.use("/api/v1/results", resultsRouter);
app.use("/api/v1/revisions", revisionsRouter);
app.use("/api/v1/transfers", transfersRouter);
app.use("/api/v1/notices", noticesRouter);
app.use("/api/v1/calendar", calendarRouter);
app.use("/api/v1/shifts", shiftsRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/vp", vpRouter);
app.use("/api/v1/ci", ciRouter);
app.use("/api/v1/teacher", teacherDashRouter);
app.use("/api/v1/student", studentDashRouter);

// Single-service deploy: serve the built website from the same process.
// Resolved from the compiled server file location, NOT process.cwd().
const serverDir = path.dirname(fileURLToPath(import.meta.url)); // apps/api/dist
const webDist = [
  path.resolve(serverDir, "../../web/dist"),
  path.resolve(process.cwd(), "apps/web/dist"),
].find((p) => fs.existsSync(path.join(p, "index.html")));
if (webDist) {
  console.log(`Serving website from ${webDist}`);
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  console.warn("Website dist not found, running API-only mode");
}

const PORT = Number(process.env.PORT ?? 4000);

async function seedSuperAdmin() {
  const email = (process.env.INITIAL_SUPER_ADMIN_EMAIL ?? "").toLowerCase();
  if (!email) return;
  const existing = await User.findOne({ email }).lean();
  if (existing) return;
  await User.create({
    googleSubject: `seed:${email}`,
    email,
    displayName: "Super Admin",
    roles: ["SUPER_ADMIN"],
  });
  console.log(`Seeded SUPER_ADMIN ${email}`);
}

async function main() {
  if (isDbConfigured()) {
    try {
      await connectDb(readDbUri()!);
      console.log("MongoDB connected");
      await seedSuperAdmin();
    } catch (err) {
      console.warn(
        "MongoDB unavailable, starting degraded:",
        (err as Error).message,
      );
    }
  } else {
    console.log("No database configured yet (SETUP_NEEDED).");
  }
  app.listen(PORT, () => console.log(`API on :${PORT}`));
}

main();
export default app;
