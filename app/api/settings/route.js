import Settings from '../../../src/server/models/Settings.js';
import { settingsSchema } from '../../../src/server/utils/claim.js';
import connectDB from '../../../src/lib/db.js';
import { apiError } from '../../../src/lib/http.js';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await connectDB();
    const settings = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $setOnInsert: { key: 'default' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json({ to: settings.to, cc: settings.cc });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request) {
  try {
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Enter valid email addresses for To and CC.' }, { status: 400 });
    }
    await connectDB();
    const settings = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $set: parsed.data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json({ to: settings.to, cc: settings.cc });
  } catch (error) {
    return apiError(error);
  }
}
