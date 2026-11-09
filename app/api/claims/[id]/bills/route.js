import mongoose from 'mongoose';
import Claim from '../../../../../src/server/models/Claim.js';
import { readCloudinaryPdf } from '../../../../../src/server/services/cloudinary.js';
import connectDB from '../../../../../src/lib/db.js';
import { apiError, invalidRequest } from '../../../../../src/lib/http.js';

export const runtime = 'nodejs';

function isValidBill(bill, claimId) {
  const publicIdPrefix = `claim-bills/${claimId}/`;
  return bill
    && typeof bill.publicId === 'string'
    && bill.publicId.startsWith(publicIdPrefix)
    && /^[\da-f-]{36}$/i.test(bill.publicId.slice(publicIdPrefix.length))
    && typeof bill.name === 'string'
    && bill.name.length <= 255
    && bill.name.toLowerCase().endsWith('.pdf')
    && !/[\\/\r\n]/.test(bill.name);
}

export async function PUT(request, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Claim not found.' }, { status: 404 });

    const { bills } = await request.json();
    if (
      !Array.isArray(bills)
      || bills.length > 5
      || !bills.every((bill) => isValidBill(bill, id))
      || new Set(bills.map(({ publicId }) => publicId)).size !== bills.length
    ) {
      throw invalidRequest('Choose up to five valid PDF bills.');
    }

    await connectDB();
    const claim = await Claim.findById(id);
    if (!claim) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    if (claim.status === 'submitted') {
      return Response.json({ error: 'This claim has already been submitted.' }, { status: 409 });
    }

    await Promise.all(bills.map(async ({ publicId, name }) => {
      const buffer = await readCloudinaryPdf(publicId);
      if (buffer.length > 10 * 1024 * 1024) {
        throw invalidRequest(`${name} must be a PDF no larger than 10 MB.`);
      }
    }));

    claim.billFiles = bills;
    await claim.save();
    return Response.json({ bills: claim.billFiles });
  } catch (error) {
    return apiError(error, 'The saved bill list could not be updated.');
  }
}
