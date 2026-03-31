import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAppStore from "../store/useAppStore";
import { useToast } from "../components/Toast";

export default function LandingPage() {
  const navigate = useNavigate();
  const { session, loginSiswa, loginGuru, logout } = useAppStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("siswa"); // 'siswa' or 'guru'

  // Form State
  const [nisn, setNisn] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect jika sudah login
  useEffect(() => {
    if (session) {
      if (session.role === "siswa") {
        navigate("/absensi");
      } else if (session.role === "guru" || session.role === "admin") {
        navigate("/dashboard");
      } else {
        // Data session corrupt (dari localstorage lama, dsb)
        logout();
      }
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
    if (!username.trim() || !password)
      return addToast("Lengkapi username dan password", "warning");
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
      <div className="bg-animated"></div>

      <div className="w-full max-w-md glass-card p-8 animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1e1e4a] border border-white/10 mb-4 shadow-lg">
            <span className="text-3xl">🏫</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            SMK Yatpi App
          </h1>
          <p className="text-sm text-slate-400">Portal Kehadiran Digital</p>
        </div>

        {/* Custom Tab Selector */}
        <div className="flex p-1 mb-8 bg-black/20 rounded-xl border border-white/5 backdrop-blur-md">
          <button
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "siswa" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            onClick={() => setActiveTab("siswa")}
          >
            Siswa
          </button>
          <button
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "guru" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            onClick={() => setActiveTab("guru")}
          >
            Guru/Admin
          </button>
        </div>

        {activeTab === "siswa" ? (
          <form
            onSubmit={handleSiswaSubmit}
            className="space-y-4 animate-fade-in"
          >
            <h2 className="text-center font-semibold text-lg mb-4 text-[#f1f5f9]">
              Masuk Siswa
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                NISN (Nomor Induk Siswa Nasional)
              </label>
              <input
                type="text"
                className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition"
                placeholder="Misal: 2024001"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all mt-4 flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleGuruSubmit}
            className="space-y-4 animate-fade-in"
          >
            <h2 className="text-center font-semibold text-lg mb-4 text-[#f1f5f9]">
              Login Staff
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Username
              </label>
              <input
                type="text"
                className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all mt-4 flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        )}
      </div>

      <div className="absolute bottom-6 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} SMK Yatpi - Absensi Terintegrasi
      </div>
    </div>
  );
}
