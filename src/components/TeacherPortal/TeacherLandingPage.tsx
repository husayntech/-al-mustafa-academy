import { motion } from "motion/react";
import {
  School, LogIn, BookOpen, Users, FileText, Download,
  Calendar, Shield, CheckCircle, ArrowRight, Clock
} from "lucide-react";

interface TeacherLandingPageProps {
  onLogin: () => void;
  onBack: () => void;
}

export default function TeacherLandingPage({ onLogin, onBack }: TeacherLandingPageProps) {
  const features = [
    {
      icon: BookOpen,
      title: "Manage Subjects & Books",
      desc: "View and manage subjects and textbooks for each class",
    },
    {
      icon: Users,
      title: "Student Management",
      desc: "Add, edit, and organize students across all classes",
    },
    {
      icon: FileText,
      title: "Termly Results Entry",
      desc: "Enter percentage scores and letter grades for 3 terms",
    },
    {
      icon: Download,
      title: "Download Result Sheets",
      desc: "Generate and download professional PDF result sheets",
    },
    {
      icon: Calendar,
      title: "Academic Year Tracking",
      desc: "Track progress across the full academic year",
    },
    {
      icon: Clock,
      title: "Session Monitoring",
      desc: "Real-time session tracking with login time and duration",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary via-primary-container to-primary text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white" />
          <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <button
            onClick={onBack}
            className="text-white/60 hover:text-white mb-8 text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            ← Back to Home
          </button>
          <div className="max-w-3xl">
            <div className="w-16 h-16 bg-secondary-container/20 rounded-2xl flex items-center justify-center mb-6 border border-secondary/20">
              <School className="w-8 h-8 text-secondary-fixed" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-4">
              Teacher Portal
            </h1>
            <p className="text-lg text-white/80 max-w-xl mb-8 leading-relaxed">
              A comprehensive platform for managing student data, recording termly results,
              tracking academic progress, and generating result sheets — all in one place.
            </p>
            <motion.button
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLogin}
              className="inline-flex items-center gap-2.5 bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-8 py-4 rounded-full font-bold text-sm shadow-lg transition-all cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              Sign In to Portal
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl text-primary font-bold mb-3">
            Everything You Need
          </h2>
          <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="bg-white border border-primary/5 rounded-xl p-6 hover:shadow-lg hover:border-secondary/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-secondary-fixed/20 flex items-center justify-center mb-4 group-hover:bg-secondary-fixed/30 transition-colors">
                  <Icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="font-serif font-bold text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{feature.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick Start / Info */}
      <div className="bg-surface-container-low border-y border-primary/5">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl text-primary font-bold mb-4">
            Secure & Private
          </h2>
          <p className="text-sm text-on-surface-variant max-w-lg mx-auto leading-relaxed">
            All student data is stored locally on the school's server using SQLite.
            Teachers authenticate with their credentials, and all sessions are logged
            for accountability. Only authorized staff can access student records.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Local SQLite Database
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              JWT Authentication
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Session Logging
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Role-based Access
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-on-surface-variant mb-4">
          Default credentials: <strong>teacher</strong> / <strong>teacher123</strong>
        </p>
        <button
          onClick={onLogin}
          className="inline-flex items-center gap-2 bg-primary text-white hover:bg-primary-container px-8 py-3.5 rounded-full font-semibold text-sm shadow-md transition-all cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          Sign In to Get Started
        </button>
      </div>
    </motion.div>
  );
}
