import mongoose from 'mongoose';
import { templateExists } from '../../../src/server/services/claimFiles.js';
import { isCloudinaryConfigured } from '../../../src/server/services/cloudinary.js';
import { isGoogleDriveConfigured } from '../../../src/server/services/googleDrive.js';
import connectDB from '../../../src/lib/db.js';

export const runtime = 'nodejs';

export async function GET() {
  let database = mongoose.connection.readyState === 1;
  if (!database) {
    try {
      await connectDB();
      database = true;
    } catch (error) {
      console.error('MongoDB health check failed:', error);
    }
  }

  const template = await templateExists();
  return Response.json({
    status: database ? 'ok' : 'degraded',
    database: database ? 'connected' : 'disconnected',
    template: template ? 'available' : 'missing',
    gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
    email: process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'configured' : 'not_configured',
    storage: isCloudinaryConfigured() ? 'configured' : 'not_configured',
    pdfConversion: isGoogleDriveConfigured() ? 'configured' : 'not_configured',
  }, { status: database ? 200 : 503 });
}
