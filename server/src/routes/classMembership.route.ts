import express from "express";
import { verifyAuth } from "../middleware/auth.middleware";
import { ROLES } from "../constants/app.constants";
import {
  assignOrUpdateStudentClass,
  getClassMembersByClassId,
  getClassMembers,
  getStudentMembershipHistory,
} from "../controller/classMembership.controller";
import { verifyRole } from "../middleware/role.middleware";

const router = express.Router();

// get all class members
router.get("/class", verifyAuth, verifyRole([ROLES.ADMIN]), getClassMembers);

// get class members by classID
router.get(
  "/class/:classId",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  getClassMembersByClassId,
);

// get student membership history
router.get(
  "/student/:studentId/history",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  getStudentMembershipHistory,
);

// assign or update a class
router.post(
  "/assign-or-update",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  assignOrUpdateStudentClass,
);

export default router;
