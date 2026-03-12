import jwt from "jsonwebtoken";
import { requireEnv } from "../config/env";

export interface JwtPayload {
  userId: string;
  isAdmin: boolean;
}

const accessSecret = requireEnv("JWT_ACCESS_SECRET");
const refreshSecret = requireEnv("JWT_REFRESH_SECRET");

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, accessSecret, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, refreshSecret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, refreshSecret) as JwtPayload;
}

