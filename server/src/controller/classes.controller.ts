import { Request, Response } from "express";
import { Classes } from "../models/classes.model";
import mongoose from "mongoose";

// get class
export const getClass = async (req: Request, res: Response) => {
  try {
    const classes = await Classes.find();

    res.status(200).json({
      status: true,
      message: "Get Classes Successfully.",
      data: classes,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// create a class
export const createClass = async (req: Request, res: Response) => {
  try {
    const { sessionId, departmentId, shift, semister } = req.body;

    const existClass = await Classes.findOne({
      sessionId,
      departmentId,
      shift,
      semister,
    });

    if (existClass) {
      return res.status(409).json({
        status: false,
        message: "Class already existe with this data.",
      });
    }

    const createdClass = await Classes.create({
      sessionId,
      departmentId,
      shift,
      semister,
    });

    res.status(201).json({
      status: true,
      message: "Class created successfully.",
      data: createdClass,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        status: false,
        message:
          "This combination of Session, Department, Shift, and Semester already exists.",
      });
      return;
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// update class
export const updateClass = async (req: Request, res: Response) => {
  try {
    const classId = req.params.id;

    if (classId === undefined) {
      return res.status(400).json({
        status: false,
        message: "Class ID is Undefined.",
      });
    }

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid Class ID formate.",
      });
    }

    const body = req.body;

    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message: "Please provide updated Data for Update a class.",
      });
    }

    const { sessionId, departmentId, shift, semister } = body;

    const updatedData: Record<string, any> = {};

    if (sessionId !== undefined) updatedData.sessionId = sessionId;
    if (departmentId !== undefined) updatedData.departmentId = departmentId;
    if (shift !== undefined) updatedData.shift = shift;
    if (semister !== undefined) updatedData.semister = semister;

    const oldClass = await Classes.findById(classId);

    if (!oldClass) {
      return res.status(404).json({
        status: false,
        message: "No Class found with this ID.",
      });
    }

    const isUpToDate = Object.entries(updatedData).every(([key, value]) => {
      const oldValue = oldClass.get(key);

      if (oldValue === null && value === null) return true;

      return String(oldValue) === String(value);
    });

    if (isUpToDate) {
      return res.status(200).json({
        status: false,
        message: "Class is already Up to Date.",
        data: isUpToDate,
      });
    }

    const updatedClass = await Classes.findByIdAndUpdate(
      classId,
      { $set: updatedData },
      { new: true, runValidators: true },
    );

    if (!updatedClass) {
      return res.status(404).json({
        status: false,
        message: "Class not found with this ID.",
      });
    }

    res.status(200).json({
      status: true,
      message: "class updated successfully.",
      data: updatedClass,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Delete class
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID format. Please try again with a valid ID format.",
      });
    }

    const deletedClass = await Classes.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({
        status: false,
        message: "Class not found with this ID.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Class deleted Successfully.",
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
