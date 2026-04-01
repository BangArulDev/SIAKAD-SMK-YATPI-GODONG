import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAppStore from "../store/useAppStore";
import { useToast } from "../components/Toast";
import { GraduationCap, User, Lock, LogIn, Loader2 } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { session, loginSiswa, loginGuru, logout } = useAppStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("siswa");
  const [nisn, setNisn] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      if (session.role === "siswa") navigate("/absensi");
      else if (session.role === "guru" || session.role === "admin") navigate("/dashboard");
      else logout();
    }
  }, [session, navigate, logout]);

  const handleSiswaSubmit = async (e) => {
    e.preventDefault();
    if (!nisn.trim()) return addToast("NISN tidak boleh kosong", "warning");
    setLoading(true);
    try {
      await loginSiswa(nisn.trim());
      addToast("Berhasil masuk sebagai Siswa", "success");
      navigate("/absensi");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGuruSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return addToast("Lengkapi username dan password", "warning");
    setLoading(true);
    try {
      await loginGuru(username.trim(), password);
      addToast("Login Berhasil", "success");
      navigate("/dashboard");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

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

        {/* Main card */}
        <div className="glass-card glass-card-glow shadow-2xl shadow-black/40">
          {/* Tab switcher */}
          <div className="p-2 border-b border-white/8">
            <div className="flex gap-1 p-1 bg-black/30 rounded-xl">
              {[
                { key: 'siswa', label: 'Siswa', icon: User },
                { key: 'guru',  label: 'Guru / Admin', icon: GraduationCap },
              ].map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-200
                    ${activeTab === key
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <TabIcon size={15} strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            {activeTab === "siswa" ? (
              <form onSubmit={handleSiswaSubmit} className="space-y-4 animate-fade-in">
                <div className="text-center mb-5">
                  <h2 className="text-lg font-bold text-white">Masuk sebagai Siswa</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Masukkan NISN untuk melanjutkan</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    NISN (Nomor Induk Siswa Nasional)
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input-field pl-10"
                      placeholder="Contoh: 0123456789"
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {loading ? "Memeriksa..." : "Masuk"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleGuruSubmit} className="space-y-4 animate-fade-in">
                <div className="text-center mb-5">
                  <h2 className="text-lg font-bold text-white">Login Staff</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Khusus Guru dan Administrator</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      className="input-field pl-10"
                      placeholder="Masukkan username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      className="input-field pl-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {loading ? "Memproses..." : "Masuk"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer credit */}
        <p className="text-center text-xs text-slate-600 mt-5">
          © {new Date().getFullYear()} <span className="text-slate-500 font-medium">Amrully Arun Hadi</span>
        </p>
      </div>
    </div>
  );
}
