import app from "./app";
import { connectDB } from "./config/db";

const PORT: number = Number(process.env.PORT || 5000);
const HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  throw new Error("MONGODB_URL is not configured.");
}

const startServer = async () => {
  await connectDB(MONGODB_URL);
  app.listen(PORT, HOSTNAME, () => {
    console.log(`Your Server is Successfully run at http://${HOSTNAME}:${PORT}`);
  });
};

void startServer().catch((error: unknown) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});
