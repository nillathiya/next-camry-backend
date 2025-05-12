import { ObjectId } from "mongodb";
import db from "./db";
import WalletModel, { IWallet } from "../models/wallet";
import UserModel from "../models/user";
import { WalletSettings } from "../models/walletSettings";
import { IncomeTransaction } from "../models/incomeTransaction";
import { FundTransaction } from "../models/fundTransaction";
import { createTransaction } from "./transaction";

export async function getWalletBalanceBySlug(
  uCode: string,
  slug: string
): Promise<number | null> {
  const settings = await db.findOne<WalletSettings>("walletSettings", {
    slug,
    status: 1,
  });
  if (!settings) {
    throw new Error(
      `Wallet settings for slug '${slug}' not found or not active for users`
    );
  }
  if (!settings.column) {
    throw new Error(`No column mapped for slug '${slug}' in wallet settings`);
  }

  const validColumns = Array.from({ length: 40 }, (_, i) =>
    i < 30 ? `c${i + 1}` : `c${i + 2}`
  );
  if (!validColumns.includes(settings.column)) {
    throw new Error(
      `Invalid column '${settings.column}' mapped for slug '${slug}'`
    );
  }

  const wallet = await WalletModel.findOne({ uCode });
  if (!wallet) {
    return 0;
  }

  return wallet[settings.column as keyof typeof wallet] || 0;
}

export async function updateWalletBalanceBySlug(
  uCode: string,
  slug: string,
  amount: number,
  txDetails?:
    | Partial<
        Omit<
          IncomeTransaction,
          | "_id"
          | "createdAt"
          | "updatedAt"
          | "uCode"
          | "postWalletBalance"
          | "currentWalletBalance"
        >
      >
    | Partial<
        Omit<
          FundTransaction,
          | "_id"
          | "createdAt"
          | "updatedAt"
          | "uCode"
          | "postWalletBalance"
          | "currentWalletBalance"
        >
      >
): Promise<void> {
  const settings = await db.findOne<WalletSettings>("walletSettings", {
    slug,
    adminStatus: 1,
  });
  if (!settings) {
    throw new Error(
      `Wallet settings for slug '${slug}' not found or not editable by admin`
    );
  }
  if (!settings.column) {
    throw new Error(`No column mapped for slug '${slug}' in wallet settings`);
  }

  const validColumns = Array.from({ length: 40 }, (_, i) =>
    i < 30 ? `c${i + 1}` : `c${i + 2}`
  );
  if (!validColumns.includes(settings.column)) {
    throw new Error(
      `Invalid column '${settings.column}' mapped for slug '${slug}'`
    );
  }

  if (
    (settings.type === "income" || settings.type === "wallet") &&
    !txDetails
  ) {
    throw new Error(
      `Transaction details are required for '${settings.type}' type wallet updates`
    );
  }

  const currentBalance = (await getWalletBalanceBySlug(uCode, slug)) || 0;
  const postWalletBalance = currentBalance + amount;

  if (postWalletBalance < 0) {
    throw new Error(
      `Operation would result in negative postWalletBalance for '${slug}' (current: ${currentBalance}, change: ${amount})`
    );
  }

  // ✅ Replace db.updateOne with WalletModel.updateOne
  await WalletModel.updateOne(
    { uCode: new ObjectId(uCode) },
    {
      $set: {
        [settings.column]: postWalletBalance, // ✅ Dynamic column update
        updatedAt: new Date(),
      },
    }
  );

  if (txDetails) {
    const enrichedTxDetails = {
      ...txDetails,
      currentWalletBalance: currentBalance,
      postWalletBalance,
    };

    if (settings.type === "income") {
      await createTransaction(
        "incomeTransactions",
        uCode,
        amount,
        enrichedTxDetails
      );
    } else if (settings.type === "wallet") {
      await createTransaction(
        "fundTransactions",
        uCode,
        amount,
        enrichedTxDetails
      );
    }
  }
}

