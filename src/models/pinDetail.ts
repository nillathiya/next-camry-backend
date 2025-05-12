import { ObjectId } from 'mongodb';
import db from '../helpers/db';

export interface PinDetail {
  _id?: ObjectId;
  min?: number;
  max?: number;
  type?: string;
  description?: string;
  bv?: string;
  pv?: string;
  bonus?: Record<string, any>; // Generic object type for flexibility
  validity?: Record<string, any>; // Generic object type for flexibility
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'pinDetails';

export async function createPinDetail(data: Omit<PinDetail, '_id' | 'createdAt' | 'updatedAt'>): Promise<PinDetail> {
  const defaults = { status: 0, createdAt: new Date(), updatedAt: new Date() };
  return db.insertOne<PinDetail>(COLLECTION_NAME, { ...defaults, ...data });
}

export async function findPinDetailById(id: string): Promise<PinDetail | null> {
  return db.findOne<PinDetail>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findPinDetails(query: any = {}): Promise<PinDetail[]> {
  return db.findMany<PinDetail>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<PinDetail | null> {
  return db.findOne<PinDetail>(COLLECTION_NAME, query);
}

export async function updatePinDetail(id: string, update: Partial<PinDetail>): Promise<void> {
  await db.updateOne(COLLECTION_NAME, { _id: new ObjectId(id) }, { $set: { ...update, updatedAt: new Date() } });
}

export async function deletePinDetail(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export default {
  createPinDetail,
  findPinDetailById,
  findPinDetails,
  findOne,
  updatePinDetail,
  deletePinDetail,
};