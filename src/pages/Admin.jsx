import React, { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import { GraduationCap, Users, Pencil, Trash2, Plus, Loader2, ShieldCheck, Settings, Clock, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Admin() {
  const { session, students, teachers, settings, addStudent, updateStudent, deleteStudent, addTeacher, updateTeacher, deleteTeacher, updateSettings } = useAppStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('siswa'); // 'siswa' | 'guru' | 'pengaturan'
  
  // Modals state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [loading, setLoading] = useState(false);

  // Settings form state — inisialisasi dari store
  const [settingsForm, setSettingsForm] = useState({
    jam_buka:        settings?.jam_buka        || '07:00',
    jam_batas_hadir: settings?.jam_batas_hadir || '07:15',
    jam_tutup:       settings?.jam_tutup       || '07:30',
  });

  // === HANDLERS SISWA ===
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      nisn: fd.get('nisn'),
      nama: fd.get('nama'),
      kelas: fd.get('kelas')
    };
    
    setLoading(true);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.nisn, data);
        addToast('Siswa berhasil diubah', 'success');
      } else {
        await addStudent(data);
        addToast('Siswa baru ditambahkan', 'success');
      }
      setShowStudentModal(false);
      setEditingStudent(null);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleStudentDelete = async (nisn) => {
    if (window.confirm("Hapus data siswa ini? Semua data absensinya mungkin akan kehilangan referensi nama. Lanjutkan?")) {
      setLoading(true);
      try {
        await deleteStudent(nisn);
        addToast('Data siswa dihapus', 'success');
      } catch (err) { addToast(err.message, 'error'); }
      finally { setLoading(false); }
    }
  };

  // === HANDLERS GURU ===
  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      username: fd.get('username'),
      password: fd.get('password') || (editingTeacher ? editingTeacher.password : '12345'),
      nama: fd.get('nama'),
      role: fd.get('role')
    };

    setLoading(true);
    try {
      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, data);
        addToast('Data guru/admin diubah', 'success');
      } else {
        if (!data.username || !data.nama) throw new Error('Pastikan field wajib terisi');
        await addTeacher(data);
        addToast('Guru baru ditambahkan', 'success');
      }
      setShowTeacherModal(false);
      setEditingTeacher(null);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleTeacherDelete = async (id) => {
    if (window.confirm("Hapus data guru/admin ini?")) {
      setLoading(true);
      try {
        await deleteTeacher(id);
        addToast('Data berhasil dihapus', 'success');
      } catch (err) { addToast(err.message, 'error'); }
      finally { setLoading(false); }
    }
  };

  // === HANDLER PENGATURAN ===
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    const { jam_buka, jam_batas_hadir, jam_tutup } = settingsForm;

    // Validasi urutan waktu
    const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    if (toMin(jam_buka) >= toMin(jam_batas_hadir)) {
      return addToast('Jam buka harus sebelum batas terlambat', 'warning');
    }
    if (toMin(jam_batas_hadir) >= toMin(jam_tutup)) {
      return addToast('Batas terlambat harus sebelum jam tutup', 'warning');
    }

    setLoading(true);
    try {
      await updateSettings(settingsForm);
      addToast('Pengaturan jam absensi berhasil disimpan!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };


  if (session?.role !== 'admin') return <div className="text-center p-10 text-xl font-bold">Akses Ditolak</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-slate-400">Manajemen Database Siswa, Staf / Guru, dan Pengaturan Sistem</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 w-fit">
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'siswa' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setActiveTab('siswa')}
          >
            <Users size={15} /> Data Siswa
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'guru' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setActiveTab('guru')}
          >
            <GraduationCap size={15} /> Data Guru / Admin
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'pengaturan' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setActiveTab('pengaturan')}
          >
            <Settings size={15} /> Pengaturan
          </button>
        </div>
      </div>

      {activeTab === 'siswa' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-white">Database Siswa ({students.length})</h2>
            <button 
              onClick={() => { setEditingStudent(null); setShowStudentModal(true); }} 
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
            >
              <Plus size={15} /> Tambah Siswa
            </button>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#ffffff05] border-b border-white/5 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 font-medium">NISN</th>
                  <th className="px-4 py-3 font-medium">Nama Siswa</th>
                  <th className="px-4 py-3 font-medium">Kelas</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map(s => (
                  <tr key={s.nisn} className="hover:bg-white/5 transition">
                    <td className="px-4 py-2 font-mono text-indigo-400">{s.nisn}</td>
                    <td className="px-4 py-2 font-medium text-white">{s.nama}</td>
                    <td className="px-4 py-2 text-slate-300">{s.kelas}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingStudent(s); setShowStudentModal(true); }} disabled={loading}
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition mr-2">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleStudentDelete(s.nisn)} disabled={loading}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'guru' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-white">Database Akun Staf ({teachers.length})</h2>
            <button 
              onClick={() => { setEditingTeacher(null); setShowTeacherModal(true); }} 
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
            >
              <Plus size={15} /> Tambah Guru/Admin
            </button>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#ffffff05] border-b border-white/5 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Nama Pegawai</th>
                  <th className="px-4 py-3 font-medium">Hak Akses</th>
                  <th className="px-4 py-3 font-medium">Password</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teachers.map(t => (
                  <tr key={t.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-2 font-mono text-indigo-400">{t.username}</td>
                    <td className="px-4 py-2 font-medium text-white">{t.nama}</td>
                    <td className="px-4 py-2">
                       <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>{t.role.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs">••••••••</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingTeacher(t); setShowTeacherModal(true); }} disabled={loading}
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition mr-2">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleTeacherDelete(t.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                        disabled={t.id === 'admin' || loading}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PENGATURAN JAM ABSENSI */}
      {activeTab === 'pengaturan' && (
        <div className="max-w-xl space-y-5">

          {/* Info card */}
          <div className="glass-card p-5 border border-indigo-500/20">
            <div className="flex items-center gap-3 mb-1">
              <div className="icon-wrap icon-wrap-sm icon-indigo"><Clock size={15} /></div>
              <h2 className="font-bold text-white">Pengaturan Jam Absensi</h2>
            </div>
            <p className="text-sm text-slate-400 ml-10">
              Ubah jam buka dan tutup absensi sesuai jadwal sekolah. Perubahan langsung berlaku tanpa perlu ubah kode program.
            </p>
          </div>

          {/* Visual timeline */}
          <div className="glass-card p-5 border border-white/10">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Preview Jadwal Absensi</p>
            <div className="relative h-10 rounded-xl overflow-hidden flex">
              {/* Zona hadir */}
              <div className="flex-1 bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                ✅ Hadir
              </div>
              {/* Pemisah batas terlambat */}
              <div className="w-0.5 bg-yellow-400/60" />
              {/* Zona terlambat */}
              <div className="flex-1 bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-xs font-bold text-yellow-400">
                ⏰ Terlambat
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span className="font-mono text-emerald-400">{settingsForm.jam_buka}</span>
              <span className="font-mono text-yellow-400">{settingsForm.jam_batas_hadir} (batas)</span>
              <span className="font-mono text-red-400">{settingsForm.jam_tutup} (tutup)</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSettingsSubmit} className="glass-card p-6 border border-white/10 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Jam Buka */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" /> Jam Buka
                </label>
                <input
                  type="time"
                  required
                  value={settingsForm.jam_buka}
                  onChange={e => setSettingsForm(f => ({ ...f, jam_buka: e.target.value }))}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none text-sm font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">Absensi mulai bisa diisi</p>
              </div>

              {/* Batas Hadir */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-yellow-400" /> Batas Hadir
                </label>
                <input
                  type="time"
                  required
                  value={settingsForm.jam_batas_hadir}
                  onChange={e => setSettingsForm(f => ({ ...f, jam_batas_hadir: e.target.value }))}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-yellow-500 outline-none text-sm font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">Setelah ini → Terlambat</p>
              </div>

              {/* Jam Tutup */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock size={13} className="text-red-400" /> Jam Tutup
                </label>
                <input
                  type="time"
                  required
                  value={settingsForm.jam_tutup}
                  onChange={e => setSettingsForm(f => ({ ...f, jam_tutup: e.target.value }))}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-red-500 outline-none text-sm font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">Absensi tidak bisa diisi</p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-500/20"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>

          {/* Info saat ini */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">📌 Pengaturan aktif saat ini (dari database):</p>
            <p>Jam Buka: <span className="font-mono text-emerald-400">{settings?.jam_buka || '07:00'}</span></p>
            <p>Batas Hadir: <span className="font-mono text-yellow-400">{settings?.jam_batas_hadir || '07:15'}</span></p>
            <p>Jam Tutup: <span className="font-mono text-red-400">{settings?.jam_tutup || '07:30'}</span></p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <form onSubmit={handleStudentSubmit} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-md animate-slide-up border border-indigo-500/30 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-wrap icon-wrap-md icon-indigo">
                  {editingStudent ? <Pencil size={18} /> : <Plus size={18} />}
                </div>
                <h2 className="text-xl font-bold">{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h2>
              </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">NISN (Nomor Induk Siswa Nasional)</label>
                <input name="nisn" required type="text" defaultValue={editingStudent?.nisn} readOnly={!!editingStudent} className={`w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white outline-none ${editingStudent ? 'opacity-50 cursor-not-allowed' : 'focus:border-indigo-500'}`} placeholder="Nomor unik (10 digit)" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Nama Lengkap</label>
                <input name="nama" required type="text" defaultValue={editingStudent?.nama} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Kelas</label>
                <input name="kelas" required type="text" defaultValue={editingStudent?.kelas} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Misal: XII TKJ 1" />
              </div>
            </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowStudentModal(false)}
                  className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Simpan'}
                </button>
              </div>
          </form>
        </div>
      )}

      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <form onSubmit={handleTeacherSubmit} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-md animate-slide-up border border-indigo-500/30 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-wrap icon-wrap-md icon-purple">
                  {editingTeacher ? <Pencil size={18} /> : <ShieldCheck size={18} />}
                </div>
                <h2 className="text-xl font-bold">{editingTeacher ? 'Edit Akun Pegawai' : 'Tambah Akun Baru'}</h2>
              </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Username Login</label>
                <input name="username" required type="text" defaultValue={editingTeacher?.username} readOnly={editingTeacher?.username === 'admin'} className={`w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white outline-none ${editingTeacher?.username === 'admin' ? 'opacity-50 cursor-not-allowed' : 'focus:border-indigo-500'}`} placeholder="huruf kecil, tanpa spasi" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Password {editingTeacher && '(Kosongkan jika tidak diubah)'}</label>
                <input name="password" type={editingTeacher ? 'password' : 'text'} placeholder={editingTeacher ? '••••••••' : 'Buat password awal'} required={!editingTeacher} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Nama Lengkap Guru/Admin</label>
                <input name="nama" required type="text" defaultValue={editingTeacher?.nama} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Hak Akses Role</label>
                <select name="role" defaultValue={editingTeacher?.role || 'guru'} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" disabled={editingTeacher?.username === 'admin'}>
                  <option value="guru">GURU (Biasa)</option>
                  <option value="admin">ADMIN (Penuh)</option>
                </select>
              </div>
            </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowTeacherModal(false)}
                  className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Simpan'}
                </button>
              </div>
          </form>
        </div>
      )}
    </div>
  );
}
