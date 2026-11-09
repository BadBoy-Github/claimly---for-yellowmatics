# Claimly — monthly expense claims

A single Next.js application for recording monthly travel and food expenses, saving claims in MongoDB, filling an Excel template, exporting the completed worksheet as PDF, and emailing claims with supporting bill PDFs.

## Local development

- Node.js 20.9 or newer
- MongoDB connection string (MongoDB Atlas is recommended for Vercel)
- A Google Gemini API key (optional; enables the claim assistant)
- A Gmail app password (optional; enables email submission)
- A Cloudinary account (required for bill uploads and stored claim PDFs)
- A Google Drive OAuth client (required to render the filled Excel template as PDF on Vercel)
- Your claim Excel workbook (optional; enables exports and email submission)

1. Install dependencies from the repository root:

   ```powershell
   npm install
   ```

2. Set `MONGODB_URI` in the environment file loaded by Next.js (for example, `.env.local` or `.env`). Add the Gemini and Gmail credentials if you want to use those features.

3. Put your Excel workbook at `public/claim-template.xlsx`. The workbook’s first worksheet is used. If a row near the top has recognizable expense headers (such as Date, Category, Description, KM, and Amount), each expense is written into that table. Otherwise, a claim schedule is added below the existing sheet contents.

4. In Cloudinary Console, find the cloud name, API key, and API secret under **Settings → API Keys**. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the environment file loaded by Next.js. Next.js loads `.env.local` ahead of `.env`, so update the file your local dev server actually uses. Keep the API secret server-side; never expose it as a `NEXT_PUBLIC_` variable.
5. In Cloudinary security settings, allow PDF delivery. The app uploads PDFs as `authenticated` image assets so they require time-limited signed URLs; do not make the assets publicly accessible.

6. Enable the Google Drive API in a Google Cloud project, configure an OAuth consent screen, and create a Web application OAuth client with `https://developers.google.com/oauthplayground` as an authorized redirect URI. In OAuth Playground's settings, use that client, authorize the account that should own temporary claim workbooks for the `https://www.googleapis.com/auth/drive.file` scope, and exchange the authorization code for an offline refresh token. Set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN` in the environment. Keep all three values server-side. The app temporarily converts each filled workbook to a Google Sheet, exports it as PDF, and deletes the temporary Sheet before continuing. OAuth consent apps left in Testing may issue refresh tokens that expire after seven days; publish the consent app or renew the token when required.

7. Configure the private sign-in in `.env.local` or `.env`: `AUTH_EMAIL` is the allowed login email, `AUTH_PASSWORD` is a strong, unique password, and `AUTH_SECRET` is a random signing secret of at least 32 bytes. Generate the secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   The session cookie is HTTP-only, secure in production, and expires after eight hours. Changing the configured email or password invalidates existing sessions. Five incorrect passwords from the same IP trigger a 15-minute lockout; this uses MongoDB, so configure MongoDB before testing sign-in. Private pages redirect to sign-in, API routes reject unauthenticated requests, invalid credentials show the custom forbidden page, and unknown routes use the custom 404.

8. Start the app:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

## Deploy to Vercel

1. Import this repository into Vercel with the repository root as the project root. Vercel detects Next.js automatically; use Node.js 22.x, `npm run build` as the build command, and leave the output directory at its default.
2. Add these environment variables to the Vercel project for **Production, Preview, and Development** as needed:
   - `MONGODB_URI` — a MongoDB Atlas URI reachable from Vercel.
   - `GMAIL_USER` and `GMAIL_APP_PASSWORD` — required to send claims.
   - `GEMINI_API_KEY` — optional; required only for assistant insights and AI template-header scanning.
   - `GEMINI_MODEL` — optional; defaults to `gemini-3.5-flash-lite`.
   - `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name.
   - `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` — Cloudinary API credentials.
   - `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN` — OAuth credentials for the Google account used for temporary workbook conversion.
   - `AUTH_EMAIL` — the one email address permitted to sign in.
   - `AUTH_PASSWORD` — a strong, unique password for that account.
   - `AUTH_SECRET` — a randomly generated secret with at least 32 bytes; generate a separate value from your local secret.
3. Keep every credential server-side; do not use `NEXT_PUBLIC_` prefixes. Never commit `.env` or paste credentials into GitHub, chat, or logs. `.env*` is ignored by Git; only `.env.example` is safe to commit.
4. Configure MongoDB Atlas network access for Vercel and use a least-privilege database user. The app stores claims, recipient settings, and login lockout records in MongoDB.
5. Upload the workbook to `public/claim-template.xlsx` and redeploy. Without it, claims can still be saved, but exports and submissions are unavailable.
6. The app requires its own email/password sign-in; API routes are also protected. Vercel Deployment Protection may be enabled as an additional layer, but is not a replacement for the app login. The login uses an eight-hour signed session cookie and MongoDB-backed lockouts after five incorrect attempts per IP.
7. GitHub Actions runs the authentication tests and production build on pull requests and pushes to `main`. Vercel can then deploy the successful `main` build; confirm all production environment variables are configured before promoting the deployment.

## Claim workflow

- Travel is calculated at ₹5/km for bike or ₹10/km for car. Food amounts are entered directly.
- Save stores the month and expenses in MongoDB. Recipient addresses are saved separately in MongoDB.
- Use the separate Email settings and Previous claims pages from the workspace navigation. Submitted claims are listed in the archive with Excel and PDF downloads.
- Expense fields and recipient addresses are validated in the app and reported using toast notifications. Existing expenses can be edited before submission.
- Supporting bill PDFs are optional; attach up to five (10 MB each). Selected bills upload to Cloudinary as authenticated assets and their names and IDs are saved to the MongoDB draft, so they are restored after refresh and can be previewed or removed. Sending without bills emails only the completed claim PDF. With bills, the API retrieves them, fills the company Excel template without replacing its formatting, temporarily converts the workbook through Google Drive, deletes the temporary Google Sheet, stores the generated PDF in Cloudinary as an authenticated asset, and emails the claim PDF with the selected bills.
- After saving, the dashboard offers completed Excel and PDF downloads.
- When `GEMINI_API_KEY` is configured, Gemini scans the claim workbook's expense-table headers before entries are written. Only candidate header labels and cell positions are sent for that scan; expense values are not. Without Gemini, the local header matcher is used.
- The Gemini claim assistant summarizes saved expenses and flags only obvious missing details. It does not change claims or send email.
- The hero uses the React Bits `BlurText` component, with reduced-motion support.
- Routes `/403` and unknown paths show custom forbidden and not-found pages.

## Notes

- Keep `.env` and `.env.local` private; they are excluded from Git.
- Before pushing, verify `git check-ignore .env` reports it ignored and `git ls-files .env` returns no tracked file. If credentials were ever committed or shared, rotate them before deploying.
- MongoDB Atlas must allow connections from your Vercel deployment. Use an appropriately scoped database user.
- PDF conversion sends the filled claim workbook to the authorized Google Drive account. The temporary Google Sheet is deleted after export; Google Drive must be configured for PDF exports to work. Vercel does not include a spreadsheet renderer, so this conversion renders the actual filled template instead of drawing a separate table. Google Sheets may handle some Excel-only features differently; verify the first PDF against the template, especially any macros, complex formulas, or embedded objects.
- If Google does not recognize the default Gemini model for your API key, set `GEMINI_MODEL` to a supported model.
