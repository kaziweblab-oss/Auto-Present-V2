import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = { ...err };
  error.message = err.message;

  //Mongoose Invalid ObjectId Error (CastError)
  if (err.name === "CastError") {
    const message = `Resource not found. Invalid: ${err.path} `;
    error = new ApiError(400, message);
  }

  //Mongoose Duplicate Key Error 9E11000
  if (err.code === 11000) {
    const filed = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered for ${filed}. Please try with another value!`;
    error = new ApiError(400, message);
  }

  //Mongoose Validation Error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(", ");
    error = new ApiError(400, message);
  }

  //JWT Expired / Invalid Error
  if (err.name === "JsonWebTokenError") {
    error = new ApiError(401, "Invalid token. Please Login again.");
  }
  if (err.name === "TokenExpiredError") {
    error = new ApiError(401, "Your Token has expired! Please login again.");
  }

  const statusCode = error.statusCode || 500;
  const message = error.message;

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
