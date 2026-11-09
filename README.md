# Claimly — monthly expense claims

A single Next.js application for recording monthly travel and food expenses, saving claims in MongoDB, filling an Excel template, exporting the completed worksheet as PDF, and emailing claims with supporting bill PDFs.

## Local development

- Node.js 20.9 or newer
- MongoDB connection string (MongoDB Atlas is recommended for Vercel)
- A Google Gemini API key (optional; enables the claim assistant)
- A Gmail app password (optional; enables email submission)
- A Vercel Blob store (required for supporting bill uploads)
- Your claim Excel workbook (optional; enables exports and email submission)

1. Install dependencies from the repository root:

   ```powershell
   npm install
   ```

2. Set `MONGODB_URI` in `.env.local`. Add the Gemini and Gmail credentials if you want to use those features.

3. Put your Excel workbook at `public/claim-template.xlsx`. The workbook’s first worksheet is used. If a row near the top has recognizable expense headers (such as Date, Category, Description, KM, and Amount), each expense is written into that table. Otherwise, a claim schedule is added below the existing sheet contents.

4. Create a **private** Vercel Blob store and connect it to your Vercel project, including the **Development** environment and a read-write token. Pull the linked project's Development variables into `.env.local` with `vercel env pull .env.local`. This ensures the local app uses the valid `BLOB_READ_WRITE_TOKEN` for that store; a token from another, deleted, or unconnected store can still generate an upload token but Blob will reject the actual upload.

5. Start the app:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

## Deploy to Vercel

1. Import this repository into Vercel with the repository root as the project root. Vercel detects Next.js automatically; use `npm run build` as the build command and leave the output directory at its default.
2. Connect a **private** Vercel Blob store to the project. Client uploads go directly from the browser to Blob, avoiding the Vercel Functions request-body limit; uploaded bills are private and removed after successful submission.
3. Add these environment variables to the Vercel project:
   - `MONGODB_URI` — a MongoDB Atlas URI reachable from Vercel.
   - `GMAIL_USER` and `GMAIL_APP_PASSWORD` — required to send claims.
   - `GEMINI_API_KEY` — optional; required for assistant insights.
   - `GEMINI_MODEL` — optional; defaults to `gemini-3.5-flash-lite`.
   - `BLOB_READ_WRITE_TOKEN` — supplied when the Blob store is connected.
4. Upload the workbook to `public/claim-template.xlsx` and redeploy. Without it, claims can still be saved, but exports and submissions are unavailable.
5. **Enable Vercel Deployment Protection for every environment, including production, before sharing or using the deployment.** This app intentionally has no login. Deployment Protection is required to restrict access to claims, recipients, email submission, and the Blob upload-token endpoint.

## Claim workflow

- Travel is calculated at ₹5/km for bike or ₹10/km for car. Food amounts are entered directly.
- Save stores the month and expenses in MongoDB. Recipient addresses are saved separately in MongoDB.
- Use the separate Email settings and Previous claims pages from the workspace navigation. Submitted claims are listed in the archive with Excel and PDF downloads.
- Expense fields and recipient addresses are validated in the app and reported using toast notifications. Existing expenses can be edited before submission.
- Attach up to five supporting PDF bills (10 MB each). On send, each bill uploads directly to private Vercel Blob storage; the API fills the template, renders its worksheet to `CLAIM_Elayabarathi M V_<Month-Year>.pdf`, and emails it with the bill PDFs.
- After saving, the dashboard offers completed Excel and PDF downloads.
- When `GEMINI_API_KEY` is configured, Gemini scans the claim workbook's expense-table headers before entries are written. Only candidate header labels and cell positions are sent for that scan; expense values are not. Without Gemini, the local header matcher is used.
- The Gemini claim assistant summarizes saved expenses and flags only obvious missing details. It does not change claims or send email.
- The hero uses the React Bits `BlurText` component, with reduced-motion support.
- Routes `/403` and unknown paths show custom forbidden and not-found pages.

## Notes

- Keep `.env.local` private; it is excluded from Git.
- MongoDB Atlas must allow connections from your Vercel deployment. Use an appropriately scoped database user.
- Excel-to-PDF output is rendered from the filled first worksheet, including its visible cell values. Complex Excel-only features such as macros, embedded charts, or page-specific print layouts are not reproduced.
- If Google does not recognize the default Gemini model for your API key, set `GEMINI_MODEL` to a supported model.
