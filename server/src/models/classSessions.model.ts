import mongoose, { Document, Schema, Types } from "mongoose";
import { CLASS_SESSIONS_STATUS, ClassSessionStatusType } from "../constants/app.constants";

export interface IClassSession extends Document {
  classId: Types.ObjectId;
  crId: Types.ObjectId;
  date: Date;
  status: ClassSessionStatusType;
  openedAt: Date;
  closedAt: Date;
}

const ClassSessionSchema = new mongoose.Schema<IClassSession>(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Classes",
      required: true,
    },
    crId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum:CLASS_SESSIONS_STATUS,
      required: true,
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

export const ClassSessions = mongoose.model<IClassSession>(
  "ClassSessions",
  ClassSessionSchema,
);
