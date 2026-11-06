import mongoose, { Document, Schema, Types } from "mongoose";

export interface IStudent extends Document {
  roll: string;
  userId?: Types.ObjectId;
  isActive?: boolean;
}

const StudentSchema = new mongoose.Schema<IStudent>(
  {
    roll: {
      type: String,
      unique: true,
      trim: true,
      required: true,
      validate: {
        validator: (v: string) => {
          return v.length === 6;
        },
        message: (props: any) => {
          return `${props.value} must be exactly 6 characters longs!`;
        },
      },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Student = mongoose.model<IStudent>("Student", StudentSchema);
