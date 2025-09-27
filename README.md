<h1 align="center">LUT · Fundamentals of Programming Attendance Portal</h1>

Modern, mobile-first attendance management for LUT University's Fundamentals of Programming exercise sessions. Students generate secure QR codes, while teachers (and admins) manage sessions and scan attendance directly from any browser. All data is persisted in Google Sheets via a service account for full auditability.

## Features

- **Student QR generator** – quick form creates a tamper-resistant QR payload.
- **Teacher dashboard** – launch sessions, scan codes with the device camera, and view grouped attendance history.
- **Role-based access** – administrators can review every instructor's classes; teachers see only their own.
- **Secure Sheets integration** – all operations happen server-side using a Google Cloud service account.

## Tech stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS v4 for styling
- Google Sheets API via `googleapis`
- `bcryptjs` for password hashing
- `jsonwebtoken` for stateless auth
- `qrcode.react` & `react-qr-reader` for QR generation & scanning
- `react-hook-form` and `react-hot-toast` for UX polish

## Environment setup

1. **Clone & install**

```powershell
npm install --legacy-peer-deps
```

2. **Create Google Cloud service account**

	- Enable the **Google Sheets API** in your project.
	- Create a service account and generate a JSON key.
	- Share the target spreadsheet with the service account email (Editor access).

3. **Configure your spreadsheet**

	Use a single spreadsheet with two sheets:

	- `Teachers` (or custom name) with header row: `teacher_id`, `email`, `password_hash`, `role`
	- `Attendance` with header row: `record_id`, `teacher_id`, `class_name`, `record_name`, `student_id`, `student_name`, `timestamp`

4. **Environment variables**

Create a `.env.local` file (never commit it):

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_TEACHERS_SHEET=Teachers
GOOGLE_ATTENDANCE_SHEET=Attendance
JWT_SECRET=generate-a-long-random-string
TEACHER_ADMIN_INVITE_CODE=optional-admin-code
```

> When pasting the private key, keep the `\n` escape sequences as shown so Next.js can load it correctly.

## Development & deployment

### Run locally

```powershell
npm run dev
```

Visit `http://localhost:3000`.

### Quality checks

```powershell
npm run lint
```

### Deploy to Vercel

1. Push the repository to GitHub.
2. Create a new Vercel project and import the repo.
3. Add the environment variables above in the Vercel dashboard.
4. Deploy – Vercel will build with `npm run build` automatically.

Remember to paste the private key with escaped newlines in the **Vercel UI** (replace literal line breaks with `\n`).

## Data flow overview

1. Students submit name + ID → receive QR code containing a signed JSON payload with a fixed prefix.
2. Teachers authenticate via the App Router API routes (passwords hashed with bcrypt).
3. Each new session appends a meta row in the attendance sheet; every scan appends an individual attendance row.
4. Admins can query all rows; teachers are restricted to their `teacher_id`.

## Roadmap ideas

- Offline-first teacher PWA for weak connectivity classrooms.

## Contributing

Issues and suggestions are welcome! Please open a ticket describing the improvement or problem, and include as much reproduction detail as possible.

---

Built for LUT University's Fundamentals of Programming course · 2025
