# 🕌 Al Mustafa Academy

> **نُهذِّبُ الأخلاقَ، ونُنمِّي الآفاقَ**
> *Refining Character, Expanding Horizons*

A full-stack school management portal for Al Mustafa Academy, Ilorin, Nigeria — a world-class institution bridging sacred Islamic tradition with modern academic excellence since 2013.

---

## ✨ Features

### Public Website
- **Home Page** — Hero section, mission statement, tradition & excellence cards
- **Admissions** — Step-by-step process, required documents, fees, contact inquiry form
- **Madrasah Activities** — Daily schedule, weekly program, announcements

### Admin Dashboard
- **Staff Management** — Register staff with Surname / First Name / Middle Name, phone, email, address, passport photo, and admin privileges toggle
- **Student Management** — Register students with full bio data, class assignment
- **Class Management** — Create/manage classes, assign teachers
- **Assignments** — Create, publish, and grade assignments per class
- **Sessions & Terms** — Manage academic sessions and terms
- **Content Management** — Edit all website text, images, colors, fonts, spacing via a live CMS
- **Result Sheet** — Generate PDF, Excel, and CSV result sheets per student or class
- **Tools** — Export/import data, bulk operations

### Staff/Teacher Portal
- **Dual Role Support** — A staff member can be both a Teacher and Admin simultaneously
- **Bio Data Display** — View personal information on the dashboard
- **Assignment Grading** — Grade student submissions with comments

### Student Portal
- **Bio Data Display** — View personal information after login
- **Assignment Submissions** — Submit assignments and view grades

### Authentication & Security
- **JWT Authentication** — Secure token-based login for all portals
- **Remember Me** — 30-day persistent sessions vs 8-hour default
- **Forgot Password** — Gmail-linked password reset with 6-digit code
- **Admin Password Reset** — Admins can reveal or reset any staff member's password
- **Browser Password Save** — Native browser autofill support

### Content & Theming
- **Live Theme Editor** — Change primary/secondary colors, fonts, heading sizes
- **Custom CSS Styling** — Apply styles to any element via the inspector
- **Section Spacing Control** — Adjust padding/gaps between sections

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4 |
| **Animation** | Motion (Framer Motion successor) |
| **Icons** | Lucide React |
| **Rich Text** | Custom Rich Text Editor |
| **PDF Generation** | jsPDF + jsPDF-AutoTable |
| **Backend** | Node.js + Express |
| **Database** | Supabase PostgreSQL (with local sql.js fallback for dev) |
| **Authentication** | JWT + bcryptjs |
| **Email** | Nodemailer (Gmail SMTP) |
| **Build Tool** | Vite + esbuild |
| **Runtime** | tsx (TypeScript Execute) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (v20+ recommended)
- **npm** v9+

### 1. Clone the repository

```bash
git clone https://github.com/husayntech/-al-mustafa-academy.git
cd -al-mustafa-academy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your settings (see [Environment Variables](#-environment-variables) below).

### 4. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

### 5. Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

> ⚠️ **Change the admin password immediately after first login!**

---

## 📁 Project Structure

```
al-mustafa-academy/
├── data/                    # SQLite database (auto-created)
├── uploads/                 # Uploaded files (logo, passport photos)
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── Header.tsx           # Site header with nav & logo
│   │   ├── Footer.tsx           # Site footer
│   │   ├── HomeTab.tsx          # Home page
│   │   ├── AdmissionsTab.tsx    # Admissions page
│   │   ├── MadrasahActivitiesTab.tsx  # Madrasah Activities page
│   │   ├── Chatbot.tsx          # AI chatbot widget
│   │   ├── ContentInspector.tsx # Live content editor
│   │   ├── SpacingGuide.tsx     # Visual spacing adjuster
│   │   └── TeacherPortal/
│   │       ├── AdminSettings.tsx    # Admin dashboard
│   │       ├── TeacherDashboard.tsx # Staff portal
│   │       ├── StudentLogin.tsx     # Student portal
│   │       ├── LoginPage.tsx        # Staff login
│   │       ├── AdminLoginPage.tsx   # Admin login
│   │       ├── ForgotPassword.tsx   # Password reset flow
│   │       ├── RichTextEditor.tsx   # WYSIWYG editor
│   │       └── ...
│   ├── lib/
│   │   ├── siteContent.ts       # CMS content system
│   │   ├── customStyles.ts      # Custom CSS injection
│   │   ├── resultSheet.ts       # PDF/Excel/CSV generation
│   │   └── cleanHtml.ts         # HTML sanitization
│   ├── types.ts                 # TypeScript interfaces
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles (Tailwind)
├── supabase/
│   └── migrations/              # SQL schema migrations
├── server.ts                # Express API server
├── db.ts                    # Database setup & migrations
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── .gitignore
```

---

## 🔧 Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (prod) | PostgreSQL connection string (Supabase pooler recommended). Falls back to local sql.js file DB when unset |
| `SUPABASE_URL` | Yes (prod) | Supabase project URL (for persistent image uploads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod) | Supabase service-role key (server-side storage access) |
| `SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon/publishable key |
| `GEMINI_API_KEY` | No | Google Gemini AI key (for chatbot) |
| `APP_URL` | No | Public URL of the app |
| `SMTP_USER` | No | Gmail address for password reset emails |
| `SMTP_PASS` | No | Gmail App Password (not your real password) |
| `SMTP_HOST` | No | SMTP server (default: `smtp.gmail.com`) |
| `SMTP_PORT` | No | SMTP port (default: `587`) |

> 💡 If `SMTP_USER` and `SMTP_PASS` are not set, the app runs in **DEV MODE** — password reset codes are displayed in the server console instead of being emailed.

### Gmail Setup for Password Reset Emails

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification**
3. Go to **App passwords** (search for it in Google Account settings)
4. Generate a new app password for "Mail"
5. Use that 16-character password as `SMTP_PASS`

---

## 🏗 Production Build

```bash
# Build frontend + bundle server
npm run build

# Start production server
npm start
```

The production build creates:
- `dist/` — Vite-built frontend assets
- `dist/server.cjs` — Bundled Express server

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Type-check with TypeScript |

---

## 🔐 User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all dashboards, staff/student management, content editing, settings |
| **Teacher** | Staff portal, class assignments, student grading |
| **Student** | Student portal, view assignments, submit work |

Staff members can have **dual roles** — a teacher can also have admin privileges, allowing access to both portals.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is private and proprietary to Al Mustafa Academy.

---

## 📞 Contact

**Al Mustafa Academy**
25, Sabo-Line Road, Opposite Saw-Mill, Ilorin, Nigeria
- 📧 almustafaacademyilorin@gmail.com
- 📱 08037525855

---

<p align="center">
  <em>Where the Qur'an and Sunnah Shape Character and Excellence</em>
</p>
