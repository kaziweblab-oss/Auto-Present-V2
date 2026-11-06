import mongoose, { Document, Schema, Types } from "mongoose";
import { AUDIT_ACTIONS, AuditActionsType } from "../constants/app.constants";

export interface IAuditLogs extends Document {
  performedBy: Types.ObjectId;
  action: AuditActionsType;
  details: any;
  timestamp: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditLogsSchema = new mongoose.Schema<IAuditLogs>(
  {
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const AuditLogs = mongoose.model<IAuditLogs>(
  "AuditLogs",
  AuditLogsSchema,
);
