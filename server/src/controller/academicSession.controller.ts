import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { AcademicSession } from "../models/academicSessions.model";
import mongoose from "mongoose";
import { validateSession } from "../utils/validators";

export const getAllAcademicSession = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const allAcademicSessions = await AcademicSession.find();
    res.status(200).json({
      status: true,
      message: "Academic sessions retrieved successfully.",
      data: allAcademicSessions,
    });
  } catch (error: unknown) {
    res.status(500).json({
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve academic sessions.",
    });
  }
};

export const createAcademicSession = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const body = req.body;
    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message:
          "Please Provide data in { name, year} filed for creating a Academic Session.",
      });
    }
    const name = body.name;
    const year = body.year;
    const userId = req.authUser?.id;

    if (!userId) {
      res.status(401).json({
        status: false,
        message: "Unauthorized. User ID not found.",
      });
      return;
    }

    const missingFields: any = [];

    if (!name) missingFields.push("Name");

    if (!year) missingFields.push("Year");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `${missingFields.join(", ")} filed cannot be empty.`,
      });
    }

    const trimmedName = String(name).trim();
    if (!validateSession(trimmedName)) {
      return res.status(400).json({
        status: false,
        message:
          "Invalid academic year format. Please use YYYY-YY, e.g. 2025-26.",
      });
    }

    const yearRegex = /^\d{4}$/;

    if (!yearRegex.test(year)) {
      return res.status(400).json({
        status: false,
        message: "Invalid Session year. Please use YYYY, e.g. 2026.",
      });
    }

    const existingSession = await AcademicSession.findOne({
      $or: [{ name }, { year }],
    });

    if (existingSession) {
      const conflictFields: string[] = [];
      if (String(existingSession.year) === year) conflictFields.push("Year");
      if (existingSession.name === name) conflictFields.push("Name");

      res.status(409).json({
        status: false,
        message: `Academic session already exists with this ${conflictFields.join(" or ")}.`,
        conflictFields,
      });
      return;
    }

    const academicSession = await AcademicSession.create({
      name,
      year: Number(year),
      createdBy: userId,
      isActive: false,
    });

    res.status(201).json({
      status: true,
      message: `Academic session created successfully for ${name}.`,
      data: academicSession,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const setActiveSession = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID formate. Please try again with a valid ID.",
      });
    }

    const session = await AcademicSession.findById(id);

    if (!session) {
      return res.status(404).json({
        status: false,
        message: `Academic Session not found.`,
      });
    }

    if (session.isActive === true) {
      return res.status(400).json({
        status: false,
        message: `${session.name} Academic Session is Already Active`,
      });
    }

    await AcademicSession.updateMany(
      { isActive: true },
      { $set: { isActive: false } },
    );
    session.isActive = true;
    await session.save();

    return res.status(200).json({
      status: true,
      message: `${session.name} Academic Session is now set as Active.`,
    });
  } catch (error: unknown) {
    res.status(500).json({
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to activate academic session.",
    });
  }
};

export const setDeactiveSession = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID formate. Please try again with a valid ID.",
      });
    }

    const session = await AcademicSession.findById(id);

    if (!session) {
      return res.status(404).json({
        status: false,
        message: "Session Not found.",
      });
    }

    if (session.isActive === false) {
      return res.status(400).json({
        status: false,
        message: `${session.name} Academic Session is Already Deactivated.`,
      });
    }

    session.isActive = false;
    await session.save();
    res.status(200).json({
      status: true,
      message: `${session.name} Academic Session Deactivated Successfully.`,
    });
  } catch (error: unknown) {
    res.status(500).json({
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to deactivate academic session.",
    });
  }
};
