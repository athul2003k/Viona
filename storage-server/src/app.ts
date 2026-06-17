import express from "express";
import cors from "cors";
import { connectDB } from "./utils/mongoose";
import files from "./routes/files.routes";
import storage from "./routes/storage.routes";
import images from "./routes/images.routes";
import trash from "./routes/trash.routes";

// Connect to MongoDB Atlas before starting the server
await connectDB();

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman) and any localhost/LAN origin
      if (!origin) return callback(null, true);
      const allowed =
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        ) || origin === "http://viona-frontend:3000";
      callback(null, allowed ? origin : false);
    },
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api/files", files);
app.use("/api/storage", storage);
app.use("/api/images", images);
app.use("/api/trash", trash);

export default app;
