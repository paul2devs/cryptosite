import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    isAdmin: boolean;
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  const bearerToken = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  const cookieToken =
    typeof req.cookies?.accessToken === "string" && req.cookies.accessToken.length > 0
      ? req.cookies.accessToken
      : null;
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, isAdmin: payload.isAdmin };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

