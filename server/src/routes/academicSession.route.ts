import express from "express";
import {
  createAcademicSession,
  getAllAcademicSession,
  setActiveSession,
  setDeactiveSession,
} from "../controller/academicSession.controller";
import { verifyAuth } from "../middleware/auth.middleware";
import { verifyRole } from "../middleware/role.middleware";
import { ROLES } from "../constants/app.constants";

const router = express.Router();

router.get(
  "/",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  getAllAcademicSession,
);

router.post(
  "/create",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  createAcademicSession,
);

router.patch(
  "/active/:id",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  setActiveSession,
);

router.patch(
  "/deactive/:id",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  setDeactiveSession,
);

export default router;
