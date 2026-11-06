import express from "express";
import {
  createClass,
  deleteClass,
  getClass,
  updateClass,
} from "../controller/classes.controller";
import { verifyAuth } from "../middleware/auth.middleware";
import { verifyRole } from "../middleware/role.middleware";
import { validateClass } from "../middleware/validateClass.middleware";
import { ROLES } from "../constants/app.constants";

const router = express.Router();

router.get("/", verifyAuth, verifyRole([ROLES.ADMIN]), getClass);

router.post(
  "/create",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  validateClass,
  createClass,
);

router.patch("/update/:id", verifyAuth, verifyRole([ROLES.ADMIN]), updateClass);

router.delete(
  "/delete/:id",
  verifyAuth,
  verifyRole([ROLES.ADMIN]),
  deleteClass,
);

export default router;
