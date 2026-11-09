import mongoose from 'mongoose';
import Claim from '../../../../../src/server/models/Claim.js';
import Settings from '../../../../../src/server/models/Settings.js';
import { claimFileBase, generateClaimFiles, templateExists } from '../../../../../src/server/services/claimFiles.js';
import { isCloudinaryConfigured, readCloudinaryPdf, uploadCloudinaryPdf } from '../../../../../src/server/services/cloudinary.js';
import { sendClaimEmail } from '../../../../../src/server/services/email.js';
import connectDB from '../../../../../src/lib/db.js';
import { apiError } from '../../../../../src/lib/http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

async function loadBills(bills, claimId) {
  if (
    !Array.isArray(bills)
    || bills.length < 1
    || bills.length > 5
    || !bills.every((bill) => isValidBill(bill, claimId))
    || new Set(bills.map(({ publicId }) => publicId)).size !== bills.length
  ) {
    const error = new Error('Attach between one and five PDF bills before sending the claim.');
    error.status = 400;
    throw error;
  }

  return Promise.all(bills.map(async ({ publicId, name }) => {
    const buffer = await readCloudinaryPdf(publicId);
    if (buffer.length > 10 * 1024 * 1024) {
      const error = new Error(`${name} must be a PDF no larger than 10 MB.`);
      error.status = 400;
      throw error;
    }
    if (buffer.subarray(0, 5).toString() !== '%PDF-') {
      const error = new Error(`${name} is not a valid PDF file.`);
      error.status = 400;
      throw error;
    }
    return { publicId, originalname: name, buffer };
  }));
}

export async function GET(_request, context) {
  try {
    const { id, action } = await context.params;
    if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    if (!['export.xlsx', 'export.pdf'].includes(action)) {
      return Response.json({ error: 'Choose xlsx or pdf format.' }, { status: 400 });
    }
    await connectDB();
    const claim = await Claim.findById(id).lean();
    if (!claim) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    const filename = claimFileBase(claim.month);
    if (action === 'export.xlsx') {
      if (!await templateExists()) {
        return Response.json({ error: 'Claim template not found. Add your Excel file as public/claim-template.xlsx.' }, { status: 503 });
      }
      const { workbookBuffer } = await generateClaimFiles(claim);
      return new Response(workbookBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }
    let pdfBuffer;
    if (claim.pdfPublicId) {
      pdfBuffer = await readCloudinaryPdf(claim.pdfPublicId);
    } else {
      if (!await templateExists()) {
        return Response.json({ error: 'Claim template not found. Add your Excel file as public/claim-template.xlsx.' }, { status: 503 });
      }
      ({ pdfBuffer } = await generateClaimFiles(claim));
    }
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    return apiError(
      error,
      error?.status === 503 ? 'Claim file service is unavailable. Check the Cloudinary and Gemini configuration.' : undefined,
    );
  }
}

export async function POST(request, context) {
  try {
    const { id, action } = await context.params;
    if (action !== 'submit') return Response.json({ error: 'API route not found.' }, { status: 404 });
    if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    if (!isCloudinaryConfigured()) {
      const error = new Error('Configure Cloudinary before sending claims.');
      error.status = 503;
      throw error;
    }

    await connectDB();
    const claim = await Claim.findById(id);
    if (!claim) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    if (claim.status === 'submitted') {
      return Response.json({ error: 'This monthly claim has already been submitted.' }, { status: 409 });
    }
    if (!claim.expenses.length) return Response.json({ error: 'Add at least one expense before sending.' }, { status: 400 });
    if (!await templateExists()) {
      return Response.json({ error: 'Claim template not found. Add your Excel file as public/claim-template.xlsx.' }, { status: 503 });
    }

    const payload = await request.json();
    const submittedBills = payload?.bills;
    const bills = await loadBills(submittedBills, id);
    const settings = await Settings.findOne({ key: 'default' }).lean();
    if (!settings?.to?.length) return Response.json({ error: 'Add at least one primary recipient first.' }, { status: 400 });
    const { pdfBuffer: generatedPdf } = await generateClaimFiles(claim);
    const pdfPublicId = `claim-files/${id}/claim`;
    await uploadCloudinaryPdf(pdfPublicId, generatedPdf);
    const pdfBuffer = await readCloudinaryPdf(pdfPublicId);

    claim.billFiles = bills.map(({ publicId, originalname }) => ({ publicId, name: originalname }));
    claim.pdfPublicId = pdfPublicId;
    await claim.save();

    await sendClaimEmail({
      claim,
      settings,
      pdfBuffer,
      billFiles: bills,
      subject: claimFileBase(claim.month),
    });

    claim.status = 'submitted';
    claim.submittedAt = new Date();
    claim.submittedTo = [...settings.to, ...settings.cc];
    await claim.save();

    return Response.json({ claim: claim.toObject(), message: 'Claim email sent successfully.' });
  } catch (error) {
    return apiError(
      error,
      error?.status === 503
        ? 'Claim submission is not configured. Check Cloudinary, Gemini, and the claim template settings.'
        : 'The claim could not be completed. Check Cloudinary credentials and try again.',
    );
  }
}
