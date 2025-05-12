import { ObjectId } from "mongodb";
import db from "./db";
import { IncomeTransaction } from "../models/incomeTransaction";
import { FundTransaction } from "../models/fundTransaction";
import { Transaction } from "../models/transaction";
import { getCompanyBscAddress } from "../utils/companyInfoUtils";
import axios from "axios";

export async function createTransaction(
  collection: "incomeTransactions" | "fundTransactions" | "transactions",
  uCode: string,
  amount: number,
  txDetails:
    | Partial<
        Omit<IncomeTransaction, "_id" | "createdAt" | "updatedAt" | "uCode">
      >
    | Partial<
        Omit<FundTransaction, "_id" | "createdAt" | "updatedAt" | "uCode">
      >
    | Partial<Omit<Transaction, "_id" | "createdAt" | "updatedAt" | "uCode">>
): Promise<void> {
  const baseTx = {
    uCode: new ObjectId(uCode),
    amount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const txUCode = (txDetails as any).txUCode || new ObjectId(uCode); // Fallback to uCode if txUCode not provided

  if (collection === "incomeTransactions") {
    await db.insertOne<IncomeTransaction>(collection, {
      ...baseTx,
      txUCode,
      ...txDetails,
    } as IncomeTransaction);
  } else if (collection === "fundTransactions") {
    await db.insertOne<FundTransaction>(collection, {
      ...baseTx,
      txUCode,
      ...txDetails,
    } as FundTransaction);
  } else if (collection === "transactions") {
    await db.insertOne<Transaction>(collection, {
      ...baseTx,
      txUCode,
      ...txDetails,
    } as Transaction);
  }
}

interface VerifyRequestData {
  api_key: string | undefined;
  hash: string;
  from: string;
  amount: number;
  to: string;
  token: string;
  httpprovider: string;
}

export const verifyTransaction = async (
  txHash: string,
  amount: number,
  userAddress: string
): Promise<any> => {
  try {
    const companyBSCAddress = await getCompanyBscAddress();
    if (!companyBSCAddress) {
      throw new Error("Company BSC address not found");
    }

    const apiUrl = "https://web3check.companywebsite.in/verifybsc";
    const requestData: VerifyRequestData = {
      api_key: process.env.WEB3_API_KEY,
      hash: txHash,
      from: userAddress,
      amount: amount,
      to: companyBSCAddress,
      token: "0x55d398326f99059fF775485246999027B3197955",
      httpprovider: "https://bsc-dataseed.binance.org/",
    };

    console.log(`Verifying transaction ${txHash} for user ${userAddress}`);
    const response = await axios.post(apiUrl, requestData, {
      headers: { "Content-Type": "application/json" },
    });

    axios
      .post(
        "https://web3check.companywebsite.in/bitxAddress",
        { address: userAddress },
        {
          headers: { "Content-Type": "application/json" },
        }
      )
      .catch((err: Error) => {
        console.error("Error in bitxAddress background request:", err.message);
      });

    const result = response.data;
    return result;
  } catch (error: any) {
    console.error("Error in verify transaction:", error.message);
    return 0;
  }
};

export default {
  createTransaction,
  verifyTransaction,
};
