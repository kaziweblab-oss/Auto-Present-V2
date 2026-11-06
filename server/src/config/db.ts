import mongoose from "mongoose";

export const connectDB = async (url: string) => {
  mongoose.connection.on("disconnected", () => {
    console.log(`MongoDB is Disconnected.`);
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected Successfully.");
  });

  mongoose.connection.on("error", (error) => {
    console.log(`MongoDB runtime error found : ${error.message}`);
  });

  const conn = await mongoose.connect(url);
  console.log(
    `MongoDB is Successfully connected with ${conn.connection.host}`,
  );
};
