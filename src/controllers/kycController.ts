import { Request, Response, NextFunction } from "express";
import KYC from "../models/KYC";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import { AuthenticatedRequest } from "../types";
import { ApiResponse } from "../utils/response";

export const submitKYC = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const uCode = req.user.uCode;
    const { idProofType, category } = req.body;

    // Ensure all required fields are present
    const requiredFields = ["idProofType", "category"];
    const validationResult = await common.requestFieldsValidation(
      requiredFields,
      req.body
    );

    if (!validationResult.status) {
      throw new ApiError(
        400,
        `Missing fields: ${
          validationResult.missingFields?.join(", ") || "Unknown"
        }`
      );
    }

    // Check if KYC is already submitted
    const existingKYC = await KYC.findOne({ uCode });
    if (existingKYC) {
      res.status(400).json(new ApiResponse(400, {}, "KYC already submitted"));
    }

    // Ensure req.files exists before accessing it
    const { idProofFileFront, idProofFileBack } = (req.files || {}) as {
      idProofFileFront?: Express.Multer.File[];
      idProofFileBack?: Express.Multer.File[];
    };

    const newKYC = new KYC({
      uCode,
      idProofType,
      category,
      idProofFileFront: idProofFileFront?.length
        ? `/uploads/${idProofFileFront[0].filename}`
        : undefined,
      idProofFileBack: idProofFileBack?.length
        ? `/uploads/${idProofFileBack[0].filename}`
        : undefined,
    });

    await newKYC.save();

    res
      .status(201)
      .json(new ApiResponse(201, newKYC, "KYC submitted successfully"));
  } catch (error) {
    next(error);
  }
};

export const getUserKYCDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }
    const uCode = req.user.uCode;
    const kyc = await KYC.findOne({ uCode });

    if (!kyc) {
      throw new ApiError(404, "KYC not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, kyc, "Get User KYC detail Successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateKYCStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { status } = req.body;
  const kycId = req.params.id;
  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }
    if (!["pending", "approved", "rejected"].includes(status)) {
      throw new ApiError(400, "Invalid status");
    }

    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      throw new ApiError(404, "KYC not found");
    }

    kyc.status = status;
    await kyc.save();

    res
      .status(200)
      .json(new ApiResponse(200, {}, "KYC status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateUserKYC = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const uCode = req.user.uCode;

    // Find existing KYC record
    const existingKYC = await KYC.findOne({ uCode });
    if (!existingKYC) {
      throw new ApiError(404, "KYC record not found. Please submit KYC first.");
    }

    if (existingKYC.status === "approved") {
      throw new ApiError(400, "Cannot update an approved KYC record.");
    }

    // Ensure req.files exists before destructuring
    const { idProofFileFront, idProofFileBack } = (req.files || {}) as {
      idProofFileFront?: Express.Multer.File[];
      idProofFileBack?: Express.Multer.File[];
    };

    if (idProofFileFront?.length) {
      existingKYC.idProofFileFront = `/uploads/${idProofFileFront[0].filename}`;
    }

    if (idProofFileBack?.length) {
      existingKYC.idProofFileBack = `/uploads/${idProofFileBack[0].filename}`;
    }

    // Only update if fields are provided
    if (req.body.idProofType) {
      existingKYC.idProofType = req.body.idProofType;
    }

    if (req.body.category) {
      existingKYC.category = req.body.category;
    }

    await existingKYC.save();

    res
      .status(200)
      .json(new ApiResponse(200, existingKYC, "KYC updated successfully"));
  } catch (error) {
    next(error);
  }
};

export default {
  submitKYC,
  getUserKYCDetail,
  updateKYCStatus,
  updateUserKYC,
};
