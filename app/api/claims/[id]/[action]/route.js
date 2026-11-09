import { del, get } from '@vercel/blob';
import mongoose from 'mongoose';
import Claim from '../../../../../src/server/models/Claim.js';
import Settings from '../../../../../src/server/models/Settings.js';
import { claimFileBase, generateClaimFiles, templateExists } from '../../../../../src/server/services/claimFiles.js';
import { sendClaimEmail } from '../../../../../src/server/services/email.js';
import connectDB from '../../../../../src/lib/db.js';
import { apiError } from '../../../../../src/lib/http.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isValidBill(bill) {
  return bill
    && typeof bill.pathname === 'string'
    && bill.pathname.startsWith('claim-bills/')
    && typeof bill.name === 'string'
    && bill.name.length <= 255
    && bill.name.toLowerCase().endsWith('.pdf')
    && !/[\\/\r\n]/.test(bill.name);
}

async function loadBills(bills) {
  if (!Array.isArray(bills) || bills.length < 1 || bills.length > 5 || !bills.every(isValidBill)) {
    const error = new Error('Attach between one and five PDF bills before sending the claim.');
    error.status = 400;
    throw error;
  }

  return Promise.all(bills.map(async ({ pathname, name }) => {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      const error = new Error(`Unable to retrieve ${name} from private storage.`);
      error.status = 400;
      throw error;
    }
    if (result.blob.contentType !== 'application/pdf' || result.blob.size > 10 * 1024 * 1024) {
      const error = new Error(`${name} must be a PDF no larger than 10 MB.`);
      error.status = 400;
      throw error;
    }
    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== '%PDF-') {
      const error = new Error(`${name} is not a valid PDF file.`);
      error.status = 400;
      throw error;
    }
    return { originalname: name, buffer };
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
    if (!await templateExists()) {
      return Response.json({ error: 'Claim template not found. Add your Excel file as public/claim-template.xlsx.' }, { status: 503 });
    }
    const { workbookBuffer, pdfBuffer } = await generateClaimFiles(claim);
    const filename = claimFileBase(claim.month);
    if (action === 'export.xlsx') {
      return new Response(workbookBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
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
      error?.status === 503 ? 'Gemini could not scan the claim template. Check the Gemini configuration and try again.' : undefined,
    );
  }
}

export async function POST(request, context) {
  try {
    const { id, action } = await context.params;
    if (action !== 'submit') return Response.json({ error: 'API route not found.' }, { status: 404 });
    if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Claim not found.' }, { status: 404 });

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
    const bills = await loadBills(submittedBills);
    const settings = await Settings.findOne({ key: 'default' }).lean();
    if (!settings?.to?.length) return Response.json({ error: 'Add at least one primary recipient first.' }, { status: 400 });
    const { pdfBuffer } = await generateClaimFiles(claim);
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

    try {
      await del(submittedBills.map(({ pathname }) => pathname));
    } catch (error) {
      console.error('Claim sent, but uploaded bill cleanup failed:', error);
    }
    return Response.json({ claim: claim.toObject(), message: 'Claim email sent successfully.' });
  } catch (error) {
    return apiError(
      error,
      error?.status === 503 ? 'Gemini could not scan the claim template. Check the Gemini configuration and try again.' : undefined,
    );
  }
}
