import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest, IWalletSettingsQuery } from "../types";
import { ApiError } from "../utils/error";
import common from "../helpers/common";
import {
  createWalletSettings,
  findWalletSettings,
  findWalletSettingsById,
  updateWalletSettings,
  WalletSettings,
} from "../models/walletSettings";

export async function createWalletSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const postData = req.body;

  try {
    // Required fields validation
    const requiredFields = ["slug", "name", "wallet", "type"];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      req.body
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }
    const data = req.body as Omit<
      WalletSettings,
      "_id" | "createdAt" | "updatedAt"
    >;
    const result = await createWalletSettings(data);
    res
      .status(201)
      .json(
        new ApiResponse(201, result, "Wallet setting created successfully")
      );
  } catch (error) {
    next(error);
  }
}

export async function getWalletSettingsById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const setting = await findWalletSettingsById(id);

    if (!setting) {
      throw new ApiError(401, "Wallet setting not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, setting, "Wallet setting get successfully"));
  } catch (error) {
    next(error);
  }
}

export async function getWalletSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    const query: IWalletSettingsQuery = { ...req.query };
    query.status = 1;

    const settings = await findWalletSettings(query);
    console.log("settings", settings);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          settings,
          "Wallet settings retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}
export async function updateWalletSetting(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "You are unauthorized to perfomr this action ");
    }
    const { id } = req.params;
    const update = req.body as Partial<WalletSettings>;

    await updateWalletSettings(id, update);
    const updatedSettings = await findWalletSettingsById(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedSettings,
          "Wallet setting updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export default {
  createWalletSetting,
  getWalletSettingsById,
  getWalletSettings,
  updateWalletSetting,
};
