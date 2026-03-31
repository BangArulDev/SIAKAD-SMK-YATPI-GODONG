import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAppStore from '../store/useAppStore';

// NavLink di-declare di luar komponen Layout agar tidak di-recreate setiap render
const SidebarNavLink = ({ to, icon, label, onClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.startsWith(to);
  return (
    <li>
      <button
        onClick={() => { navigate(to); if (onClick) onClick(); }}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium
          ${isActive ? 'bg-[#6366f1] text-white shadow-lg' : 'text-slate-300 hover:bg-[#ffffff0d] hover:text-white'}
        `}
      >
        <span className="text-xl w-6 text-center">{icon}</span>
        <span>{label}</span>
      </button>
    </li>
  );
};

export default function Layout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session, logout } = useAppStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (!session || session.role === 'siswa') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <h1 className="text-3xl font-bold mb-4">Akses Ditolak</h1>
        <p className="mb-6">Anda tidak memiliki izin untuk halaman ini.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-indigo-600 rounded-lg">Ke Beranda</button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-animated"></div>
      <div className="flex h-screen overflow-hidden text-[#f1f5f9]">

        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#080818]/90 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:shrink-0`}>
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="flex flex-col text-left">
              <span className="text-xl font-black bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent pb-1">SMK Yatpi</span>
              <span className="text-xs font-bold text-slate-400 tracking-wider">ABSENSI DIGITAL</span>
            </button>
            <button className="md:hidden text-2xl text-slate-400" onClick={closeSidebar}>×</button>
          </div>

          <ul className="flex-1 p-4 space-y-1 overflow-y-auto">
            <SidebarNavLink to="/dashboard" icon="📊" label="Dashboard" onClick={closeSidebar} />
            <SidebarNavLink to="/rekap" icon="📋" label="Rekap Absensi" onClick={closeSidebar} />
            <SidebarNavLink to="/tugas" icon="📝" label="Tugas" onClick={closeSidebar} />
            {session?.role === 'admin' && (
              <SidebarNavLink to="/admin" icon="⚙️" label="Admin Panel" onClick={closeSidebar} />
            )}
          </ul>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg mb-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg border border-white/20">
                {session.nama?.charAt(0) || '?'}
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-sm truncate">{session.nama}</div>
                <div className="text-xs text-indigo-300 capitalize">{session.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition font-medium"
            >
              <span>🚪</span> Keluar
            </button>
          </div>
        </aside>

        {/* OVERLAY */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={closeSidebar}></div>
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="md:hidden flex items-center justify-between p-4 bg-[#080818]/80 backdrop-blur-md border-b border-white/10 shrink-0 z-30">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-2xl">☰</button>
            <span className="font-bold text-lg bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">SMK Yatpi</span>
            <div className="w-8"></div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
