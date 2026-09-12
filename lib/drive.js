import { Readable } from 'node:stream';
import { getDrive } from './google';

async function ensureChildFolder(name) {
  const parent = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parent) throw new Error('GOOGLE_DRIVE_FOLDER_ID is missing');

  const drive = await getDrive();
  const safeName = String(name).replace(/'/g, "\\'");
  const q = `'${parent}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 10 });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent],
    },
    fields: 'id',
  });
  return created.data.id;
}

async function uploadToFolder(drive, parent, { buffer, mimeType, name }) {
  const result = await drive.files.create({
    requestBody: { name, parents: [parent] },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from(buffer),
    },
    fields: 'id,name,mimeType,size',
  });
  return result.data;
}

export async function uploadBuffer({ buffer, mimeType, name, folderName }) {
  const drive = await getDrive();
  const parent = await ensureChildFolder(folderName);
  return uploadToFolder(drive, parent, { buffer, mimeType, name });
}

export async function uploadManyBuffers({ files, folderName }) {
  if (!Array.isArray(files) || files.length === 0) return [];

  // Resolve Drive auth + destination folder once for the full batch.
  const drive = await getDrive();
  const parent = await ensureChildFolder(folderName);

  // Max 8 files in this app, so parallel upload is safe and much faster than
  // uploading one-by-one while re-checking the folder for every image.
  return Promise.all(
    files.map((file) => uploadToFolder(drive, parent, file))
  );
}

export async function getDriveFile(fileId) {
  const drive = await getDrive();
  const meta = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size',
  });
  const data = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return { ...meta.data, buffer: Buffer.from(data.data) };
}
