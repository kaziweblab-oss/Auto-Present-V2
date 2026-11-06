import mongoose, { Document, Schema, Types } from "mongoose";
import { SHIFTS, ShiftType } from "../constants/app.constants";

export interface IClasses extends Document {
  sessionId: Types.ObjectId;
  departmentId: Types.ObjectId;
  shift: ShiftType;
  semister: number;
}

const ClassSchema = new mongoose.Schema<IClasses>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Departments",
      required: true,
    },
    shift: {
      type: String,
      enum: SHIFTS,
      required: true,
    },
    semister: {
      type: Number,
      min: [1, "Semister cannot be less than 1."],
      max: [8, "Semister cannot be greater than 8."],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ClassSchema.index(
  { sessionId: 1, departmentId: 1, shift: 1, semister: 1 },
  { unique: true },
);

export const Classes = mongoose.model<IClasses>("Classes", ClassSchema);
