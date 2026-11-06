import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { IUser } from "../models/users.model";

export const authUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = req.user as IUser | undefined;

    if (!user) {
      res.status(401).json({
        status: false,
        message: "Google Authentication Failed.",
      });
      return;
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );

    res
      .status(200)
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        status: true,
        message: "Google login Successfull.",
        data: {
          token,
          user,
        },
      });
  } catch (error) {
    next(error);
  }
};
