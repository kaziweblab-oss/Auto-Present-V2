import type { Response } from "express";
import mongoose from "mongoose";

export function dbOk(res: Response): boolean {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ success: false, error: { code: "DB_UNAVAILABLE" } });
  return false;
}
