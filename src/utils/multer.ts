import multer, { StorageEngine } from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import dateUtils from "../utils/date";
import { ApiError } from "../utils/error";
import { Request, Response, NextFunction } from "express";

// Configuration
const uploadFolder: string =
  process.env.UPLOAD_FOLDER || path.resolve("./public/uploads");
const maxFileSize: number =
  Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // Default to 10MB

// Ensure the upload folder exists
const ensureUploadFolderExists = (): void => {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
  }
};

// Define storage configuration for multer
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadFolderExists();
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const readableDate = dateUtils.getCurrentDate();
    const uniqueFilename = `${readableDate}_${uuidv4()}_${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// Define multer upload with limits and file type filter
const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize, // Configurable max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(
        new Error("Invalid file type. Only images and PDFs are allowed.")
      );
    }
  },
});

const handleFileUploadError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    return next(new ApiError(400, err.message));
  }
  if (err instanceof ApiError) {
    return next(err);
  }
  next(err);
};

export { upload, handleFileUploadError };
