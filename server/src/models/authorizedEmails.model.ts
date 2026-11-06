import mongoose, { Document } from "mongoose";
import { ROLES, RoleType } from "../constants/app.constants";

export interface IAuthorizedEmails extends Document {
  email: string;
  role: RoleType;
}

const authorizedEmailsShema = new mongoose.Schema<IAuthorizedEmails>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.CR],
      required: true,
    },
  },
  { timestamps: true },
);

export const AuthorizedEmail = mongoose.model<IAuthorizedEmails>(
  "AuthorizedEmail",
  authorizedEmailsShema,
);
