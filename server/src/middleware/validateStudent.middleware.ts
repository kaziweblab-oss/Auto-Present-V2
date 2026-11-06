import { NextFunction, Request, Response } from "express";
import { Student } from "../models/students.model";
import { AcademicSession } from "../models/academicSessions.model";
import { Departments } from "../models/departments.model";

export const validateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body ?? {};

    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message: "Please Provide Valid Data for Create a Student Account.",
      });
    }

    const missingFileds = [];
    const { departmentId, sessionId, shift, roll } = body;

    if (!departmentId) missingFileds.push("Department");
    if (!sessionId) missingFileds.push("Session");
    if (!shift) missingFileds.push("Shift");
    if (!roll) missingFileds.push("Roll");

    if (missingFileds.length > 0) {
      return res.status(400).json({
        status: false,
        message: `${missingFileds.join(", ")} filed's cannot be empty for createing a student profile.`,
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

    next();
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
