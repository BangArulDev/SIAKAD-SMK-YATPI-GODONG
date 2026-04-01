import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAppStore from "../store/useAppStore";
import Login from "../components/Login";

export default function LandingPage() {
  const navigate = useNavigate();
  const { session, logout } = useAppStore();

  useEffect(() => {
    if (session) {
      if (session.role === "siswa") navigate("/absensi");
      else if (session.role === "guru" || session.role === "admin") navigate("/dashboard");
      else logout();
    }
  }, [session, navigate, logout]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="bg-animated" />

      {/* Decorative orbs */}
      <div className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Header card */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/5 mb-5 shadow-2xl shadow-indigo-500/20 border border-white/10 animate-pulse-ring">
            <img
              src="/LOGO SMK YATPI.svg"
              alt="Logo SMK Yatpi"
              className="w-20 h-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1">
            <span className="text-gradient">SSO YATPI</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">Portal Kehadiran Digital · Godong</p>
        </div>

        {/* Login Component */}
        <Login />

        {/* Footer credit */}
        <p className="text-center text-xs text-slate-600 mt-5">
          © {new Date().getFullYear()} <span className="text-slate-500 font-medium">Amrully Arun Hadi</span>
        </p>
      </div>
    </div>
  );
}
