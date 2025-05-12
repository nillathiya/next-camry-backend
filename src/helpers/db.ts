// src/helpers/db.ts
import { connectMongoDB } from "../config/db";
import { WithId, Document } from "mongodb";

export async function findOne<T>(
  collection: string,
  query: any
): Promise<T | null> {
  const db = await connectMongoDB();
  const result = (await db
    .collection(collection)
    .findOne(query)) as WithId<Document> | null;
  return result as T | null;
}

export async function findMany<T>(
  collection: string,
  query: any
): Promise<T[]> {
  const db = await connectMongoDB();
  const results = (await db
    .collection(collection)
    .find(query)
    .toArray()) as WithId<Document>[];
  return results as T[];
}

export async function insertOne<T>(collection: string, data: any): Promise<T> {
  const db = await connectMongoDB();
  const result = await db.collection(collection).insertOne(data);
  return { _id: result.insertedId, ...data } as T;
}

export async function insertMany<T>(
  collection: string,
  data: any[]
): Promise<T[]> {
  const db = await connectMongoDB();
  const result = await db.collection(collection).insertMany(data);
  return data.map((item, index) => ({
    _id: result.insertedIds[index],
    ...item,
  })) as T[];
}

export async function updateOne(
  collection: string,
  filter: any,
  update: any
): Promise<void> {
  const db = await connectMongoDB();
  await db.collection(collection).updateOne(filter, update);
}

export async function updateMany(
  collection: string,
  filter: any,
  update: any
): Promise<void> {
  const db = await connectMongoDB();
  await db.collection(collection).updateMany(filter, update);
}

export async function deleteOne(
  collection: string,
  filter: any
): Promise<void> {
  const db = await connectMongoDB();
  await db.collection(collection).deleteOne(filter);
}

export async function deleteMany(
  collection: string,
  filter: any
): Promise<void> {
  const db = await connectMongoDB();
  await db.collection(collection).deleteMany(filter);
}

export default {
  findOne,
  findMany,
  insertOne,
  insertMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
};
