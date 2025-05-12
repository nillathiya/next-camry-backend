import { NextFunction, Request, Response } from "express";
import CompanyInfo from "../models/companyInfo";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest } from "../types";

export const createCompanyInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, title, slug, type, value, description, adminStatus, status } =
      req.body;

    const validateFields = ["name", "title", "slug", "type"];
    const response = await common.requestFieldsValidation(
      validateFields,
      req.body
    );

    if (!response.status) {
      throw new ApiError(
        400,
        `Missing fields: ${response.missingFields?.join(", ") || "Unknown"}`
      );
    }

    const companyInfo = new CompanyInfo({
      ...req.body,
      adminStatus: adminStatus ?? 0,
      status: status ?? 0,
    });

    const savedCompanyInfo = await companyInfo.save();
    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          savedCompanyInfo,
          "CompanyInfo created Successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Get all company info
export const getAllCompanyInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyInfos = await CompanyInfo.find({ status: 1 }).lean();
    res
      .status(200)
      .json(
        new ApiResponse(200, companyInfos, "Get All CompanyInfo Successfully")
      );
  } catch (error) {
    next(error);
  }
};

export const getAllCompanyInfoForAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Only Authorized For Admin");
    }
    const companyInfos = await CompanyInfo.find({ adminStatus: 1 }).lean();
    res
      .status(200)
      .json(
        new ApiResponse(200, companyInfos, "Get All CompanyInfo Successfully")
      );
  } catch (error) {
    next(error);
  }
};

export const updateCompanyInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const updatedData = req.body;
  const file = req.file;

  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "UnAuthorized Access");
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    const companyInfo = await CompanyInfo.findById(id);

    if (!companyInfo) {
      res.status(404).json({ message: "Company info not found" });
      return;
    }

    Object.assign(companyInfo, updatedData);

    if (file) {
      companyInfo.value = `/uploads/${file.filename}`;
    }

    const updatedCompanyInfo = await companyInfo.save();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedCompanyInfo,
          "CompanyInfo Updated Successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

export const deleteCompanyInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    const companyInfo = await CompanyInfo.findByIdAndDelete(id);

    if (!companyInfo) {
      throw new ApiError(400, "CompanyInfo Not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Company info deleted successfully"));
  } catch (error) {
    next(error);
  }
};

export default {
  createCompanyInfo,
  getAllCompanyInfoForAdmin,
  getAllCompanyInfo,
  updateCompanyInfo,
  deleteCompanyInfo,
};
