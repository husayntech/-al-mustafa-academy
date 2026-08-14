export type ScreenId = "home" | "welcome" | "admissions" | "curriculum" | "calendar" | "faq" | "gallery" | "teacher-login" | "teacher-portal" | "teacher-landing" | "admin-settings" | "student-login";

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  image: string;
  alt: string;
}

export interface FacilityItem {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

export interface ActivityGroup {
  id: string;
  title: string;
  items: string[];
}

export interface ScheduleItem {
  time: string;
  title: string;
  description: string;
}

export interface PillarItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Student Management Types
export interface Class {
  id: number;
  name: string;
  name_arabic: string;
  display_order: number;
}

export interface Subject {
  id: number;
  class_id: number;
  name: string;
  book_name: string;
  book_author: string;
}

export interface Student {
  id: number;
  class_id: number;
  full_name: string;
  surname?: string;
  first_name?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  parent_name?: string;
  parent_phone?: string;
  passport_photo?: string;
  student_password?: string;
  created_at: string;
  result_count?: number;
}

export interface Result {
  id: number;
  student_id: number;
  subject_id: number;
  term: number;
  year: string;
  test_score: number | null;      // Max 30
  exam_score: number | null;      // Max 70
  ca1_score?: number | null;      // CA breakdown component 1 (max 10)
  ca2_score?: number | null;      // CA breakdown component 2 (max 10)
  ca3_score?: number | null;      // CA breakdown component 3 (max 10)
  total_score: number | null;     // Computed: test + exam
  remarks: string | null;
  created_at: string;
  subject_name?: string;
  book_name?: string;
}

export interface TermReport {
  id?: number;
  student_id: number;
  class_id: number;
  term: number;
  year: string;
  hifdh_progress: string | null;
  behavior_remarks: string | null;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  surname?: string;
  first_name?: string;
  middle_name?: string;
  role: string;
  is_admin?: number | boolean;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Session {
  id: number;
  user_id: number;
  login_time: string;
  logout_time: string | null;
  session_date: string;
  full_name?: string;
}