export async function getWalletBalanceSumByType(
  uCode: string,
  type: string
): Promise<number> {
  const settingsList = await db.findMany<WalletSettings>("walletSettings", {
    type,
    status: 1,
  });

  if (!settingsList.length) return 0;

  const validColumns = Array.from({ length: 40 }, (_, i) =>
    i < 30 ? `c${i + 1}` : `c${i + 2}`
  );

  const columns = settingsList
    .map((s) => s.column)
    .filter((c): c is string => c !== undefined && validColumns.includes(c));

  if (!columns.length) return 0;

  // Use .lean() to get a plain object
  const walletDoc = await WalletModel.findOne({ uCode }).lean();
  if (!walletDoc) return 0;

  // Type assertion: Ignore non-column fields
  const walletData = walletDoc as Record<string, unknown>;

  return columns.reduce((sum, column) => {
    const value = walletData[column];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

export async function addIncome(
  uCode: string,
  slug: string,
  amount: number
): Promise<void> {
  // Fetch wallet settings for the original slug
  const originalSettings = await db.findOne<WalletSettings>("walletSettings", {
    slug,
    adminStatus: 1,
  });
  if (!originalSettings) {
    throw new Error(
      `Wallet settings for slug '${slug}' not found or not editable by admin`
    );
  }

  // Update balance for the original slug
  await updateWalletBalanceBySlug(uCode, slug, amount);

  // Check if walletSettings.wallet exists and is non-empty
  if (originalSettings.wallet && originalSettings.wallet.trim()) {
    const linkedSettings = await db.findOne<WalletSettings>("walletSettings", {
      slug: originalSettings.wallet,
      adminStatus: 1,
    });
    if (linkedSettings) {
      // Update balance for the linked slug if found
      await updateWalletBalanceBySlug(uCode, originalSettings.wallet, amount);
    }
    // If no linked settings found, do nothing extra—just the original update applies
  }
}

interface WalletUpdateResponse {
  status: number;
  message: string;
}

// Valid wallet columns (c1-c29, c31-c40)
const VALID_WALLET_COLUMNS = Array.from({ length: 40 }, (_, i) =>
  i < 29 ? `c${i + 1}` : `c${i + 2}`
) as (keyof Omit<
  IWallet,
  "_id" | "uCode" | "username" | "createdAt" | "updatedAt"
>)[];

export const manageWalletAmounts = async (
  userId: string,
  slug: string,
  amount: number | string
): Promise<WalletUpdateResponse> => {
  try {
    // Convert amount to a number and validate
    const parsedAmount =
      typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount)) {
      return { status: 0, message: "Invalid amount provided" };
    }

    // Fetch the user
    const currentUser = await UserModel.findById(userId);
    if (!currentUser) {
      return { status: 0, message: "User not found" };
    }

    // Fetch wallet settings
    const settings = await db.findOne<WalletSettings>("walletSettings", {
      slug,
      status: 1,
    });
    if (!settings) {
      return {
        status: 0,
        message: `Wallet settings for slug '${slug}' not found or not editable`,
      };
    }

    const walletColumn = settings.column;
    if (!walletColumn) {
      return {
        status: 0,
        message: `No column mapped for slug '${slug}' in wallet settings`,
      };
    }

    // Validate wallet column
    if (!VALID_WALLET_COLUMNS.includes(walletColumn as any)) {
      return {
        status: 0,
        message: `Invalid column '${walletColumn}' mapped for slug '${slug}'`,
      };
    }

    // Fetch or create the user's wallet
    let wallet = await WalletModel.findOne({ uCode: currentUser._id });

    if (!wallet) {
      // Initialize a new wallet
      const walletData: Partial<IWallet> = {
        uCode: currentUser._id,
        username: currentUser.username,
        [walletColumn]: parsedAmount >= 0 ? parsedAmount : 0, // Don't allow negative initial balance
      };
      wallet = new WalletModel(walletData);
      const createdWallet = await wallet.save();
      if (!createdWallet) {
        return { status: 0, message: "Failed to create wallet" };
      }
      return {
        status: 1,
        message: "Wallet created and amount set successfully",
      };
    }

    // Get the existing amount from the wallet (type-safe)
    const oldAmount = (wallet[walletColumn as keyof IWallet] as number) || 0;

    // Calculate the new amount
    const newAmount =
      parsedAmount >= 0
        ? oldAmount + parsedAmount
        : oldAmount - Math.abs(parsedAmount);

    // Check for insufficient balance
    if (newAmount < 0) {
      return { status: 0, message: "Insufficient balance in wallet" };
    }

    // Update the wallet in the database
    const updatedWallet = await WalletModel.findByIdAndUpdate(
      wallet._id,
      { [walletColumn]: newAmount },
      { new: true }
    );

    if (!updatedWallet) {
      return { status: 0, message: "Failed to update wallet" };
    }

    return { status: 1, message: "Wallet updated successfully" };
  } catch (error) {
    console.error("Error in manageWalletAmounts:", error);
    return {
      status: 0,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
};
export default {
  getWalletBalanceBySlug,
  updateWalletBalanceBySlug,
  manageWalletAmounts,
};
