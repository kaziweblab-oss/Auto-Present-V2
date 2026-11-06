import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICrAssignments extends Document {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
  sessionId: Types.ObjectId;
  assignedBy: Types.ObjectId;
}

const CrAssignmentsSchema = new mongoose.Schema<ICrAssignments>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Classes",
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
  },
  { timestamps: true },
);

export const CrAssignments = mongoose.model<ICrAssignments>(
  "CrAssignments",
  CrAssignmentsSchema,
);
