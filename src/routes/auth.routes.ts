import { Router } from "express";
import { registerUser, loginUser } from "../controllers/user.auth.controller.ts";
import { registerAdmin, loginAdmin } from "../controllers/admin.auth.controller.ts";
import { registerAgent, loginAgent } from "../controllers/agent.auth.controller.ts";

const router = Router();

// User routes
router.post("/user/register", registerUser);
router.post("/user/login", loginUser);

// Admin routes
router.post("/admin/register", registerAdmin);
router.post("/admin/login", loginAdmin);

// Agent routes
router.post("/agent/register", registerAgent);
router.post("/agent/login", loginAgent);

export default router;

