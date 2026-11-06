import mongoose, { Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  code: string;
}

const DepartmentSchema = new mongoose.Schema<IDepartment>({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v: string) => {
        return v.length === 2;
      },
      message: (props: any) =>
        `${props.value} must be exactly 2 characters long!`,
    },
    unique: true,
  },
});

export const Departments = mongoose.model<IDepartment>(
  "Departments",
  DepartmentSchema,
);
