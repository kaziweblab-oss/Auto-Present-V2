import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAdmine = (req: AuthRequest, res: Response): void => {
  res.status(200).json({
    status: true,
    message: "Welcome to the Admin Dashboard.",
    user: req.authUser,
  });
};
