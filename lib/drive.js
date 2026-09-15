import { Readable } from 'node:stream';
import { getDrive } from './google';

function safeFolderPart(value) {
  return String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').slice(0, 120) || 'Unknown';
}

async function ensureFolderUnder(parentId, name) {
  if (!parentId) throw new Error('Drive parent folder is missing');
  const drive = await getDrive();
  const cleanName = safeFolderPart(name);
  const escaped = cleanName.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 10 });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return created.data.id;
}

async function resolveDestinationFolder({ folderName, folderPath }) {
  const root = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!root) throw new Error('GOOGLE_DRIVE_FOLDER_ID is missing');

  const parts = Array.isArray(folderPath) && folderPath.length
    ? folderPath
    : [folderName].filter(Boolean);

  let parent = root;
  for (const part of parts) parent = await ensureFolderUnder(parent, part);
  return parent;
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

export async function uploadBuffer({ buffer, mimeType, name, folderName, folderPath }) {
  const drive = await getDrive();
  const parent = await resolveDestinationFolder({ folderName, folderPath });
  return uploadToFolder(drive, parent, { buffer, mimeType, name });
}

export async function uploadManyBuffers({ files, folderName, folderPath }) {
  if (!Array.isArray(files) || files.length === 0) return [];

  const drive = await getDrive();
  const parent = await resolveDestinationFolder({ folderName, folderPath });

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
