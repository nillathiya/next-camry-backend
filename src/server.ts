import express, { Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { connectMongoDB, connectMongoose } from "./config/db";
import path from "path";
import { ApiError } from "./utils/error";
import routes from "./routes/index";
import cors from "cors";
import { handleFileUploadError } from "./utils/multer";
import cookieParser from "cookie-parser";
import { initializeSocket } from "./socket/soketHandler";
import session from "express-session";

config();
const app = express();
const PORT: number = parseInt(process.env.PORT as string, 10) || 5198;

const FRONT_URL = process.env.FRONT_URL || "";
const ADMIN_URL = process.env.ADMIN_URL || "";
// Enable CORS
app.use(
  cors({
    origin: [
      "http://localhost:4000",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      FRONT_URL,
      ADMIN_URL,
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "xyz",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // set to true in production with HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// Test route
app.get("/", (req: Request, res: Response) => {
  res.send("Yeah Yeah, you visited and we noticed!");
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Start the server after DB connections and route configuration
(async () => {
  try {
    await Promise.all([connectMongoDB(), connectMongoose()]);
    console.log("Both database connections established");

    const configuredRoutes = await routes;
    app.use(configuredRoutes);

    // Error handling middleware
    app.use(handleFileUploadError);
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof ApiError) {
        res.status(err.statusCode).json({
          statusCode: err.statusCode,
          message: err.message,
          errors: err.errors,
          success: false,
          data: null,
        });
      } else if ((err as any).name === "ValidationError") {
        const validationErrors = Object.values((err as any).errors).map(
          (error: any) => `${error.path}: ${error.message}`
        );

        res.status(400).json({
          statusCode: 400,
          message: "Validation failed",
          errors: validationErrors,
          success: false,
          data: null,
        });
      } else if ((err as any).code === 11000) {
        const duplicatedField = Object.keys((err as any).keyValue)[0];
        res.status(400).json({
          statusCode: 400,
          message: `Duplicate value error: ${duplicatedField} must be unique.`,
          success: false,
          data: null,
        });
      } else {
        console.error("Unhandled error:", err);
        res.status(500).json({
          statusCode: 500,
          message: "Internal server error",
          success: false,
          data: null,
        });
      }
    });

    // Initialize Socket.io and start server
    const server = initializeSocket(app);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
