-- Al Mustafa Academy — PostgreSQL Schema (for Neon / Vercel deployment)
-- Run in Neon SQL Editor once, or it is auto-applied by db.ts on first connect.

-- 1. Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_arabic TEXT,
  display_order INTEGER NOT NULL
);

-- 2. Users table (staff / teachers / admins)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  surname TEXT,
  first_name TEXT,
  middle_name TEXT,
  role TEXT DEFAULT 'teacher',
  is_admin INTEGER DEFAULT 0,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  book_name TEXT,
  book_author TEXT
);

-- 4. Students table
CREATE TABLE IF NOT EXISTS public.students (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  surname TEXT,
  first_name TEXT,
  middle_name TEXT,
  gender TEXT,
  date_of_birth TEXT,
  address TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  passport_photo TEXT,
  student_password TEXT DEFAULT 'student123',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Results table
CREATE TABLE IF NOT EXISTS public.results (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
  year TEXT NOT NULL,
  test_score DOUBLE PRECISION CHECK (test_score IS NULL OR (test_score >= 0 AND test_score <= 30)),
  exam_score DOUBLE PRECISION CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 70)),
  ca1_score DOUBLE PRECISION CHECK (ca1_score IS NULL OR (ca1_score >= 0 AND ca1_score <= 10)),
  ca2_score DOUBLE PRECISION CHECK (ca2_score IS NULL OR (ca2_score >= 0 AND ca2_score <= 10)),
  ca3_score DOUBLE PRECISION CHECK (ca3_score IS NULL OR (ca3_score >= 0 AND ca3_score <= 10)),
  total_score DOUBLE PRECISION GENERATED ALWAYS AS (COALESCE(test_score, 0) + COALESCE(exam_score, 0)) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5b. Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  marked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, session_date)
);

-- 5c. Student term reports (Hifdh progress + behaviour remarks)
CREATE TABLE IF NOT EXISTS public.student_term_reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
  year TEXT NOT NULL,
  hifdh_progress TEXT,
  behavior_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term, year)
);

-- 5d. Student scratch-card PINs
-- student_id is NULL until a card is redeemed by a specific student;
-- class_id optionally scopes a batch to one class.
CREATE TABLE IF NOT EXISTS public.student_pins (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
  pin TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  login_time TIMESTAMPTZ NOT NULL,
  logout_time TIMESTAMPTZ,
  session_date DATE NOT NULL
);

-- 7. Password resets table
CREATE TABLE IF NOT EXISTS public.password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Site content table
CREATE TABLE IF NOT EXISTS public.site_content (
  id SERIAL PRIMARY KEY,
  content_key TEXT UNIQUE NOT NULL,
  content_value TEXT NOT NULL DEFAULT ''
);

-- 9. Teacher-class assignments
CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, class_id)
);

-- 10. Result sheet config
CREATE TABLE IF NOT EXISTS public.result_sheet_config (
  id SERIAL PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL DEFAULT ''
);
