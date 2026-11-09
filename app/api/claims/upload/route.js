import { handleUpload } from '@vercel/blob/client';
import { apiError, invalidRequest } from '../../../../src/lib/http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const error = new Error('Connect a Vercel Blob store before uploading claim bills.');
      error.status = 503;
      throw error;
    }
    const body = await request.json();
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('claim-bills/') || !pathname.toLowerCase().endsWith('.pdf')) {
          throw invalidRequest('Supporting bills must be PDF files.');
        }
        return {
          addRandomSuffix: true,
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 10 * 1024 * 1024,
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    return apiError(error, 'The bill upload could not be started.');
  }
}
