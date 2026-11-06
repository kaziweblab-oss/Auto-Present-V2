import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

export const verifyRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.authUser;
    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({
        status: false,
        message: `You don't have enough permission.`,
      });
      return;
    }
    next();
  };
};
