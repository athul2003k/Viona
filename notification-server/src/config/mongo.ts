import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectMongo = async () => {
    await mongoose.connect(ENV.mongoUrl);
    console.log("✅ MongoDB connected");
};