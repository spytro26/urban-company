import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/index.ts";
import { env } from "../config/env.ts";

export async function registerAgent(
  req: Request,
  res: Response
): Promise<void> {
  const {
    email,
    password,
    name,
    type,
    address,
    pin,
    profilepic,
    id_proof,
    address_proof,
  } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    type?: string;
    address?: string;
    pin?: string;
    profilepic?: string;
    id_proof?: string;
    address_proof?: string;
  };

  if (!email || !password || !name || !type || !address || !pin) {
    res.status(400).json({
      message: "Required fields: email, password, name, type, address, pin",
      optional: ["profilepic", "id_proof", "address_proof"],
    });
    return;
  }

  const existing = await prisma.agent.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email is already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const agent = await prisma.agent.create({
    data: {
      email,
      password: hashedPassword,
      name,
      type,
      address,
      pin,
      ...(profilepic && { profilepic }),
      ...(id_proof && { id_proof }),
      ...(address_proof && { address_proof }),
    },
  });

  res.status(201).json({
    message: "Agent registered successfully",
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      type: agent.type,
      address: agent.address,
      pin: agent.pin,
      isVerified: agent.isVerified,
    },
  });
}

export async function loginAgent(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, agent.password);
  if (!passwordMatch) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { id: agent.id, email: agent.email, role: "AGENT" },
    env.JWT_AGENT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );

  res.status(200).json({
    message: "Login successful",
    token,
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      type: agent.type,
      isVerified: agent.isVerified,
      isAvailable: agent.isAvailable,
    },
  });
}
