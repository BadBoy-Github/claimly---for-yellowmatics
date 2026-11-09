import Claim from '../../../src/server/models/Claim.js';
import { claimSchema, validateExpenseAmounts } from '../../../src/server/utils/claim.js';
import connectDB from '../../../src/lib/db.js';
import { apiError } from '../../../src/lib/http.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('history') === 'true') {
      await connectDB();
      const claims = await Claim.find({ status: 'submitted' }).sort({ submittedAt: -1 }).lean();
      return Response.json({ claims });
    }

    const month = searchParams.get('month') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: 'A valid month in YYYY-MM format is required.' }, { status: 400 });
    }
    await connectDB();
    const claim = await Claim.findOne({ month }).lean();
    return Response.json({ claim });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const parsed = claimSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Check the claim month and expense details.' }, { status: 400 });
    }
    const amountError = validateExpenseAmounts(parsed.data.expenses);
    if (amountError) return Response.json({ error: amountError }, { status: 400 });

    await connectDB();
    const claim = await Claim.findOneAndUpdate(
      { month: parsed.data.month },
      {
        $set: {
          ...parsed.data,
          name: 'Elayabarathi M V',
          email: 'elayabarathimv@gmail.com',
          status: 'draft',
          submittedAt: null,
          submittedTo: [],
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return Response.json({ claim });
  } catch (error) {
    return apiError(error);
  }
}
