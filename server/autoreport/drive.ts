import { getDriveClient } from './credentials';
import { Readable } from 'stream';

export interface UploadResult {
  fileId: string;
  fileUrl: string;
  fileName: string;
}

export async function uploadPdfToDrive(
  buffer: Buffer,
  fileName: string,
  folderId?: string
): Promise<UploadResult> {
  const drive = getDriveClient();

  const fileMetadata: any = {
    name: fileName,
    mimeType: 'application/pdf',
  };

  if (folderId) {
    const cleanFolderId = extractFolderId(folderId);
    if (cleanFolderId) {
      fileMetadata.parents = [cleanFolderId];
    }
  }

  const media = {
    mimeType: 'application/pdf',
    body: bufferToStream(buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, name',
  });

  const fileId = response.data.id || '';
  const webViewLink = response.data.webViewLink || '';

  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  }).catch((err) => {
    console.warn('[AutoReport Drive] Could not set public permissions:', err.message);
  });

  return {
    fileId,
    fileUrl: webViewLink,
    fileName: response.data.name || fileName,
  };
}

function extractFolderId(input: string): string {
  if (input.includes('drive.google.com')) {
    const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : input;
  }
  return input;
}

function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export async function getFolderIdFromUrl(folderUrl: string): Promise<string | null> {
  if (!folderUrl) return null;
  
  if (folderUrl.includes('drive.google.com')) {
    const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  
  return folderUrl;
}
