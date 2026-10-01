import type { Response } from 'express';
import mongoose from 'mongoose';

// Foundation runs degraded without MongoDB; data routes report 503 instead of hanging.
export function dbOk(res: Response): boolean {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE' } });
  return false;
}
