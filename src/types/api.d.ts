import { Request } from "express";

export interface IApiResponse<T = any> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
  pagination?: { total: number; page: number; limit: number };
}

interface AuthenticatedUser {
  uCode: string;
  username: string;
  name: string;
  role: "User" | "Admin";
}

// Extend Request type for authenticated routes
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
