import express from "express";
import {
  // createAttendence,
  // deleteUser,
  getAdmine,
} from "../controller/admine.controller";
import { verifyAuth } from "../middleware/auth.middleware";
import { verifyRole } from "../middleware/role.middleware";
import { ROLES } from "../constants/app.constants";

const router = express.Router();

router.get("/", verifyAuth, verifyRole([ROLES.ADMIN]), getAdmine);

// router.post(
//   "/create-attendence",
//   verifyAuth,
//   verifyRole(["CR", "Admine"]),
//   createAttendence,
// );

// router.delete(
//   "/delete-user/:id",
//   verifyAuth,
//   verifyRole(["Admine"]),
//   deleteUser,
// );

export default router;
