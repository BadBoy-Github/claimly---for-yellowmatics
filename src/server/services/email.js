import nodemailer from 'nodemailer';
import { claimFileBase } from './claimFiles.js';

export async function sendClaimEmail({ claim, settings, pdfBuffer, billFiles, subject }) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) {
    const error = new Error('Set GMAIL_USER and GMAIL_APP_PASSWORD in the app environment before sending claims.');
    error.status = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: password },
  });
  const safeMonth = new Date(`${claim.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const filename = claimFileBase(claim.month);
  const attachments = [
    { filename: `${filename}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
    ...billFiles.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: 'application/pdf',
    })),
  ];

  return transporter.sendMail({
    from: { name: claim.name, address: user },
    to: settings.to,
    cc: settings.cc,
    subject,
    text: `Please find the ${safeMonth} expense claim and supporting bill PDFs attached.`,
    attachments,
  });
}
