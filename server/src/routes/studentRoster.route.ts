import express from "express";
import {
  createStudentRosterBatch,
  createStudentRosterRecord,
  deactivateStudentRosterRecord,
  getStudentRoster,
  updateStudentRosterRecord,
} from "../controller/student.controller";
import { verifyAuth } from "../middleware/auth.middleware";
import { verifyRole } from "../middleware/role.middleware";
import { ROLES } from "../constants/app.constants";

const router = express.Router();

router.get("/", verifyAuth, verifyRole([ROLES.ADMIN]), getStudentRoster);

router.post(
  "/",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  createStudentRosterRecord,
);

router.post(
  "/batch",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  createStudentRosterBatch,
);

router.patch(
  "/:id",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  updateStudentRosterRecord,
);

router.patch(
  "/deactivate/:id",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  deactivateStudentRosterRecord,
);

export default router;
