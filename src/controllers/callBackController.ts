import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import mongoose, { Types } from "mongoose";
import DepositMethodModel from "../models/depositMethod";
import FundTransactionModel, {
  FundTransaction as IFundTransaction,
} from "../models/fundTransaction";
import UserModel from "../models/user";
import { manageWalletAmounts } from "../helpers/wallet";
import { emitToUser } from "../socket/soketHandler";
import WithdrawalMethod from "../models/WithdrawalMethod";
import DepositAccountModel, { DepositAccount } from "../models/depositAccount";

interface WebhookPayload {
  chain: string;
  txHash: string;
  type: string;
  from: string;
  to: string;
  usdAmount: string | number;
  inOut: "credit" | "debit";
  name: string;
  token?: string;
  uuid?: string;
}

export const processWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Log payload with timestamp
    console.log("Webhook received:", {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    const payload: WebhookPayload = req.body;

    // Validate payload
    console.log("Validating payload:", { payload, timestamp: new Date().toISOString() });
    if (!payload || Object.keys(payload).length === 0) {
      throw new ApiError(400, "Empty or invalid webhook payload");
    }

    const requiredFields: (keyof WebhookPayload)[] = [
      "chain",
      "txHash",
      "type",
      "from",
      "to",
      "usdAmount",
      "inOut",
    ];
    const missingFields = requiredFields.filter((field) => !payload[field]);
    if (missingFields.length) {
      console.log("Missing fields detected:", { missingFields, timestamp: new Date().toISOString() });
      throw new ApiError(
        400,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    // Validate inOut
    console.log("Validating inOut:", { inOut: payload.inOut, timestamp: new Date().toISOString() });
    if (!["credit", "debit"].includes(payload.inOut)) {
      throw new ApiError(
        400,
        "Invalid inOut value; must be 'credit' or 'debit'"
      );
    }

    // Validate usdAmount
    const parsedAmount = Number(payload.usdAmount);
    console.log("Parsed usdAmount:", { parsedAmount, timestamp: new Date().toISOString() });
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ApiError(400, "usdAmount must be a positive number");
    }

    // Validate chain and get method data
    console.log("Fetching method data for chain:", { chain: payload.chain, inOut: payload.inOut, timestamp: new Date().toISOString() });
    let methodData;
    if (payload.inOut === "credit") {
      methodData = await DepositMethodModel.findDepositMethodBySlug(
        payload.chain
      );
      if (!methodData) {
        console.log("Deposit method not found:", { chain: payload.chain, timestamp: new Date().toISOString() });
        throw new ApiError(
          404,
          `Deposit method not found for chain: ${payload.chain}`
        );
      }
    } else {
      methodData = await WithdrawalMethod.findOne({ slug: payload.chain });
      if (!methodData) {
        console.log("Withdrawal method not found:", { chain: payload.chain, timestamp: new Date().toISOString() });
        throw new ApiError(
          404,
          `Withdrawal method not found for chain: ${payload.chain}`
        );
      }
    }
    console.log("Method data retrieved:", { methodData, timestamp: new Date().toISOString() });

    // Check for duplicate transaction
    console.log("Checking for duplicate transaction:", { txHash: payload.txHash, timestamp: new Date().toISOString() });
    const existingTx = await FundTransactionModel.findOne({
      txNumber: payload.txHash,
    });
    if (existingTx) {
      console.log("Duplicate transaction found:", { txHash: payload.txHash, timestamp: new Date().toISOString() });
      throw new ApiError(
        409,
        `Transaction already processed: ${payload.txHash}`
      );
    }

    // Verify user only for credit (deposit)
    let userData;
    if (payload.inOut === "credit") {
      console.log("Fetching user data:", { username: payload.name, timestamp: new Date().toISOString() });
      userData = await UserModel.findOne({ username: payload.name });
      if (!userData) {
        console.log("User not found:", { username: payload.name, timestamp: new Date().toISOString() });
        throw new ApiError(404, `User not found: ${payload.name}`);
      }
      console.log("User data retrieved:", { userId: userData._id, timestamp: new Date().toISOString() });
    }

    // Handle debit (withdrawal) transaction
    if (payload.inOut === "debit") {
      console.log("Processing debit transaction:", { uuid: payload.uuid, timestamp: new Date().toISOString() });
      if (!payload.uuid) {
        console.log("Missing uuid for debit transaction:", { timestamp: new Date().toISOString() });
        throw new ApiError(400, "Missing uuid field for debit transaction");
      }

      console.log("Fetching transaction for uuid:", { uuid: payload.uuid, amount: parsedAmount, timestamp: new Date().toISOString() });
      const transaction = await FundTransactionModel.findOne({
        uuid: payload.uuid,
        // amount: parsedAmount,
      });

      if (!transaction) {
        console.log("Transaction not found:", { uuid: payload.uuid, amount: parsedAmount, timestamp: new Date().toISOString() });
        throw new ApiError(
          404,
          `No transaction found for uuid: ${payload.uuid} and amount: ${parsedAmount}`
        );
      }

      console.log("Transaction status check:", { status: transaction.status, timestamp: new Date().toISOString() });
      if ([1, 2].includes(transaction.status)) {
        console.log("Transaction already processed:", { uuid: payload.uuid, status: transaction.status, timestamp: new Date().toISOString() });
        throw new ApiError(
          409,
          `Transaction already processed: ${payload.uuid}`
        );
      }

      // Update transaction status
      console.log("Updating transaction status:", { uuid: payload.uuid, newStatus: 1, timestamp: new Date().toISOString() });
      transaction.status = 1;
      if(payload.txHash){
        transaction.txNumber = payload.txHash;
      }
      transaction.updatedAt = new Date();
      await transaction.save();

      // Log and return success
      console.log("Debit transaction updated:", {
        txHash: payload.txHash || null,
        uuid: payload.uuid,
        amount: parsedAmount,
        timestamp: new Date().toISOString(),
      });

      res
        .status(200)
        .json(
          new ApiResponse(200, "Debit transaction status updated successfully")
        );
    }

    // Handle credit (deposit) transaction
    console.log("Processing credit transaction:", { txHash: payload.txHash, timestamp: new Date().toISOString() });
    const txType = "add_fund";
    const debitCredit = "credit";
    const walletType = "fund_wallet";

    // Get previous balance
    console.log("Fetching last transaction for balance:", { uCode: userData?._id, txType, timestamp: new Date().toISOString() });
    const lastTransaction = await FundTransactionModel.findOne({
      uCode: userData?._id,
      txType,
    });
    const previousBalance = lastTransaction?.postWalletBalance || 0;
    const newBalance = previousBalance + parsedAmount;
    console.log("Balance calculated:", { previousBalance, parsedAmount, newBalance, timestamp: new Date().toISOString() });

    try {
      // Create fund transaction
      console.log("Creating fund transaction:", { txHash: payload.txHash, amount: parsedAmount, timestamp: new Date().toISOString() });
      const fundTransactionData: IFundTransaction = {
        txUCode: null,
        uCode: userData!._id,
        txType,
        debitCredit,
        walletType,
        amount: parsedAmount,
        txCharge: 0,
        paymentSlip: "",
        txNumber: payload.txHash,
        postWalletBalance: newBalance,
        currentWalletBalance: previousBalance,
        withdrawalAccount: null,
        response: JSON.stringify(payload),
        remark: `${methodData.slug} ${payload.token || ""}`,
        isRetrieveFund: false,
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (methodData._id)
        fundTransactionData.method = methodData._id as Types.ObjectId;

      if (payload.token && methodData._id) {
        console.log("Fetching deposit account:", { slug: payload.token, methodId: methodData._id, timestamp: new Date().toISOString() });
        const depositAccount =
          await DepositAccountModel.findOne<DepositAccount>({
            slug: payload.token,
            methodId: methodData._id as Types.ObjectId,
          });
        if (depositAccount?._id) {
          fundTransactionData.account = depositAccount._id as Types.ObjectId;
          console.log("Deposit account found:", { accountId: depositAccount._id, timestamp: new Date().toISOString() });
        } else {
          console.log("Deposit account not found:", { slug: payload.token, timestamp: new Date().toISOString() });
        }
      }

      const newTransaction = await FundTransactionModel.create(
        fundTransactionData
      );
      console.log("Fund transaction created:", { transactionId: newTransaction._id, timestamp: new Date().toISOString() });

      // Update wallet balance
      console.log("Updating wallet balance:", { userId: userData!._id, walletType, amount: parsedAmount, timestamp: new Date().toISOString() });
      const walletUpdate = await manageWalletAmounts(
        userData!._id.toString(),
        walletType,
        parsedAmount
      );
      if (walletUpdate.status !== 1) {
        console.log("Wallet update failed:", { message: walletUpdate.message, timestamp: new Date().toISOString() });
        throw new ApiError(500, walletUpdate.message);
      }
      console.log("Wallet updated:", { message: walletUpdate.message, timestamp: new Date().toISOString() });

      // Emit events
      console.log("Emitting socket event:", { userId: userData!._id, event: "deposit_success", timestamp: new Date().toISOString() });
      emitToUser(userData!._id.toString(), "deposit_success", {
        amount: parsedAmount,
        address: payload.to,
        txHash: payload.txHash,
      });

      // Log success
      console.log("Credit transaction processed:", {
        userId: userData!._id,
        txHash: payload.txHash,
        amount: parsedAmount,
        newBalance,
        timestamp: new Date().toISOString(),
      });

      res.status(200).json(new ApiResponse(200, walletUpdate.message));
    } catch (error: any) {
      console.error("Error in credit transaction processing:", {
        error: error.message,
        stack: error.stack,
        txHash: payload.txHash,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  } catch (error: any) {
    console.error("Webhook processing error:", {
      error: error.message,
      stack: error.stack,
      payload: req.body,
      timestamp: new Date().toISOString(),
    });
    next(error);
  }
};

export default { processWebhook };