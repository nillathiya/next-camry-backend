import { Request, Response, NextFunction } from "express";
import { verifyJWT, JwtPayload } from "../helpers/auth";
import { ApiError } from "../utils/error";

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    uCode: string;
    username: string;
    role: string;
  };
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new ApiError(401, "No token provided");
  }

  try {
    const decoded = verifyJWT(token) as JwtPayload;

    if (!decoded._id) {
      throw new ApiError(401, "Invalid token payload: _id missing");
    }

    const authReq = req as AuthRequest;
    authReq.user = {
      uCode: decoded._id.toString(),
      username: decoded.username ? decoded.username.toString() : "",
      role: decoded.role ? decoded.role.toString() : "",
    };

    // console.log("req.user set to:", authReq.user);
    next();
  } catch (error) {
    console.error("Auth error:", error);
    throw new ApiError(401, "Invalid or expired token");
  }
}

export default auth;
