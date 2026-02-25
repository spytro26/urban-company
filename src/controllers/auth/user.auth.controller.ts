import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../../db/index.ts";
import { env } from "../../config/env.ts";

export async function registerUser(req: Request, res: Response): Promise<void> {
  const {
    email,
    password,
    address,
    pin,
    profilepic,
  } = req.body as {
    email?: string;
    password?: string;
    address?: string;
    pin?: string;
    profilepic?: string;
  };

  if (!email || !password || !address || !pin) {
    res.status(400).json({
      message: "Required fields: email, password, address, pin",
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email is already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      address,
      pin,
      ...(profilepic && { profilepic }),
    },
  });

  res.status(201).json({
    message: "Registration successful",
    user: {
      id: user.id,
      email: user.email,
      address: user.address,
      pin: user.pin,
    },
  });
}

export async function loginUser(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: "USER" },
    env.JWT_USER_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );

  res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      address: user.address,
      pin: user.pin,
    },
  });
}
