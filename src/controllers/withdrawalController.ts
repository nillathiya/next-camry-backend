import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import mongoose from "mongoose";
import WithdrawalMethod from "../models/WithdrawalMethod";
import UserWithdrawalAccount from "../models/UserWithdrawalAccount";
import WithdrawalAccountType from "../models/WithdrawalAccountType";
import DepositMethodModel from "../models/depositMethod";
import DepositAccountModel from "../models/depositAccount";
import FundTransactionModel from "../models/fundTransaction";
import { FundTransaction as IFundTransaction } from "../models/fundTransaction";
import { promises } from "dns";
import { ObjectId } from "mongodb";
import common from "../helpers/common";
import UserModel from "../models/user";
import WalletModel from "../models/wallet";
import { manageWalletAmounts, getWalletBalanceBySlug } from "../helpers/wallet";
import { AuthenticatedRequest } from "../types";
import IncomeTransactionModel from "../models/incomeTransaction";
import settings from "../helpers/settings";
import { findOTPByUsername } from "../models/otp";
// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

export async function addWithdrawalMethod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, slug } = req.body;

    const existingMethod = await WithdrawalMethod.findOne({ name });
    if (existingMethod) {
      return next(new ApiError(400, "Withdrawal method already exists"));
    }

    // Create a new withdrawal method
    const newMethod = new WithdrawalMethod({ name, slug });
    await newMethod.save();

    res
      .status(201)
      .json(
        new ApiResponse(201, newMethod, "Withdrawal method added successfully")
      );
  } catch (error) {
    next(error);
  }
}

export async function getAllWithdrawalMethods(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }
    const filter: any = {};
    if (req.user.role === "User") {
      filter.isActive = true;
    }
    const methods = await WithdrawalMethod.find(filter);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          methods,
          "Withdrawal methods retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function addWithdrawalAccountType(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { methodId, name, requiredFields } = req.body;
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    // Validate required fields
    const requiredFieldsArray = ["methodId", "name", "requiredFields"];
    const validation = await common.requestFieldsValidation(
      requiredFieldsArray,
      req.body
    );

    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    const method = await WithdrawalMethod.findById(methodId);
    if (!method || !method.isActive) {
      return next(new ApiError(400, "Invalid or inactive withdrawal method"));
    }

    const existingType = await WithdrawalAccountType.findOne({
      methodId,
      name,
    });
    if (existingType) {
      return next(new ApiError(400, "Withdrawal account type already exists"));
    }

    if (
      !requiredFields ||
      typeof requiredFields !== "object" ||
      Array.isArray(requiredFields) ||
      Object.values(requiredFields).some((val) => typeof val !== "string")
    ) {
      return next(
        new ApiError(
          400,
          "Invalid requiredFields format, values must be strings"
        )
      );
    }

    const formattedRequiredFields = new Map(Object.entries(requiredFields));

    const newAccountType = new WithdrawalAccountType({
      methodId,
      name,
      requiredFields: formattedRequiredFields,
    });

    await newAccountType.save();

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          newAccountType,
          "Withdrawal account type added successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function updateWithdrawalAccountType(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { id } = req.params;
  const { requiredFields } = req.body;

  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const accountType = await WithdrawalAccountType.findById(id);
    if (!accountType) {
      return next(new ApiError(404, "Withdrawal account type not found"));
    }

    if (
      requiredFields &&
      (typeof requiredFields !== "object" ||
        Array.isArray(requiredFields) ||
        Object.values(requiredFields).some((val) => typeof val !== "string"))
    ) {
      return next(
        new ApiError(
          400,
          "Invalid requiredFields format, values must be strings"
        )
      );
    }

    if (requiredFields) {
      const updatedFields = new Map(accountType.requiredFields);

      for (const [key, value] of Object.entries(requiredFields)) {
        if (typeof value === "string") {
          updatedFields.set(key, value);
        } else {
          updatedFields.delete(key);
        }
      }

      accountType.requiredFields = updatedFields;
    }

    await accountType.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          accountType,
          "Withdrawal account type updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function getAllWithdrawalAccountTypes(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const methodId = req.query.methodId as string | undefined;
    const filter: Record<string, any> = {};

    if (req.user.role === "User") {
      filter.isActive = true;
    }
    if (methodId) {
      filter.methodId = methodId;
    }

    const types = await WithdrawalAccountType.find(filter).lean();
    res
      .status(200)
      .json(
        new ApiResponse(200, types, "Withdrawal types retrieved successfully")
      );
  } catch (error) {
    next(error);
  }
}

export async function AddWithdrawalAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }
    const { accountTypeId, details } = req.body;
    const withdrawalAccountOtp = await settings.fetchUserSettingsBySlug("userSettings", "withdrawal_account_otp");
    if (withdrawalAccountOtp && withdrawalAccountOtp.value === "yes") {
      const { otp } = req.body;
      if (!otp) {
        throw new ApiError(400, "Otp is required");
      }
      const user = await UserModel.findById(req.user.uCode);
      if (!user) {
        throw new ApiError(400, "User not found");
      }
      const storedOTP = await findOTPByUsername(req.user.username);
      if (!storedOTP) {
        throw new ApiError(400, "Server Error,Please try again");
      }
      if (storedOTP.code !== otp) {
        throw new ApiError(400, "Invalid Otp");
      }
    }
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    // Validate required fields
    const requiredFields = ["accountTypeId", "details"];
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

    // ✅ Await the query properly
    const existUserAccountType = await UserWithdrawalAccount.findOne({
      accountTypeId,
      userId: req.user.uCode,
      isActive: true,
    });

    if (existUserAccountType) {
      throw new ApiError(
        400,
        "User already has an active account of this type"
      );
    }

    const accountType = await WithdrawalAccountType.findById(accountTypeId);
    if (!accountType || !accountType.isActive) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    if (!accountType.requiredFields) {
      return res
        .status(400)
        .json({ message: "Required fields are not defined" });
    }

    // ✅ Ensure `accountType.requiredFields` is properly handled if it's a Map
    const requiredFieldKeys = Array.from(accountType.requiredFields.keys());

    for (const field of requiredFieldKeys) {
      if (!details?.[field]) {
        return res.status(400).json({ message: `Missing ${field}` });
      }
    }

    const account = new UserWithdrawalAccount({
      userId: req.user.uCode,
      accountTypeId,
      details,
    });

    await account.save();
    const populatedAccount = await account.populate("accountTypeId");
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedAccount,
          "Withdrawal account created successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function getAllUserWithdrawalAccounts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const filter: any = {};
    if (req.user.role === "User") {
      filter.userId = req.user.uCode;
      filter.isActive = true;
    }

    const accounts = await UserWithdrawalAccount.find(filter).populate({
      path: "accountTypeId",
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          accounts,
          "User withdrawal accounts retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function disableUserWithdrawalAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  const { id } = req.params;
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }
    const account = await UserWithdrawalAccount.findById(id);

    if (!account || account.userId.toString() !== req.user.uCode.toString()) {
      return res.status(404).json({ message: "Account not found" });
    }

    account.isActive = false;
    account.updatedAt = new Date();

    await account.save();

    res
      .status(200)
      .json(new ApiResponse(200, account, "Account disabled successfully"));
  } catch (error) {
    next(error);
  }
}
export default {
  addWithdrawalMethod,
  getAllWithdrawalMethods,
  getAllWithdrawalAccountTypes,
  AddWithdrawalAccount,
  getAllUserWithdrawalAccounts,
  disableUserWithdrawalAccount,
  addWithdrawalAccountType,
  updateWithdrawalAccountType,
};
