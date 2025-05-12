import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import mongoose from "mongoose";

import DepositMethod from "../models/depositMethod";
import DepositAccount from "../models/depositAccount";
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
import UserWithdrawalAccount from "../models/UserWithdrawalAccount";
import WithdrawalAccountType, {
  findWithdrawalAccountId,
  IWithdrawalAccountType,
} from "../models/WithdrawalAccountType";
import { findWithdrawalMethodId } from "../models/WithdrawalMethod";
import { initiateWithdrawal } from "../helpers/ctpeway";
import settings, {
  fetchAllUserSettings,
  fetchUserSettingsBySlug,
} from "../helpers/settings";
import DepositAccountModel from "../models/depositAccount";
import { companyInfoHelper } from "../helpers/companyInfo";
import { deleteOTPByUsername, findOTPByUsername } from "../models/otp";
import { JsonWebTokenError } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { findMany } from "../helpers/db";
import { findUserSettings, UserSettings } from "../models/userSettings";
import { title } from "process";
import { del } from "request-promise";
import { sendMessage } from "../utils/whatsapp";
import transactionHelper from "../helpers/transaction";

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

interface BinanceAvgPriceResponse {
  mins: number;
  price: string; // Binance returns price as a string
}
// Profile function
export async function getAllDepositMethods(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> {
  try {
    const depositMethods = await DepositMethod.find();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          depositMethods,
          "Deposit methods retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function getAllDepositeAccounts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const depositAccounts = await DepositAccount.find();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          depositAccounts,
          "Deposit Accounts retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: { uCode: string };
}

// CREATE - Add new fund transaction
export const createFundTransactionController = async (
  req: MulterRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const vsUser = req.user; // From auth middleware
  const file = req.file; // From multer middleware
  const postData = req.body;

  try {
    console.log("vsUser", vsUser);
    const {
      txUCode,
      txType,
      debitCredit,
      fromWalletType,
      walletType,
      amount,
      txCharge,
      txNumber,
      method,
      account,
      response,
      isRetrieveFund,
      status,
    } = postData;

    // Required fields validation
    const requiredFields = [
      "txType",
      "debitCredit",
      "amount",
      "walletType",
      "method",
      "account",
    ];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      postData
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    // Validate amount
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ApiError(400, "Amount must be a positive number");
    }

    // Validate txUCode if provided
    if (txUCode) {
      if (!isValidObjectId(txUCode)) {
        throw new ApiError(400, "Invalid txUCode");
      }
      const user = await UserModel.findById(txUCode);
      if (!user) {
        throw new ApiError(404, "Transaction user not found");
      }
    }

    // Validate uCode from req.user
    if (!vsUser) {
      throw new ApiError(401, "Unauthorized: Invalid user");
    }

    // Get last transaction balance
    const lastTransaction = await FundTransactionModel.findOne({
      uCode: vsUser.uCode,
      txType,
    }).sort({ createdAt: -1 });

    const previousBalance = lastTransaction?.postWalletBalance || 0;
    let newBalance = previousBalance;

    // Calculate new balance
    if (debitCredit === "DEBIT") {
      newBalance -= parsedAmount;
    } else if (debitCredit === "CREDIT") {
      newBalance += parsedAmount;
    } else {
      throw new ApiError(
        400,
        "Invalid debitCredit value; must be 'DEBIT' or 'CREDIT'"
      );
    }

    if (newBalance < 0) {
      throw new ApiError(400, "Insufficient balance");
    }

    // Prepare transaction data
    const transactionData: Omit<
      IFundTransaction,
      "_id" | "createdAt" | "updatedAt"
    > = {
      uCode: vsUser.uCode ? new ObjectId(vsUser.uCode) : null,
      txUCode: txUCode ? new ObjectId(txUCode) : null,
      txType,
      debitCredit,
      fromWalletType,
      walletType,
      amount: parsedAmount,
      txCharge: txCharge ? Number(txCharge) : undefined,
      paymentSlip: file ? `/uploads/${file.filename}` : undefined,
      txNumber,
      postWalletBalance: newBalance,
      currentWalletBalance: previousBalance,
      method,
      account,
      response,
      isRetrieveFund: isRetrieveFund ?? false,
      status: status ?? 0,
    };

    // Create the transaction
    const newTransaction = await FundTransactionModel.create(transactionData);

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          newTransaction,
          "Fund transaction created successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

interface IGetAllFundTransactionQuery {
  txType?: string;
  status?: number | { $in: number[] }; // Updated to allow $in operator
  depositAccountType?: string;
  account?: { $in: mongoose.Types.ObjectId[] }; // Added to support account filter
}

export const getAllFundTransactions = async (
  req: MulterRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { txType, status, depositAccountType } = req.query as {
    txType?: string;
    status?: string | string[];
    depositAccountType?: string;
  };
  try {
    const query: IGetAllFundTransactionQuery = {};

    // Handle txType
    if (txType) {
      query.txType = txType; // Add validation if txType has specific allowed values
    }

    // Handle status (numeric)
    if (status) {
      const validStatuses = [0, 1, 2]; // Adjust based on your schema's allowed status values
      let statusArray: number[];

      if (Array.isArray(status)) {
        statusArray = status.map((s) => {
          const num = Number(s.trim());
          if (isNaN(num)) {
            throw new ApiError(
              400,
              `Invalid status value: ${s}. Must be a number`
            );
          }
          return num;
        });
      } else {
        statusArray = status.split(",").map((s) => {
          const num = Number(s.trim());
          if (isNaN(num)) {
            throw new ApiError(
              400,
              `Invalid status value: ${s}. Must be a number`
            );
          }
          return num;
        });
      }

      console.log("statusArray", statusArray);

      // Validate status values
      const invalidStatuses = statusArray.filter(
        (s) => !validStatuses.includes(s)
      );
      if (invalidStatuses.length > 0) {
        throw new ApiError(
          400,
          `Invalid status values: ${invalidStatuses.join(
            ", "
          )}. Must be one of: ${validStatuses.join(", ")}`
        );
      }

      query.status =
        statusArray.length === 1 ? statusArray[0] : { $in: statusArray };
    }

    // Handle depositAccountType
    if (depositAccountType) {
      const validAccountTypes = ["auto", "manual", "cash"];
      if (!validAccountTypes.includes(depositAccountType)) {
        throw new ApiError(
          400,
          `Invalid depositAccountType. Must be one of: ${validAccountTypes.join(
            ", "
          )}`
        );
      }

      const accounts = await DepositAccountModel.find({
        type: depositAccountType,
      }).select("_id");
      const accountIds = accounts.map((account) => account._id);
      if (accountIds.length === 0) {
        res
          .status(200)
          .json(
            new ApiResponse(
              200,
              [],
              "No transactions found for the specified account type"
            )
          );
        return;
      }
      query.account = { $in: accountIds };
    }

    const transactions = await FundTransactionModel.find(query)
      .populate("txUCode", "name email contactNumber username")
      .populate("uCode", "name email contactNumber username")
      .populate("withdrawalAccount", "name")
      .populate("withdrawalMethod", "name")
      .populate("withdrawalAccountType", "name")
      .populate("method", "name")
      .populate("account", "name type value"); // Removed 'type' unless needed

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          transactions.length
            ? "Fund transactions retrieved successfully"
            : "No transactions found"
        )
      );
  } catch (error) {
    next(error);
  }
};

export const getUserFundTransactions = async (
  req: MulterRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { txType } = req.query;

  try {
    if (!req.user?.uCode) {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    if (mongoose.connection.readyState !== 1) {
      throw new ApiError(503, "Database connection unavailable");
    }

    console.log("Querying transactions for uCode:", req.user.uCode);

    // Define query properly
    const query: { uCode: ObjectId; txType?: string } = {
      uCode: new ObjectId(req.user.uCode),
    };

    if (txType) {
      query.txType = txType as string;
    }

    // Use query in find() method
    const transactions = await FundTransactionModel.find(query)
      .populate("txUCode", "name email contactNumber username")
      .populate("uCode", "name email contactNumber username")
      .populate("withdrawalAccountType")
      .populate("withdrawalMethod")
      .populate({
        path: "withdrawalAccount",
        populate: {
          path: "accountTypeId",
        },
      })
      .limit(50)
      .lean()
      .exec();

    console.log("Retrieved:", transactions.length, "transactions");

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          "Fund transactions retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error in getUserFundTransactions:", error);
    next(error);
  }
};

export const userFundTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const postData = req.body;
  try {
    if (!req.user?.uCode || !req.user?.username) {
      throw new ApiError(401, "Unauthorized: User not found");
    }
    let creditAmount = parseFloat(postData.amount);

    const fundUserSettings = await findMany<UserSettings>("userSettings", {
      title: "Fund",
    });
    if (fundUserSettings.length > 0) {
      const fundTransferOtp = fundUserSettings
        .find((setting) => setting.slug === "fund_transfer_otp")
        ?.value?.toString();
      if (fundTransferOtp && fundTransferOtp === "yes") {
        const { otp } = req.body;
        if (!otp) {
          throw new ApiError(400, "OTP is required for fund transfer");
        }
        const user = await UserModel.findById(req.user.uCode);
        if (!user) {
          throw new ApiError(404, "User not found");
        }
        const storedOTP = await findOTPByUsername(req.user.username);
        if (!storedOTP) {
          throw new ApiError(400, "Server Error,Please try again");
        }
        if (storedOTP.code !== otp) {
          throw new ApiError(400, "Invalid Otp");
        }
        await deleteOTPByUsername(req.user.username);
      }
      const transferMinimum = fundUserSettings.find(
        (setting) => setting.slug === "transfer_minimum"
      )?.value;
      const minimum = parseFloat(transferMinimum as string);
      if (minimum && minimum > 0) {
        if (creditAmount < minimum) {
          throw new ApiError(400, `Minimum transfer amount is $${minimum}`);
        }
      }

      const transferCharge = fundUserSettings.find(
        (setting) => setting.slug === "transfer_charge"
      )?.value;
      const charge = parseFloat(transferCharge as string);
      if (charge && charge > 0) {
        creditAmount =
          parseFloat(postData.amount) -
          (charge * parseFloat(postData.amount)) / 100;
      }
    }

    // Required fields validation
    const requiredFields = ["username", "amount", "walletType", "debitCredit"];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      postData
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    // Validate amount
    if (isNaN(postData.amount) || postData.amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }

    // Find receiver user
    const receiverUser = await UserModel.findOne({
      username: postData.username,
    });
    if (!receiverUser) {
      throw new ApiError(400, "Receiver user not found");
    }

    let senderId = req.user.uCode;
    let receiverId = receiverUser._id;
    let senderUsername = req.user.username;
    let receiverUsername = receiverUser.username;

    // Determine transaction direction
    if (postData.debitCredit === "DEBIT") {
      // Deduct from sender
      const updateSenderWallet = await manageWalletAmounts(
        senderId,
        postData.walletType,
        -postData.amount
      );
      if (!updateSenderWallet.status) {
        throw new ApiError(400, updateSenderWallet.message);
      }

      // Credit to receiver
      const updateReceiverWallet = await manageWalletAmounts(
        receiverId,
        postData.walletType,
        creditAmount
      );
      if (!updateReceiverWallet.status) {
        throw new ApiError(400, updateReceiverWallet.message);
      }
    } else if (postData.debitCredit === "CREDIT") {
      // Deduct from receiver
      const updateReceiverWallet = await manageWalletAmounts(
        receiverId,
        postData.walletType,
        -postData.amount
      );
      if (!updateReceiverWallet.status) {
        throw new ApiError(400, updateReceiverWallet.message);
      }

      // Credit to sender
      const updateSenderWallet = await manageWalletAmounts(
        senderId,
        postData.walletType,
        creditAmount
      );
      if (!updateSenderWallet.status) {
        throw new ApiError(400, updateSenderWallet.message);
      }

      // Swap sender and receiver for the transaction record
      [senderId, receiverId] = [receiverId, senderId];
      [senderUsername, receiverUsername] = [receiverUsername, senderUsername];
    } else {
      throw new ApiError(
        400,
        "Invalid debitCredit type. Must be 'DEBIT' or 'CREDIT'"
      );
    }

    // Prepare the transaction payload
    const transactionPayload = {
      txUCode: receiverId,
      uCode: senderId,
      txType: postData.txType || "fund_transfer",
      debitCredit: postData.debitCredit,
      walletType: postData.walletType,
      amount: postData.amount,
      status: 1,
      isRetrieveFund: postData.isRetrieveFund || false,
      txStatus: 1,
      remark: `${senderUsername} sent $${postData.amount} to ${receiverUsername}`,
    };

    const newTransaction = new FundTransactionModel(transactionPayload);
    await newTransaction.save();

    // Populate transaction with user details
    const populatedTransaction = {
      ...transactionPayload,
      txUCode: {
        _id: receiverId,
        username: receiverUsername || "",
      },
      uCode: {
        _id: senderId,
        username: senderUsername || "",
      },
      createdAt: newTransaction.createdAt,
      updatedAt: newTransaction.updatedAt,
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedTransaction,
          "Transaction completed successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const userFundConvert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postData = req.body;

    if (!req.user) {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    // Required fields validation
    const requiredFields = ["amount", "fromWalletType", "walletType"];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      postData
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    // Validate amount
    if (isNaN(postData.amount) || postData.amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }
    let creditAmount = parseFloat(postData.amount);
    const fundUserSettings = await findMany<UserSettings>("userSettings", {
      title: "Fund",
    });
    if (fundUserSettings.length > 0) {
      const convertCharge = fundUserSettings.find(
        (setting) => setting.slug === "convert_charge"
      )?.value;
      const charge = parseFloat(convertCharge as string);
      if (charge && charge > 0) {
        creditAmount =
          parseFloat(postData.amount) -
          (charge * parseFloat(postData.amount)) / 100;
      }
    }

    let userId = req.user.uCode;

    // Deduct from "fromWalletType"
    const updateUserFromWallet = await manageWalletAmounts(
      userId,
      postData.fromWalletType,
      -postData.amount
    );
    if (!updateUserFromWallet.status) {
      throw new ApiError(400, updateUserFromWallet.message);
    }

    // Add to "walletType"
    const updateUserToWallet = await manageWalletAmounts(
      userId,
      postData.walletType,
      creditAmount
    );

    // Rollback deduction if credit fails
    if (!updateUserToWallet.status) {
      await manageWalletAmounts(
        userId,
        postData.fromWalletType,
        postData.amount
      );
      throw new ApiError(400, updateUserToWallet.message);
    }

    // Prepare the transaction payload
    const transactionPayload = {
      uCode: userId,
      txType: postData.txType || "fund_convert",
      debitCredit: "DEBIT",
      walletType: postData.walletType,
      fromWalletType: postData.fromWalletType,
      amount: postData.amount,
      // method: "ONLINE",
      status: 1,
      isRetrieveFund: postData.isRetrieveFund || false,
      txStatus: 1,
      remark: `${req.user.username || "N/A"} converted $${
        postData.amount
      } from ${postData.fromWalletType} to ${postData.walletType}`,
    };

    const newTransaction = new FundTransactionModel(transactionPayload);
    await newTransaction.save();

    // Populate transaction with user details
    const populatedTransaction = {
      ...transactionPayload,
      uCode: {
        _id: req.user.uCode,
        username: req.user.username || "",
      },
      createdAt: newTransaction.createdAt,
      updatedAt: newTransaction.updatedAt,
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedTransaction,
          "Transaction completed successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const userFundManualWithdrawal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postData = req.body;

    if (!req.user) {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    const requiredFields = [
      "txType",
      "debitCredit",
      "amount",
      "walletType",
      "accountTypeId",
    ];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      postData
    );
    const withdrawalAccountOtp = await settings.fetchUserSettingsBySlug(
      "userSettings",
      "withdrawal_account_otp"
    );
    if (withdrawalAccountOtp && withdrawalAccountOtp.value === "yes") {
      const { otp } = req.body;
      if (!otp) {
        throw new ApiError(400, "OTP is required for withdrawal");
      }
      const user = await UserModel.findById(req.user.uCode);
      if (!user) {
        throw new ApiError(404, "User not found");
      }
      const storedOTP = await findOTPByUsername(req.user.username);
      if (!storedOTP) {
        throw new ApiError(400, "Server Error,Please try again");
      }
      if (storedOTP.code !== otp) {
        throw new ApiError(400, "Invalid Otp");
      }
    }

    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    if (isNaN(postData.amount) || postData.amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }

    const accountTypeCheck = await WithdrawalAccountType.findById(
      postData.accountTypeId
    );
    if (!accountTypeCheck) {
      throw new ApiError(404, "Withdrawal account type not found");
    }

    const companyWithdrawalAccount = await findWithdrawalAccountId(
      accountTypeCheck._id as ObjectId
    );
    const withdrawalCharge = await fetchUserSettingsBySlug(
      "userSettings",
      "withdrawal_charge"
    );
    if (!withdrawalCharge) {
      throw new ApiError(404, "Withdrawal charge not found");
    }

    if (!companyWithdrawalAccount) {
      throw new ApiError(404, "Withdrawal account not found in the system");
    }

    if (!companyWithdrawalAccount.isActive) {
      throw new ApiError(404, "Withdrawal account is not active in the system");
    }

    const withdrawMethodData = await findWithdrawalMethodId(
      companyWithdrawalAccount.methodId
    );
    if (!withdrawMethodData) {
      throw new ApiError(404, "Withdrawal method not found in the system");
    }
    if (!withdrawMethodData.isActive) {
      throw new ApiError(404, "Withdrawal method is not active in the system");
    }

    const user = await UserModel.findById(req.user.uCode);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const currentBalance = await getWalletBalanceBySlug(
      user._id,
      postData.walletType
    );
    if (currentBalance === null || currentBalance === undefined) {
      throw new ApiError(400, "Failed to retrieve wallet balance");
    }
    if (currentBalance < postData.amount) {
      throw new ApiError(400, "Insufficient wallet balance");
    }

    const companyWithdrawalCharge = await findUserSettings({
      slug: "withdrawal_charge",
    });
    if (companyWithdrawalCharge.length !== 1) {
      throw new ApiError(400, "Invalid withdrawal charge");
    }

    let status = 0;
    let response = null;
    let txNumber = null;
    let remark = "";
    let withdrawAmountUSD = parseFloat(postData.amount);
    let withdrawAmount = withdrawAmountUSD;
    let avgPrice: number | null = null;
    let txCharge = 0;
    let userId = req.user.uCode;
    const uniqueId = uuidv4();

    if (postData.debitCredit !== "DEBIT") {
      throw new ApiError(400, "Invalid debitCredit type. Must be 'DEBIT'");
    }

    if (companyWithdrawalCharge && companyWithdrawalCharge[0].value) {
      const txChargePer = parseFloat(
        companyWithdrawalCharge[0].value as string
      );
      txCharge = withdrawAmountUSD * (txChargePer / 100);
    }

    const netWithdrawAmountUSD = withdrawAmountUSD - txCharge;
    if (netWithdrawAmountUSD < 0) {
      throw new ApiError(400, "Withdrawal amount after charge is negative");
    }

    // Handle "auto" withdrawal type
    if (companyWithdrawalAccount.type === "auto") {
      const address = postData.details.address;
      if (!address || typeof address !== "string") {
        throw new ApiError(400, "Withdrawal address not found");
      }

      const pairIdentifier = accountTypeCheck?.pairIdentifier;
      if (pairIdentifier) {
        const binanceResponse = await axios.get<BinanceAvgPriceResponse>(
          "https://api.binance.com/api/v3/avgPrice",
          {
            params: { symbol: pairIdentifier },
          }
        );
        avgPrice = parseFloat(binanceResponse.data.price);
        if (isNaN(avgPrice) || avgPrice <= 0) {
          throw new ApiError(400, "Failed to fetch valid cryptocurrency price");
        }

        withdrawAmount = netWithdrawAmountUSD / avgPrice;
        remark = `${req.user.username} withdrew ${withdrawAmount.toFixed(
          6
        )} ${pairIdentifier.slice(0, -4)} ($${netWithdrawAmountUSD}) using ${
          withdrawMethodData.slug
        }`;
      } else {
        remark = `${req.user.username} withdrew $${netWithdrawAmountUSD} ${companyWithdrawalAccount.slug} using ${withdrawMethodData.slug}`;
      }

      const sendAutoTransaction = await initiateWithdrawal({
        uuid: uniqueId,
        chain: withdrawMethodData.slug,
        to: address,
        token: companyWithdrawalAccount.slug,
        amount: withdrawAmount,
        memo: remark,
      });

      // const sendAutoTransaction: any = {
      //   success: true,
      //   data: {
      //     txhash: "12345789uqryw3rhqwlk",
      //   },
      // };
      if (sendAutoTransaction.success === true) {
        // status = 1;
        txNumber = sendAutoTransaction.data?.txhash;
        response = JSON.stringify({
          ...sendAutoTransaction,
          usdAmount: netWithdrawAmountUSD,
          ...(pairIdentifier && {
            cryptoAmount: withdrawAmount,
            avgPrice,
            pairIdentifier,
          }),
          accountTypeId: accountTypeCheck,
          ...postData.details,
        });
      }
    } else {
      remark = `Transaction ${postData.txType} of $${netWithdrawAmountUSD} USD for ${postData.walletType}`;
      response = JSON.stringify({
        userId: user._id,
        accountTypeId: accountTypeCheck,
        details: postData.details,
      });
    }

    const updateUserWallet = await manageWalletAmounts(
      userId,
      postData.walletType,
      -withdrawAmountUSD
    );
    if (!updateUserWallet.status) {
      throw new ApiError(400, updateUserWallet.message);
    }

    const transactionPayload = {
      uCode: userId,
      txType: postData.txType || "fund_withdrawal",
      debitCredit: "DEBIT",
      postWalletBalance: currentBalance - withdrawAmountUSD,
      currentWalletBalance: currentBalance,
      walletType: postData.walletType,
      amount: netWithdrawAmountUSD,
      uuid: uniqueId,
      // method: "ONLINE", // DepositMethod
      txCharge: txCharge,
      txNumber,
      status,
      response,
      // withdrawalAccountType: postData.accountTypeId,
      isRetrieveFund: postData.isRetrieveFund || false,
      txStatus: 1,
      remark,
    };

    const newTransaction = new FundTransactionModel(transactionPayload);
    const savedTransaction = await newTransaction.save();

    const populatedTransaction = {
      ...savedTransaction.toObject(),
      uCode: {
        _id: req.user.uCode,
        username: req.user.username || "",
      },
      // withdrawalAccountType: accountTypeCheck,
    };
    try {
      await sendMessage(user.contactNumber, remark, user._id);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
    }

    // optional: send notification to receiver if provided string and not empty
    if (req.body.receivernotification && req.body.receivernotification !== "") {
      // try to slice if have + at the start of the string
      const receiverNumber = req.body.receivernotification.startsWith("+")
        ? req.body.receivernotification.slice(1)
        : req.body.receivernotification;
      await sendMessage(
        receiverNumber,
        `${user.name} have sent you $${transactionPayload.amount} to your ${accountTypeCheck.name} account`
      );
    }

    // console.log("postData.accountTypeCheck", accountTypeCheck);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedTransaction,
          "Transaction completed successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const userFundWithdrawal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postData = req.body;

    if (!req.user) {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    const requiredFields = [
      "txType",
      "debitCredit",
      "amount",
      "walletType",
      "withdrawalAccount",
    ];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      postData
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }

    if (isNaN(postData.amount) || postData.amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }

    const userWithdrawalAccount = await UserWithdrawalAccount.findById(
      postData.withdrawalAccount
    ).populate<{ accountTypeId: IWithdrawalAccountType }>("accountTypeId");
    if (!userWithdrawalAccount) {
      throw new ApiError(404, "Withdrawal account not found");
    }
    // res.status(200).json({userWithdrawalAccount});
    if (!userWithdrawalAccount.isActive) {
      throw new ApiError(
        404,
        "Withdrawal account is not active, please choose another"
      );
    }

    const companyWithdrawalAccount = await findWithdrawalAccountId(
      userWithdrawalAccount.accountTypeId._id as ObjectId
    );
    // console.log("companyWithdrawalAccount", companyWithdrawalAccount);

    if (!companyWithdrawalAccount) {
      throw new ApiError(404, "Withdrawal account not found in the system");
    }
    if (!companyWithdrawalAccount.isActive) {
      throw new ApiError(404, "Withdrawal account is not active in the system");
    }

    const withdrawMethodData = await findWithdrawalMethodId(
      companyWithdrawalAccount.methodId
    );
    if (!withdrawMethodData) {
      throw new ApiError(404, "Withdrawal method not found");
    }
    if (!withdrawMethodData.isActive) {
      throw new ApiError(404, "Withdrawal method is not active in the system");
    }

    const userId = req.user.uCode;
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const currentBalance = await getWalletBalanceBySlug(
      userId,
      postData.walletType
    );
    if (currentBalance === null || currentBalance === undefined) {
      throw new ApiError(400, "Failed to retrieve wallet balance");
    }
    if (currentBalance < postData.amount) {
      throw new ApiError(400, "Insufficient wallet balance");
    }

    const companyWithdrawalCharge = await findUserSettings({
      slug: "withdrawal_charge",
    });
    if (companyWithdrawalCharge.length !== 1) {
      throw new ApiError(400, "Invalid withdrawal charge");
    }

    let status = 0;
    let response = null;
    let txNumber = null;
    let remark = "";
    let withdrawAmountUSD = parseFloat(postData.amount);
    let withdrawAmount = withdrawAmountUSD;
    let avgPrice: number | null = null;
    let txCharge = 0;
    const uniqueId = uuidv4();

    if (companyWithdrawalCharge && companyWithdrawalCharge[0].value) {
      const txChargePer = parseFloat(
        companyWithdrawalCharge[0].value as string
      );
      txCharge = withdrawAmountUSD * (txChargePer / 100);
    }

    const netWithdrawAmountUSD = withdrawAmountUSD - txCharge;
    if (netWithdrawAmountUSD < 0) {
      throw new ApiError(400, "Withdrawal amount after charge is negative");
    }

    const accountTypeCheck = await WithdrawalAccountType.findById(
      userWithdrawalAccount.accountTypeId._id
    );
    if (!accountTypeCheck) {
      throw new ApiError(404, "Withdrawal account type not found");
    }

    if (companyWithdrawalAccount.type === "auto") {
      const address = userWithdrawalAccount.details.get("address");
      if (!address || typeof address !== "string") {
        throw new ApiError(400, "Withdrawal address not found");
      }

      const pairIdentifier =
        userWithdrawalAccount.accountTypeId?.pairIdentifier;
      if (pairIdentifier) {
        const binanceResponse = await axios.get<BinanceAvgPriceResponse>(
          "https://api.binance.com/api/v3/avgPrice",
          {
            params: { symbol: pairIdentifier },
          }
        );
        avgPrice = parseFloat(binanceResponse.data.price);
        if (isNaN(avgPrice) || avgPrice <= 0) {
          throw new ApiError(400, "Failed to fetch valid cryptocurrency price");
        }

        withdrawAmount = netWithdrawAmountUSD / avgPrice;
        remark = `${req.user.username} withdrew ${withdrawAmount.toFixed(
          6
        )} ${pairIdentifier.slice(0, -4)} ($${netWithdrawAmountUSD}) using ${
          withdrawMethodData.slug
        }`;
      } else {
        remark = `Transaction ${postData.txType} of $${netWithdrawAmountUSD} USD for ${postData.walletType}`;
      }

      const sendAutoTransaction = await initiateWithdrawal({
        uuid: uniqueId,
        chain: withdrawMethodData.slug,
        to: address,
        token: companyWithdrawalAccount.slug,
        amount: withdrawAmount,
        memo: remark,
      });

      console.log("sendAutoTransaction");
      if (sendAutoTransaction.success === true) {
        // status = 1;
        txNumber = sendAutoTransaction.data?.txhash;
        response = JSON.stringify({
          ...sendAutoTransaction,
          usdAmount: netWithdrawAmountUSD,
          ...(pairIdentifier && {
            cryptoAmount: withdrawAmount,
            avgPrice,
            pairIdentifier,
          }),
          ...JSON.parse(JSON.stringify(userWithdrawalAccount)),
        });
      }
    } else {
      remark = `Transaction ${postData.txType} of $${netWithdrawAmountUSD} USD for ${postData.walletType}`;
      response = JSON.stringify(userWithdrawalAccount);
    }

    const updateUserWallet = await manageWalletAmounts(
      userId,
      postData.walletType,
      -withdrawAmountUSD
    );
    if (!updateUserWallet.status) {
      throw new ApiError(400, updateUserWallet.message);
    }

    const transactionPayload = {
      uCode: userId,
      txType: postData.txType || "fund_withdrawal",
      debitCredit: "DEBIT",
      postWalletBalance: currentBalance - withdrawAmountUSD,
      currentWalletBalance: currentBalance,
      walletType: postData.walletType,
      amount: netWithdrawAmountUSD,
      uuid: uniqueId,
      // method: "ONLINE",  // DepositMethod
      txCharge: txCharge,
      txNumber,
      status,
      response,
      // withdrawalAccount: postData.withdrawalAccount,
      isRetrieveFund: postData.isRetrieveFund || false,
      txStatus: 1,
      remark,
    };

    const newTransaction = new FundTransactionModel(transactionPayload);
    const savedTransaction = await newTransaction.save();

    const populatedTransaction = {
      ...savedTransaction.toObject(),
      uCode: {
        _id: req.user.uCode,
        username: req.user.username || "",
      },
      // withdrawalAccount: {
      //   ...userWithdrawalAccount.toObject(),
      //   details: Object.fromEntries(userWithdrawalAccount.details), // Convert Map to object
      //   accountTypeId: {
      //     ...userWithdrawalAccount.accountTypeId.toObject(),
      //     requiredFields: Object.fromEntries(
      //       userWithdrawalAccount.accountTypeId.requiredFields
      //     ), // Convert Map to object
      //   },
      // },
    };

    try {
      await sendMessage(user.contactNumber, remark, user._id);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
    }

    // optional: send notification to receiver if provided string and not empty
    if (req.body.receivernotification && req.body.receivernotification !== "") {
      // try to slice if have + at the start of the string
      const receiverNumber = req.body.receivernotification.startsWith("+")
        ? req.body.receivernotification.slice(1)
        : req.body.receivernotification;
      await sendMessage(
        receiverNumber,
        `${user.name} have sent you $${transactionPayload.amount} to your ${accountTypeCheck.name} account`
      );
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedTransaction,
          "Transaction completed successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const updateUserWithdrawal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { status, reason } = req.body;
  const { id } = req.params;

  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(401, "Unauthorized access");
    }

    if (!id) {
      throw new ApiError(400, "Withdrawal ID is required");
    }

    // Validate required fields
    if (!status) {
      throw new ApiError(400, "Status is required");
    }

    // Fetch the transaction by ID
    const transaction = await FundTransactionModel.findById(id)
      .populate("uCode", "username name")
      .exec();
    if (!transaction) {
      throw new ApiError(404, "Transaction not found");
    }

    // Ensure 'reason' is required if 'status' is 2
    const parsedStatus = parseInt(status, 10);
    if (parsedStatus === 2 && (!reason || reason.trim() === "")) {
      throw new ApiError(400, "Reason is required for reject request");
    }

    // Handle wallet update if transaction is canceled (status = 2)
    if (parsedStatus === 2) {
      const refundAmount =
        transaction.amount + Number(transaction.txCharge || 0);
      const manageTransaction = await manageWalletAmounts(
        transaction.uCode._id,
        transaction.walletType,
        refundAmount
      );

      if (!manageTransaction.status) {
        throw new ApiError(400, manageTransaction.message);
      }
    }

    // Prepare the fields to update
    const updateData: Record<string, any> = { status };
    if (reason) updateData.reason = reason;

    // Update the transaction
    const updatedTransaction = await FundTransactionModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate("uCode", "username name")
      .populate({
        path: "withdrawalAccount",
        populate: {
          path: "accountTypeId",
        },
      });

    if (!updatedTransaction) {
      throw new ApiError(500, "Failed to update the transaction");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedTransaction,
          "Transaction updated successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const getAllIncomeTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postData = req.body;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    const query: any = {};
    if (postData.status !== undefined) {
      query.status = postData.status;
    }
    if (postData.txType !== "all") {
      query.txType = postData.txType;
    }

    const allTransactions = await IncomeTransactionModel.find(query)
      .populate("txUCode", "username name")
      .populate("uCode", "username name");

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          allTransactions,
          "Get all income transactions successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const getAllWithdrawalTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postData = req.body;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(401, "Unauthorized: User not found");
    }

    let filter: any = { txType: "fund_withdrawal" };

    if (postData && typeof postData.status !== "undefined") {
      filter.status = postData.status;
    }

    const allTransactions = await FundTransactionModel.find(filter)
      .populate("txUCode", "name email contactNumber username")
      .populate("uCode", "name email contactNumber username")
      .populate("withdrawalAccountType")
      .populate("withdrawalMethod")
      .populate({
        path: "withdrawalAccount",
        populate: { path: "accountTypeId", select: "name" },
      })
      .sort({ _id: -1 })
      .lean();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          allTransactions,
          "Fetched withdrawal requests successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const adminFundTransferAndRetrieve = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      username,
      amount,
      debitCredit,
      walletType,
      fromWalletType,
      reason,
    } = req.body;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(
        401,
        "Unauthorized: Only admin can perform this action"
      );
    }

    // Validate required fields
    const requiredFields = ["username", "amount", "debitCredit", "walletType"];
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

    if (isNaN(amount) || amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }

    // Find the user by username
    const user = await UserModel.findOne({ username });
    console.log("user", user);
    if (user === null || user === undefined) {
      throw new ApiError(404, "User not found");
    }

    let adminId = req.user.uCode;
    let userId = user._id;

    if (debitCredit === "DEBIT") {
      // Deduct from the user's wallet
      const userWalletUpdate = await manageWalletAmounts(
        userId,
        walletType,
        -amount
      );
      if (!userWalletUpdate.status) {
        throw new ApiError(400, userWalletUpdate.message);
      }
    } else if (debitCredit === "CREDIT") {
      // Add to the user's wallet
      const userWalletUpdate = await manageWalletAmounts(
        userId,
        walletType,
        amount
      );
      if (!userWalletUpdate.status) {
        throw new ApiError(400, userWalletUpdate.message);
      }
    } else {
      throw new ApiError(
        400,
        "Invalid debitCredit value. Must be 'DEBIT' or 'CREDIT'."
      );
    }

    // Log transaction
    const transactionPayload = {
      txUCode: userId,
      txType: "direct_fund_transfer",
      debitCredit,
      walletType,
      amount,
      method: "ADMIN_TRANSFER",
      status: 1,
      remark: `Admin ${req.user.username || "N/A"} ${
        debitCredit === "CREDIT" ? "credited" : "debited"
      } $${amount} to ${username}'s ${walletType}`,
      reason: reason || "N/A",
    };

    const newTransaction = new FundTransactionModel(transactionPayload);
    await newTransaction.save();

    res
      .status(200)
      .json(
        new ApiResponse(200, transactionPayload, "Fund transfer successful")
      );
  } catch (err) {
    next(err);
  }
};

export const updateUserFundTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const { status, reason } = req.body;

  try {
    // Auth check
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(
        401,
        "Unauthorized: Only admin can perform this action"
      );
    }

    // Field validation
    const requiredFields = ["status"];
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

    // Transaction fetch
    const transaction = await FundTransactionModel.findById(id);
    if (!transaction) {
      throw new ApiError(404, "Transaction not found");
    }

    const { uCode: userId, walletType, amount } = transaction;

    if (isNaN(amount) || amount <= 0) {
      throw new ApiError(400, "Amount must be a valid positive number");
    }

    if (status === 1) {
      if (transaction.status === status) {
        throw new ApiError(400, "Transaction Already Approved");
      } else if (transaction.status === 2) {
        throw new ApiError(
          400,
          "You haven't approved it because it's already rejected"
        );
      }
      // Approve transaction: add to user wallet
      const userWalletUpdate = await manageWalletAmounts(
        userId,
        walletType,
        amount
      );
      if (!userWalletUpdate.status) {
        throw new ApiError(400, userWalletUpdate.message);
      }

      transaction.status = 1;
      transaction.reason = undefined;
    } else if (status === 2) {
      if (transaction.status === status) {
        throw new ApiError(400, "Transaction Already Rejected");
      } else if (transaction.status === 1) {
        throw new ApiError(
          400,
          "You haven't rejected it because it's already approved"
        );
      }
      // Reject transaction
      transaction.status = 2;
      transaction.reason = reason;
    } else {
      throw new ApiError(400, "This status is not allowed");
    }

    await transaction.save();

    await transaction.populate([
      { path: "uCode", select: "username name" },
      { path: "method", select: "name" },
      { path: "account", select: "name type" },
    ]);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { transaction },
          "Transaction updated successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

export const verifyTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { txHash, amount, userAddress } = req.body;
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Error");
    }

    const userId = req.user.uCode;

    // Verify transaction
    const result = await transactionHelper.verifyTransaction(
      txHash,
      amount,
      userAddress
    );

    let status = result.status === "true" ? 1 : 0;
    if (status !== 1) {
      throw new ApiError(400, "Invalid Transaction");
    }
    let walletType = "fund_wallet";
    const currentWalletBalance = await common.getBalance(userId, walletType);

    // Insert transaction record in MongoDB
    const transaction = new FundTransactionModel({
      walletType,
      txType: "add_fund",
      debitCredit: "credit",
      uCode: userId,
      amount,
      paymentSlip: `${amount} USDT`,
      criptAddress: userAddress,
      currentWalletBalance,
      postWalletBalance: Number(currentWalletBalance) + Number(amount),
      criptoType: "USDT",
      status,
      txRecord: txHash,
      remark: status ? "Fund Added" : "Transaction Failed",
    });

    await transaction.save();

    const populatedTransaction = await FundTransactionModel.findById(
      transaction._id
    )
      .populate("txUCode", "name email contactNumber username")
      .populate("uCode", "name email contactNumber username");

    await common.manageWalletAmounts(
      transaction.uCode,
      transaction.walletType,
      transaction.amount
    );
    if (status === 1) {
      res
        .status(200)
        .json(
          new ApiResponse(200, populatedTransaction, "USDT added Successfully")
        );
    } else {
      throw new ApiError(400, "Transaction verification failed");
    }
  } catch (error) {
    next(error);
  }
};

export default {
  getAllDepositMethods,
  getAllDepositeAccounts,
  createFundTransactionController,
  getAllFundTransactions,
  getAllIncomeTransactions,
  getUserFundTransactions,
  userFundTransfer,
  userFundConvert,
  userFundManualWithdrawal,
  userFundWithdrawal,
  updateUserWithdrawal,
  getAllWithdrawalTransactions,
  adminFundTransferAndRetrieve,
  updateUserFundTransaction,
  verifyTransaction,
};
