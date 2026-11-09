import mongoose from 'mongoose';
import Claim from '../../../../../../src/server/models/Claim.js';
import { readCloudinaryPdf } from '../../../../../../src/server/services/cloudinary.js';
import connectDB from '../../../../../../src/lib/db.js';
import { apiError } from '../../../../../../src/lib/http.js';

export const runtime = 'nodejs';

export async function GET(_request, context) {
  try {
    const { id, billIndex } = await context.params;
    if (!mongoose.isValidObjectId(id) || !/^(0|[1-4])$/.test(billIndex)) {
      return Response.json({ error: 'Bill not found.' }, { status: 404 });
    }

    await connectDB();
    const claim = await Claim.findById(id).select('billFiles').lean();
    const bill = claim?.billFiles?.[Number(billIndex)];
    if (!bill) return Response.json({ error: 'Bill not found.' }, { status: 404 });

    const buffer = await readCloudinaryPdf(bill.publicId);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(bill.name)}`,
      },
    });
  } catch (error) {
    return apiError(error, 'The saved bill could not be retrieved from Cloudinary.');
  }
}
