// Non-destructive Phase 1 migration: ensure indexes + normalize legacy CI role.
// Never drops collections. Safe to re-run.
import { connectDb } from "./db-config.js";
import { User } from "./models.js";

async function main() {
  const uri = process.argv[2] ?? process.env.MONGODB_URI;
  if (!uri) {
    console.error("Usage: npm run migrate -- <mongodb-uri>");
    process.exit(1);
  }
  await connectDb(uri);
  const r = await User.updateMany(
    { roles: "CI" },
    { $set: { "roles.$[e]": "DEPARTMENT_HEAD_CI" } },
    { arrayFilters: [{ e: "CI" }] },
  );
  console.log(
    `Normalized legacy CI roles: matched=${r.matchedCount} modified=${r.modifiedCount}`,
  );
  for (const m of [User]) {
    await m.syncIndexes();
    console.log(`Indexes synced: ${m.modelName}`);
  }
  const {
    AcademicSession,
    Department,
    Student,
    StudentSession,
    Teacher,
    ClassGroup,
    Subject,
    ClassCaptain,
    RoutineEntry,
    ClassSession,
    AttendanceRecord,
    ReplacementRequest,
    SystemSetting,
    ClassTimeChangeRequest,
    ResultImport,
    Result,
    ResultSubject,
    DroppedHistory,
    ResultRevision,
    TransferImport,
    Transfer,
    Notice,
    NoticeRead,
    Holiday,
    ShiftMerge,
    AuditLog,
  } = await import("./models.js");
  for (const m of [
    AcademicSession,
    Department,
    Student,
    StudentSession,
    Teacher,
    ClassGroup,
    Subject,
    ClassCaptain,
    RoutineEntry,
    ClassSession,
    AttendanceRecord,
    ReplacementRequest,
    SystemSetting,
    ClassTimeChangeRequest,
    ResultImport,
    Result,
    ResultSubject,
    DroppedHistory,
    ResultRevision,
    TransferImport,
    Transfer,
    Notice,
    NoticeRead,
    Holiday,
    ShiftMerge,
    AuditLog,
  ]) {
    await m.syncIndexes();
    console.log(`Indexes synced: ${m.modelName}`);
  }
  await (await import("mongoose")).disconnect();
  console.log("Migration complete (no data deleted).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
