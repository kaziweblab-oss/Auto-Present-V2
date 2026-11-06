import { Request, Response } from "express";
import mongoose from "mongoose";
import { ClassMembership } from "../models/classMemberships.model";
import { Student } from "../models/students.model";
import { Classes } from "../models/classes.model";

// get class members
export const getClassMembers = async (req: Request, res: Response) => {
  try {
    const allMembers = await ClassMembership.find();

    if (allMembers.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No user found.",
      });
    }

    res.status(200).json({
      status: true,
      message: "User collected successfully.",
      data: allMembers,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// get class filter by classId
export const getClassMembersByClassId = async (req: Request, res: Response) => {
  try {
    const classId = req.params.id;

    if (!mongoose.isObjectIdOrHexString(classId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid Class ID format.",
      });
    }

    const memberShip = await ClassMembership.findById(classId);

    if (!memberShip) {
      return res.status(404).json({
        status: false,
        message: "Membership not found with this Class ID.",
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      messagea: error.message,
    });
  }
};

// assign or update a student class
export const assignOrUpdateStudentClass = async (
  req: Request,
  res: Response,
) => {
  const body = req.body ?? {};

  const { studentId, newClassId } = body;

  const missingFileds = [];
  if (!studentId) missingFileds.push("Student");
  if (!newClassId) missingFileds.push("New Class");

  if (missingFileds.length > 0) {
    return res.status(400).json({
      status: false,
      message: `${missingFileds.join(", ")} ID are required.`,
    });
  }

  if (!mongoose.isObjectIdOrHexString(studentId)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Student ID format.",
    });
  }

  if (!mongoose.isObjectIdOrHexString(newClassId)) {
    return res.status(400).json({
      status: false,
      message: "Invalid New Class ID format.",
    });
  }

  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const [student, targetClass] = await Promise.all([
      Student.findById(studentId).session(dbSession),
      Classes.findById(newClassId).session(dbSession),
    ]);

    if (!student) {
      await dbSession.abortTransaction();
      return res.status(404).json({
        status: false,
        message: "Student roster account not found.",
      });
    }

    if (!targetClass) {
      await dbSession.abortTransaction();
      return res.status(404).json({
        status: false,
        message: "Class not found.",
      });
    }

    const sessionId = targetClass.sessionId;

    const activeMembership = await ClassMembership.findOne({
      studentId: student._id,
      sessionId,
      isActive: true,
    }).session(dbSession);

    if (activeMembership?.classId.equals(targetClass._id)) {
      await dbSession.abortTransaction();
      return res.status(200).json({
        status: true,
        message: "Student is already enrolled in this class for this session.",
        data: activeMembership,
      });
    }

    if (activeMembership) {
      activeMembership.isActive = false;
      activeMembership.endDate = new Date();
      await activeMembership.save({ session: dbSession });
    }

    const newMembership = await ClassMembership.create(
      [
        {
          studentId: student._id,
          classId: targetClass._id,
          sessionId,
          isActive: true,
          startDate: new Date(),
        },
      ],
      { session: dbSession },
    );

    await dbSession.commitTransaction();

    return res.status(201).json({
      status: true,
      message: "Student membership updated. History preserved.",
      data: newMembership,
    });
  } catch (error: any) {
    if (dbSession.inTransaction()) {
      await dbSession.abortTransaction();
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Student already has an active class in this session.",
      });
    }

    res.status(500).json({
      status: false,
      message: error.message,
    });
  } finally {
    await dbSession.endSession();
  }
};

// see student membership history
export const getStudentMembershipHistory = async (
  req: Request,
  res: Response,
) => {
  try {
    const { studentId } = req.params;

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


    const memberShips= await ClassMembership.find({
      studentId:student._id
    }).sort({startDate:-1})

    return res.status(200).json({
      status:true,
      count:memberShips.length,
      data:memberShips,
    })


  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
