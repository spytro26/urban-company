import "dotenv/config";
import express from "express";
import { pool } from "./db";
import authRoutes from "./src/routes/auth.routes";
import uploadRoutes from "./src/routes/upload.routes";
import userRouter from "./src/routes/user.routes";
import { env } from "./src/config/env";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRouter);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

