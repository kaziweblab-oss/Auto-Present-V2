import express, { Request, Response } from "express";

const router = express.Router();

router.all("{*path}", (req: Request, res: Response) => {
  res.status(404).json({
    status: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Page Not Found!`,
  });
});

export default router;
