import express from "express";
import passport from "passport";
import { authUser } from "../controller/auth.controller";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", 
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  authUser,
);

export default router;
