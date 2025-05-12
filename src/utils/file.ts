import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentDate } from './date'; // We'll add date.ts next

const uploadFolder = process.env.UPLOAD_FOLDER || path.resolve('./public/uploads');

export function ensureUploadFolderExists(): void {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
  }
}

export function generateUniqueFilename(originalName: string): string {
  const readableDate = getCurrentDate();
  return `${readableDate}_${uuidv4()}_${originalName}`;
}

export default { ensureUploadFolderExists, generateUniqueFilename };