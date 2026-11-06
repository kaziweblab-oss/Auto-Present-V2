import express from "express";

//Import passport Here
import { configurePassport } from "./config/passport.config";

/*-----------------
 Import Routes Here
 ------------------*/
import admineRoute from "./routes/admine.route";
import authRoute from "./routes/auth.route";
import academicSessionRouter from "./routes/academicSession.route";
import departmentRouter from "./routes/department.route";
import classRouter from "./routes/class.route";
import studentRosterRouter from "./routes/studentRoster.route";
import errorRouter from "./utils/RouteError";
import classMemberShipRouter from "./routes/classMembership.route";

import cors from "cors";
import passport from "passport";
import { globalErrorHandler } from "./middleware/error.middleware";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(cookieParser());

configurePassport();

app.use(passport.initialize());

app.use("/api/auth", authRoute);

app.use("/api/admine", admineRoute);

app.use("/api/departments", departmentRouter);

app.use("/api/academic-sessions", academicSessionRouter);

app.use("/api/class", classRouter);

app.use("/api/students/roster", studentRosterRouter);

app.use("/api/class-memberships", classMemberShipRouter);

app.use(errorRouter);

app.use(globalErrorHandler);

export default app;
