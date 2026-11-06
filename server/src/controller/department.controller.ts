import { Request, Response } from "express";
import { Departments } from "../models/departments.model";
import mongoose from "mongoose";
import passport from "passport";

//get all Departments
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await Departments.find();

    res.status(200).json({
      status: true,
      data: departments,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// create a new Depertment
export const createDepartment = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (body === undefined) {
      return res.status(400).json({
        status: false,
        message:
          "Request Body cannot be empty for creating a Department. Please provide Department data for { name, code } fileds value.",
      });
    }
    const { name, code } = body;

    let missingFields = [];

    if (!name) missingFields.push("Name");
    if (!code) missingFields.push("Code");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Department ${missingFields.join(", ")} cannot be empty.`,
      });
    }

    const onlyDigitsRegex = /^\d+$/;

    const trimmedCode = String(code).trim();

    if (!onlyDigitsRegex.test(trimmedCode)) {
      return res.status(400).json({
        status: false,
        message:
          "Department code must contain only numbers (no letters or text allowed).",
      });
    }

    if (trimmedCode.length !== 2) {
      return res.status(400).json({
        status: false,
        message: `Department code must be exactly 2 digits long (e.g. ,'07','12'  ) `,
      });
    }

    let conflictField = "";

    const existingDepartment = await Departments.findOne({
      $or: [{ name }, { code: trimmedCode }],
    });

    if (existingDepartment) {
      conflictField = existingDepartment.name === name ? "Name" : "Code";

      return res.status(409).json({
        status: false,
        message: `Department already exist with this ${conflictField}.`,
      });
    }

    const department = await Departments.create({
      name,
      code: trimmedCode,
    });

    res.status(201).json({
      status: true,
      message: "Department Created Successfull.",
      data: department,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Department name or code already exists.",
      });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        status: false,
        message: error.message,
      });
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// update department
export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    const id = req.params.id;

    const updateData: { name?: string; code?: string } = {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message:
          "Invalid ID formate. Please try again with a valid ID formate.",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          status: false,
          message: "Name Cannot be empty.",
        });
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          status: false,
          message: "Code cannot be empty.",
        });
      }
      updateData.code = code.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: false,
        message: "Provide name or code to Update.",
      });
    }

    const existDepartment = await Departments.findById(id);

    if (!existDepartment) {
      return res.status(404).json({
        status: false,
        message: "Department not found with this ID.",
      });
    }

    const isUpToDate = Object.entries(updateData).every(
      ([key, value]) => existDepartment.get(key) === value,
    );

    if (isUpToDate) {
      return res.status(200).json({
        status: true,
        message: "Department is already up to date.",
        data: existDepartment,
      });
    }

    const updatedDepartment = await Departments.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedDepartment) {
      return res.status(404).json({
        status: false,
        message: "Department not found with this ID.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Department Updated Successfull.",
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Department Name or Code Already exists.",
      });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        status: false,
        message: error.message,
      });
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// delete a Depertment
export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ID formate. Please try again with a valid ID.",
      });
    }

    const deletedDepartment = await Departments.findByIdAndDelete(id);

    if (!deletedDepartment) {
      return res.status(404).json({
        status: false,
        message: "Department not found with this ID.",
      });
    }

    res.status(200).json({
      status: true,
      message: `${deletedDepartment.name}. Department Deleted successfull.`,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
