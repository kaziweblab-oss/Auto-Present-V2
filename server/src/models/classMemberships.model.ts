import mongoose, { Document, Schema, Types } from "mongoose";

export interface IClassMembership extends Document {
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
}

const ClassMembershipSchema = new mongoose.Schema<IClassMembership>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Classes",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
  },
  { timestamps: true },
);

ClassMembershipSchema.index(
  { studentId: 1, sessionId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const ClassMembership = mongoose.model<IClassMembership>(
  "ClassMembership",
  ClassMembershipSchema,
);
