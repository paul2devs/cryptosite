import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    isAdmin: boolean;
    /** Reflects the persisted `users.email_verified` value, not a client flag. */
    emailVerified: boolean;
  };
}

/**
 * Authenticated-guard for every protected backend route.
 *
 * Besides verifying the JWT it loads the user record and enforces mandatory
 * email verification against the database, so an unverified account cannot
 * reach any protected API even if it presents a valid access token (for
 * example one signed before verification was introduced, or replayed after a
 * client-side flag was tampered with). Administrators are platform operators
 * and are exempt so back-office tooling keeps working.
 *
 * Failures are handled inside the function so the caller never sees an
 * unhandled rejection.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  let userId: string;
  try {
    const payload = verifyAccessToken(token);
    userId = payload.userId;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  try {
    const user = await User.findByPk(userId, {
      attributes: ["user_id", "is_admin", "email_verified"]
    });

    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    req.user = {
      userId: user.user_id,
      isAdmin: user.is_admin,
      emailVerified: user.email_verified
    };

    if (!user.email_verified && !user.is_admin) {
      res.status(403).json({
        message: "Please verify your email address before continuing.",
        code: "EMAIL_NOT_VERIFIED",
        category: "authorization"
      });
      return;
    }

    next();
  } catch {
    // Fail closed: if the verification check cannot be completed, the request
    // must not proceed.
    res.status(503).json({
      message: "The service is temporarily unable to validate your session. Please try again shortly."
    });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: "Platform access required" });
    return;
  }
  next();
}
