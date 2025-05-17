import { Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import Plan, { IPlan } from "../models/plan";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest } from "../types";
import common from "../helpers/common";

interface CreatePlanBody {
  title: string;
  value: string[];
  colIndex: number;
}

interface UpdatePlanBody {
  title?: string;
  value?: string[];
  slug?: string;
}

interface UpdateRowBody {
  rowIndex: number;
  value: string;
}

export const createPlan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { title, value, colIndex } = req.body as CreatePlanBody;

  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    const validateFields = ["title", "value"];
    const response = await common.requestFieldsValidation(validateFields, {
      title,
      value,
    });

    if (!response.status) {
      throw new ApiError(
        400,
        `Missing fields: ${response.missingFields?.join(", ")}`
      );
    }

    if (typeof colIndex !== "number" || colIndex < 0) {
      throw new ApiError(400, "Invalid column index");
    }

    await Plan.updateMany(
      { order: { $gte: colIndex } },
      { $inc: { order: 1 } }
    );
    const slug = await common.generateSlug(title);
    const newPlan = new Plan({ title, slug, value, order: colIndex });
    await newPlan.save();

    res
      .status(201)
      .json(new ApiResponse(201, newPlan, "Plan created successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePlan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updatedData = req.body as UpdatePlanBody;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    if (updatedData.title) {
      updatedData.slug = await common.generateSlug(updatedData.title);
    }

    const updatedPlan = await Plan.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    if (!updatedPlan) {
      throw new ApiError(404, "Plan not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, updatedPlan, "Plan updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await Plan.find({}).sort({ order: 1 });
    res
      .status(200)
      .json(new ApiResponse(200, plans, "Plans fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const deletedOrder = plan.order;
    await Plan.findByIdAndDelete(req.params.id);
    await Plan.updateMany(
      { order: { $gt: deletedOrder } },
      { $inc: { order: -1 } }
    );
    res.status(200).json(new ApiResponse(200, {}, "Plan deleted"));
  } catch (error) {
    next(error);
  }
};

export const addRow = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { value } = req.body;
    const planId = req.params.id;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }

    plan.value.push(value || "");
    await plan.save();

    res.status(200).json(new ApiResponse(200, plan, "Row added successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateRow = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowIndex, value } = req.body as UpdateRowBody;
    const planId = req.params.id;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    if (typeof rowIndex !== "number" || rowIndex < 0) {
      throw new ApiError(400, "Invalid row index");
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }

    for (let i = 0; i < rowIndex; i++) {
      const currentValue = plan.value[i];
      const cleanedValue =
        typeof currentValue === "string" ? currentValue.trim() : currentValue;

      if (!cleanedValue) {
        throw new ApiError(
          400,
          "Please fill in all values above the current row"
        );
      }
    }

    plan.value[rowIndex] = value;
    await plan.save();

    res
      .status(200)
      .json(new ApiResponse(200, plan, "Row updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const deleteRow = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowIndex } = req.body;
    const planId = req.params.id;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    if (typeof rowIndex !== "number" || rowIndex < 0) {
      throw new ApiError(400, "Invalid row index");
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }

    if (rowIndex >= plan.value.length) {
      throw new ApiError(400, "Row index out of bounds");
    }

    plan.value.splice(rowIndex, 1);
    await plan.save();

    res
      .status(200)
      .json(new ApiResponse(200, plan, "Row deleted successfully"));
  } catch (error) {
    next(error);
  }
};
