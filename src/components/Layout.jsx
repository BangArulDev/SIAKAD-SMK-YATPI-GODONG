import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import {
  LayoutDashboard, ClipboardList, BookOpen,
  Settings, LogOut, Menu, X, GraduationCap, ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/rekap',     icon: ClipboardList,   label: 'Rekap Absensi' },
  { to: '/tugas',     icon: BookOpen,         label: 'Tugas' },
];

const SidebarNavLink = ({ to, icon: NavIcon, label, onClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.startsWith(to);
  return (
    <li>
      <button
        onClick={() => { navigate(to); if (onClick) onClick(); }}
        className={`nav-btn ${isActive ? 'active' : ''}`}
      >
        <NavIcon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
        <span className="flex-1 text-left">{label}</span>
        {isActive && <ChevronRight size={14} className="opacity-60" />}
      </button>
    </li>
  );
};

export default function Layout() {
  const navigate = useNavigate();
  const { session, logout } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const closeSidebar = () => setSidebarOpen(false);

  if (!session || session.role === 'siswa') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <div className="icon-wrap icon-wrap-xl icon-red mb-6">
          <Settings size={28} />
        </div>
        <h1 className="text-3xl font-bold mb-3">Akses Ditolak</h1>
        <p className="text-slate-400 mb-6">Anda tidak memiliki izin untuk halaman ini.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Ke Beranda</button>
      </div>
    );
  }

  const initials = session.nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  return (
    <>
      <div className="bg-animated" />
      <div className="flex h-screen overflow-hidden text-[#f1f5f9]">

        {/* ── SIDEBAR ── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64
          bg-[#06061a]/95 backdrop-blur-2xl
          border-r border-white/8
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:translate-x-0 md:static md:shrink-0
        `}>
          {/* Logo */}
          <div className="p-5 border-b border-white/8 flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 group"
            >
              <img
                src="/LOGO SMK YATPI.svg"
                alt="Logo SMK Yatpi"
                className="w-10 h-10 rounded-xl object-contain group-hover:scale-105 transition-transform"
              />
              <div className="text-left">
                <div className="text-base font-black text-gradient leading-tight">SSO YATPI</div>
                <div className="text-[10px] font-bold text-slate-500 tracking-[0.15em] uppercase">SMK Yatpi Godong</div>
              </div>
            </button>
            <button
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/8 hover:text-white transition"
              onClick={closeSidebar}
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 pb-2 pt-1">Menu</p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.map(item => (
                <SidebarNavLink key={item.to} {...item} onClick={closeSidebar} />
              ))}
              {session?.role === 'admin' && (
                <SidebarNavLink to="/admin" icon={Settings} label="Admin Panel" onClick={closeSidebar} />
              )}
            </ul>
          </nav>

          {/* User & Logout */}
          <div className="p-3 border-t border-white/8 space-y-2">
            {/* User card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm border border-white/20 shrink-0 shadow-lg">
                {initials}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-white">{session.nama}</div>
                <div className="text-xs text-indigo-400 capitalize font-medium">{session.role}</div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition font-semibold text-sm border border-transparent hover:border-red-500/20"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>

            {/* Footer credit */}
            <p className="text-center text-[10px] text-slate-600 pt-1 leading-tight">
              © {new Date().getFullYear()} Amrully Arun Hadi
            </p>
          </div>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* ── MAIN ── */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Mobile header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#06061a]/90 backdrop-blur-md border-b border-white/8 shrink-0 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:bg-white/8 hover:text-white transition"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img src="/LOGO SMK YATPI.svg" alt="Logo" className="w-6 h-6 rounded-md object-contain" />
              <span className="font-black text-lg text-gradient">SSO YATPI</span>
            </div>
            <div className="w-10" />
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
