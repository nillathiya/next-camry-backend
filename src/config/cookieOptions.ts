// src/config/cookieOptions.ts
import { CookieOptions } from "express";

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // Changed from "strict" to allow cross-subdomain requests
  domain: process.env.NODE_ENV === "production" ? ".t-safe.io" : "localhost", // Dynamic domain
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};