import express from "express";
import cors from "cors"
import bodyParser from "body-parser";
import notificationRoutes from "./routes/notification.routes.js";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/notifications", notificationRoutes);

  return app;
};
