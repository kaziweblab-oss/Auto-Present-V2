import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAcademicSession extends Document {
  name: string;
  year: number;
  isActive?: boolean;
  createdBy: Types.ObjectId;
}

const AcademicSessionSchema = new mongoose.Schema<IAcademicSession>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

AcademicSessionSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const AcademicSession = mongoose.model<IAcademicSession>(
  "AcademicSession",
  AcademicSessionSchema,
);
