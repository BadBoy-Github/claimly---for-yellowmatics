import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_SHEETS_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME_TYPE = 'application/pdf';

export function isGoogleDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID
      && process.env.GOOGLE_DRIVE_CLIENT_SECRET
      && process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

function getOAuthClient() {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    const error = new Error('Configure Google Drive OAuth credentials to convert claim workbooks to PDF.');
    error.status = 503;
    throw error;
  }

  const client = new OAuth2Client(GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });
  return client;
}

async function getAccessToken(client) {
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Google Drive OAuth did not return an access token.');
  return token;
}

async function assertDriveSuccess(response, action) {
  if (response.ok) return;

  const responseText = await response.text();
  let detail = responseText;
  try {
    detail = JSON.parse(responseText)?.error?.message || responseText;
  } catch {
    detail = responseText;
  }
  const error = new Error(`Google Drive ${action} failed (HTTP ${response.status}): ${detail.slice(0, 500)}`);
  error.status = 502;
  throw error;
}

async function createTemporarySpreadsheet(token, workbookBuffer, fileName) {
  const boundary = `claim-conversion-${randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, mimeType: GOOGLE_SHEETS_MIME_TYPE });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${XLSX_MIME_TYPE}\r\n\r\n`),
    workbookBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  await assertDriveSuccess(response, 'workbook upload');

  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) {
    throw new Error('Google Drive did not return an ID for the temporary claim workbook.');
  }
  return result.id;
}

async function exportSpreadsheetAsPdf(token, fileId) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(PDF_MIME_TYPE)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  await assertDriveSuccess(response, 'PDF export');

  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  if (!pdfBuffer.length || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('Google Drive returned a file that is not a valid PDF.');
  }
  return pdfBuffer;
}

async function deleteTemporarySpreadsheet(token, fileId) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  await assertDriveSuccess(response, 'temporary workbook deletion');
}

export async function convertWorkbookToPdf(workbookBuffer, fileName) {
  const client = getOAuthClient();
  const token = await getAccessToken(client);
  let fileId;
  let pdfBuffer;
  let conversionError;

  try {
    fileId = await createTemporarySpreadsheet(token, workbookBuffer, fileName);
    pdfBuffer = await exportSpreadsheetAsPdf(token, fileId);
  } catch (error) {
    conversionError = error;
  }

  if (fileId) {
    try {
      await deleteTemporarySpreadsheet(token, fileId);
    } catch (cleanupError) {
      if (conversionError) {
        throw new AggregateError(
          [conversionError, cleanupError],
          'Google Drive conversion failed and the temporary workbook could not be deleted.',
        );
      }
      const error = new Error('The PDF was converted, but its temporary Google Drive workbook could not be deleted.', {
        cause: cleanupError,
      });
      error.status = 502;
      throw error;
    }
  }

  if (conversionError) throw conversionError;
  return pdfBuffer;
}
