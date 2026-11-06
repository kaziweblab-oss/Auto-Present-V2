import { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";
import { RoleType } from "../constants/app.constants";

export interface IUserPayload {
  id: string;
  email: string;
  role: RoleType;
}

export interface AuthRequest extends Request {
  authUser?: IUserPayload;
}

export const verifyAuth = (
  req: AuthRequest ,
  res: Response,
  next: NextFunction,
): void => {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      status: false,
      message: "Token not Found. Please Login.",
    });

    return;
  }
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as IUserPayload;
    req.authUser = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      status: false,
      message: `Invalid or Expired Token.`,
    });
    return;
  }
};
