// types/order.ts
import { Types } from "mongoose";

export interface OrderFilter {
  uCode?: string | Types.ObjectId; 
  [key: string]: any; 
}

export interface OrderResponse {
  _id: string;
  uCode: {
    _id: string;
    username: string;
    name: string;
  };
  pinId: {
    _id: string;
    type?: string;
    rateMin?: number;
    rateMax?: number;
  };
  bv: number;
  amount: number;
  txType: string;
  status: number;
  activeId: number;
  createdAt: string;
}