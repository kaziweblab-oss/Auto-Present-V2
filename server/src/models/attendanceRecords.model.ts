import mongoose, { Document, Schema, Types } from "mongoose";
import { CLASS_STATUS, ClassStatusType } from "../constants/app.constants";

export interface IAttendanceRecords extends Document {
  classSessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: ClassStatusType;
  timestamp: Date;
}

const AttendanceRecordsSchema = new mongoose.Schema<IAttendanceRecords>(
  {
    classSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ClassSessions",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    status: {
      type: String,
      enum: CLASS_STATUS,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const AttendanceRecords = mongoose.model<IAttendanceRecords>(
  "AttendanceRecords",
  AttendanceRecordsSchema,
);
