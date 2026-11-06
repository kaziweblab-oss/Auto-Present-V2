import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/users.model";
import { ROLES } from "../constants/app.constants";

const ADMINE_EMAILS = new Set(
  (process.env.ADMINE_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          const userEmail = profile.emails?.[0]?.value?.trim().toLowerCase();
          const name = profile.displayName?.trim();
          const googleId = profile.id;

          if (!userEmail || !googleId || !name) {
            return cb(
              new Error("Incomplete profile data received from Google."),
            );
          }

          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.create({
              googleId,
              name,
              email: userEmail,
              role: ADMINE_EMAILS.has(userEmail) ? ROLES.ADMIN : ROLES.STUDENT,
              avatar: profile.photos?.[0]?.value || "",
            });
          } else if (ADMINE_EMAILS.has(userEmail) && user.role !== ROLES.ADMIN) {
            user.role = ROLES.ADMIN;
            await user.save();
          }
          return cb(null, user);
        } catch (error) {
          return cb(error, undefined);
        }
      },
    ),
  );
};
