import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import { Op } from "sequelize";
import { User } from "../models/User";
import { JwtPayload, signAccessToken, signRefreshToken } from "../utils/jwt";
import { trackUserActivity } from "../services/activityService";

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  try {
    const user = await User.findOne({
      where: {
        email: { [Op.iLike]: String(email).trim() }
      }
    });

    if (!user || !user.is_admin) {
      res.status(401).json({ message: "Invalid admin credentials" });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ message: "Invalid admin credentials" });
      return;
    }

    const payload: JwtPayload = { userId: user.user_id, isAdmin: true };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.status(200).json({
      admin: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        is_admin: true
      },
      accessToken,
      refreshToken
    });

    await trackUserActivity(user.user_id, "login", { source: "admin_login" });
  } catch {
    res.status(500).json({ message: "Admin login failed" });
  }
}

