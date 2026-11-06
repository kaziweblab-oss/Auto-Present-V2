import { Request, Response } from "express";
import { Student } from "../models/students.model";
import mongoose from "mongoose";

// get all/filter student roaster account
export const getStudentRoster = async (req: Request, res: Response) => {
  try {
    const { roll, isActive, linked } = req.query;

    const filter: Record<string, any> = {};

    if (roll) {
      filter.roll = { $regex: roll, $options: "i" };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (linked === "true") {
      filter.userId = { $ne: null };
    } else if (linked === "false") {
      filter.userId = { $exists: false };
    }

    const students = await Student.find(filter)
      .populate("userId", "name email profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      count: students.length,
      data: students,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// create a single student roster account
export const createStudentRosterRecord = async (
  req: Request,
  res: Response,
) => {
  try {
    const body = req.body;

    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message:
          "Please provide data in { roll } filed for create a student roster account.",
      });
    }
    const roll = body.roll;
    if (!roll) {
      return res.status(400).json({
        status: false,
        message:
          "Please provide a roll number for create a student roster account.",
      });
    }

    const newStudent = await Student.create({
      roll: roll.trim(),
      isActive: true,
    });

    res.status(201).json({
      status: true,
      message: "Student roster account created successfully.",
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "User roster account is already exist with this roll.",
      });
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// create multi student roster account
export const createStudentRosterBatch = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message: "Request body cannot be undefined.",
      });
    }
    const { rolls } = body;

    if (!Array.isArray(rolls) || rolls.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Please provide an arry of roll number.",
      });
    }

    const studentDocs = rolls.map((roll) => ({
      roll: String(roll).trim(),
      isActive: true,
    }));

    const result = await Student.insertMany(studentDocs, { ordered: false });

    return res.status(201).json({
      status: true,
      message: `${result.length} student roaster account created successfully.`,
      data: result,
    });
  } catch (error: any) {
    if (error.code === 11000 || error.insertedDocs) {
      return res.status(207).json({
        status: true,
        message: "Batch processed with some duplicated rolls skipped/failed.",
        insertedCount: error.insertedDocs?.length || 0,
      });
    }

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// update student roster record
export const updateStudentRosterRecord = async (
  req: Request,
  res: Response,
) => {
  try {
    const studentId = req.params.id;

    const { roll } = req.body;

    if (!mongoose.isObjectIdOrHexString(studentId)) {
      return res.status(400).json({
        status: false,
        message: "Invaid Student ID format.",
      });
    }

    if (!roll) {
      return res.status(400).json({
        status: false,
        message: "Stuent roll filed cannot be empty.",
      });
    }

    const udpatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { roll: roll.trim() },
      { new: true, runValidators: true },
    );

    if (!udpatedStudent) {
      return res.status(404).json({
        status: false,
        message: "Student roster record not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Student roster record updated successfully.",
      data: udpatedStudent,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "This roll is already assigned to another record.",
      });
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// deactive a student record
export const deactivateStudentRosterRecord = async (
  req: Request,
  res: Response,
) => {
  try {
    const studentId = req.params.id;

    if (!studentId) {
      return res.status(400).json({
        status: false,
        message: "Student ID filed cannot be empty.",
      });
    }

    if (!mongoose.isObjectIdOrHexString(studentId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid student ID format.",
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        status: false,
        message: "Student roster record not found.",
      });
    }

    if (student.isActive === false) {
      return res.status(400).json({
        status: false,
        message: "Student roster record already deactiveted.",
      });
    }

    student.isActive = false;
    student.save();

    return res.status(200).json({
      status: true,
      message: "Student roster record deactivated Successfully.",
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
