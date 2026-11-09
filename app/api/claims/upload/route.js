import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Claim from '../../../../src/server/models/Claim.js';
import { createCloudinaryUploadParams } from '../../../../src/server/services/cloudinary.js';
import connectDB from '../../../../src/lib/db.js';
import { apiError, invalidRequest } from '../../../../src/lib/http.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { claimId, name, size, type } = await request.json();
    if (!mongoose.isValidObjectId(claimId)) {
      throw invalidRequest('Save the claim before uploading supporting bills.');
    }
    await connectDB();
    const claim = await Claim.findById(claimId).select('_id status').lean();
    if (!claim) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    if (claim.status === 'submitted') {
      return Response.json({ error: 'This claim has already been submitted.' }, { status: 409 });
    }
    if (
      typeof name !== 'string'
      || name.length > 255
      || !name.toLowerCase().endsWith('.pdf')
      || /[\\/\r\n]/.test(name)
      || type !== 'application/pdf'
      || !Number.isInteger(size)
      || size < 1
      || size > 10 * 1024 * 1024
    ) {
      throw invalidRequest('Each supporting bill must be a PDF no larger than 10 MB.');
    }

    const publicId = `claim-bills/${claimId}/${randomUUID()}`;
    const upload = createCloudinaryUploadParams(publicId);
    return Response.json({ publicId, name, ...upload });
  } catch (error) {
    return apiError(error, 'The bill upload could not be started.');
  }
}
