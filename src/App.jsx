import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import useAppStore from './store/useAppStore';

// Lazy loaded components
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Absensi = lazy(() => import('./pages/Absensi'));
const Rekap = lazy(() => import('./pages/Rekap'));
const Admin = lazy(() => import('./pages/Admin'));
const Tugas = lazy(() => import('./pages/Tugas'));
const TugasSiswa = lazy(() => import('./pages/TugasSiswa'));
const Layout = lazy(() => import('./components/Layout'));

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
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#050510] text-[#f1f5f9]">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-medium animate-pulse">Memuat halaman...</p>
          </div>
        }>
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
        </Suspense>
      </ToastProvider>
    </Router>
  );
}

export default App;
