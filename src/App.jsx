import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Absensi from './pages/Absensi';
import Rekap from './pages/Rekap';
import Admin from './pages/Admin';
import Tugas from './pages/Tugas';
import TugasSiswa from './pages/TugasSiswa';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import useAppStore from './store/useAppStore';

// Protector untuk memastikan hanya yang terotentikasi yang bisa masuk
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { session } = useAppStore();

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    if (session.role === 'siswa') {
      return <Navigate to="/absensi" replace />;
    } else if (session.role === 'guru') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/" replace />; // Fallback 
    }
  }

  return children;
};

// Khusus halaman Siswa (jika sudah login sbg siswa)
const SiswaRoute = ({ children }) => {
  const { session } = useAppStore();
  if (!session || session.role !== 'siswa') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const { initApp, isInitialized } = useAppStore();

  useEffect(() => {
    initApp();
  }, [initApp]);

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050510] text-[#f1f5f9]">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-medium animate-pulse">Menghubungkan ke Database Supabase...</p>
      </div>
    );
  }

  return (
    <Router>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          {/* Halaman Siswa Khusus */}
          <Route 
            path="/absensi" 
            element={
              <SiswaRoute>
                <Absensi />
              </SiswaRoute>
            } 
          />
          <Route 
            path="/tugas-siswa" 
            element={
              <SiswaRoute>
                <TugasSiswa />
              </SiswaRoute>
            } 
          />
          
          {/* Halaman dengan Sidebar Layout */}
          <Route element={<Layout />}>
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['guru', 'admin']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rekap" 
              element={
                <ProtectedRoute allowedRoles={['guru', 'admin']}>
                  <Rekap />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tugas" 
              element={
                <ProtectedRoute allowedRoles={['guru', 'admin']}>
                  <Tugas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Catch All if Not Found */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;
