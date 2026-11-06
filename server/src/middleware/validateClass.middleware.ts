import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AcademicSession } from "../models/academicSessions.model";
import { Departments } from "../models/departments.model";

export const validateClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body ?? {};
    const { sessionId, departmentId, shift, semister } = body;

    const missingFields = [];
    if (!sessionId) missingFields.push("Session ID");
    if (!departmentId) missingFields.push("Department ID");
    if (!shift) missingFields.push("Shift");
    if (!semister) missingFields.push("Semister");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `${missingFields.join(", ")} filed's cannot be empty.`,
      });
    }

    const unValidIDs = [];

    if (!mongoose.isObjectIdOrHexString(sessionId))
      unValidIDs.push("Session ID");

    if (!mongoose.isObjectIdOrHexString(departmentId))
      unValidIDs.push("Department ID");

    if (unValidIDs.length > 0) {
      return res.status(400).json({
        status: false,
        message: `${unValidIDs.join(", ")} formate is Invalid.`,
      });
    }

    const [session, department] = await Promise.all([
      AcademicSession.findById(sessionId),
      Departments.findById(departmentId),
    ]);

    if (!session) {
      return res.status(404).json({
        status: false,
        message: "Academic Session not found with this ID.",
      });
    }

    if (!department) {
      return res.status(404).json({
        status: false,
        message: "Academic Department not found with this ID.",
      });
    }

    if (shift !== "1ST" && shift !== "2ND") {
      return res.status(400).json({
        status: false,
        message: `${shift} is not a valid Shift format. Please try again with '1ST' ar '2ND' value.`,
      });
    }

    if (semister > 8 || semister < 1) {
      return res.status(400).json({
        status: false,
        message: `${semister} is not a valid Semister. Please Try again with 1-8 value.`,
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
