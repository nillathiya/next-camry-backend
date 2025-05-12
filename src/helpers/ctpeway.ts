import axios from "axios";
export interface CtPeWayWithdrawRequest {
  uuid: string;
  chain: string;
  to: string;
  token: string;
  amount: number;
  memo: string;
}

export interface CtPeWayErrorResponse {
  error: string;
  details: string;
}

export interface CtPeWaySuccessResponse {
  success: boolean;
  message: string;
  data: {
    txhash: string;
    memo: string;
    amount: number;
    from: string;
    to: string;
    status: boolean;
    type: string;
    token: string;
    usdAmount: number;
    timeStamp: string;
  };
}

export async function initiateWithdrawal(
  requestData: CtPeWayWithdrawRequest
): Promise<CtPeWaySuccessResponse> {
  try {
    const response = await axios.post(
      "https://api.ctpeway.com/api/withdraw",
      requestData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "b724fa94-163b-4be6-be1f-114bcf99beae",
        },
      }
    );
    console.log("withdraw:", response.data);
    return response.data as CtPeWaySuccessResponse;
  } catch (error) {
    console.error("Error initiating withdrawal:", error);
    throw new Error("Failed to initiate withdrawal");
  }
}

export async function getWithdrawTransactions(): Promise<any> {
  try {
    const response = await axios.get(
      "https://api.ctpeway.com/api/withdraw-transactions",
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "b724fa94-163b-4be6-be1f-114bcf99beae",
        },
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to fetch withdrawal transactions");
    }
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error("Invalid response format for withdrawal transactions");
    }
    return response.data.map((transaction: any) => ({
      txHash: transaction.txhash,
      memo: transaction.memo,
      amount: transaction.amount,
      usdAmount: transaction.usdAmount,
      from: transaction.from,
      to: transaction.to,
      status: transaction.status,
      type: transaction.type,
      token: transaction.token,
      timeStamp: transaction.createdAt,
    }));
  } catch (error) {
    console.error("Error in getWithdrawTransactions:", error);
    throw new Error("Failed to fetch withdrawal transactions");
  }
}
