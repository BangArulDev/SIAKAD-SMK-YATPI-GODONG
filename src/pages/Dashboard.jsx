import React, { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const { session, records = [], students = [], openMandiri, closeMandiri, isMandiriOpen, addRecord } = useAppStore();
  const { addToast } = useToast();

  const [showMandiriModal, setShowMandiriModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stats Hari Ini - computed with useMemo to avoid infinite loop
  const today = new Date().toLocaleDateString('en-CA');
  const todayRecords = useMemo(() => (records || []).filter(r => r.tanggal === today), [records, today]);
  const stats = useMemo(() => {
    const s = { hadir: 0, sakit: 0, izin: 0, terlambat: 0, alpa: 0 };
    todayRecords.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [todayRecords]);

  const mandiriActive = isMandiriOpen();

  // === HANDLERS ===
  const handleBukaMandiri = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const isDaring = fd.get('is_daring') === 'true';
    setLoading(true);
    try {
      await openMandiri(fd.get('materi'), fd.get('deskripsi'), fd.get('kelas'), isDaring);
      addToast(`Sesi Absensi Mandiri Dibuka (${isDaring ? '🌐 Daring' : '🏫 Luring'})`, 'success');
      setShowMandiriModal(false);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); };
  };

  const handleTutupMandiri = async () => {
    setLoading(true);
    try {
      await closeMandiri();
      addToast('Sesi ditutup', 'info');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleManualAbsen = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nis = fd.get('nis');
    const status = fd.get('status');
    const keterangan = fd.get('keterangan');

    const student = (students || []).find(s => s.nis === nis);
    if (!student) return addToast('Siswa dengan NIS tersebut tidak ditemukan', 'error');

    setLoading(true);
    try {
      await addRecord({
        nis: student.nis,
        nama: student.nama,
        kelas: student.kelas,
        status,
        keterangan,
        metode: 'manual'
      });
      addToast(`Berhasil menambahkan absen untuk ${student.nama}`, 'success');
      setShowManualModal(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (session && session.role === 'siswa') {
    return <div>Siswa bukan disini tempatnya</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Halo, {session?.nama || 'Guru'}</h1>
          <p className="text-slate-400">Ringkasan absensi hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          {mandiriActive ? (
            <button onClick={handleTutupMandiri} disabled={loading} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg transition font-medium text-sm flex items-center gap-2">
              {loading ? '⏳' : '🛑'} {loading ? 'Memproses...' : 'Tutup Sesi Mandiri'}
            </button>
          ) : (
            <button onClick={() => setShowMandiriModal(true)} disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20">
              <span>🔓</span> Buka Sesi Mandiri
            </button>
          )}
          <button onClick={() => setShowManualModal(true)} disabled={loading} className="px-4 py-2 bg-[#ffffff0d] hover:bg-[#ffffff1a] border border-white/10 rounded-lg transition font-medium text-sm flex items-center gap-2 text-white">
            <span>✏️</span> Absen Manual
          </button>
        </div>
      </div>

      {mandiriActive && (
        <div className={`border rounded-xl p-4 flex items-center justify-between ${useAppStore.getState().mandiriSession?.is_daring ? 'bg-blue-500/10 border-blue-500/30' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
          <div>
            <div className={`text-sm font-semibold flex items-center gap-2 ${useAppStore.getState().mandiriSession?.is_daring ? 'text-blue-300' : 'text-indigo-300'}`}>
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>
              Sesi Absensi Mandiri Sedang Berlangsung
              {useAppStore.getState().mandiriSession?.is_daring ? (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">🌐 DARING</span>
              ) : (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">🏫 LURING</span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {useAppStore.getState().mandiriSession?.is_daring
                ? 'Mode Daring — Siswa dapat absen dari mana saja tanpa validasi lokasi.'
                : 'Mode Luring — Siswa harus berada di area sekolah untuk absen hadir.'}
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[{ label: 'Hadir', val: stats.hadir, icon: '✅', color: 'text-[#10b981]' },
          { label: 'Sakit', val: stats.sakit, icon: '🤒', color: 'text-[#f59e0b]' },
          { label: 'Izin', val: stats.izin, icon: '📋', color: 'text-[#3b82f6]' },
          { label: 'Terlambat', val: stats.terlambat, icon: '⏰', color: 'text-[#f97316]' },
          { label: 'Alpa', val: stats.alpa, icon: '❌', color: 'text-[#ef4444]' }].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white/5 ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-slate-400 text-xs font-semibold uppercase">{s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABEL */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <h2 className="font-semibold">Absensi Hari Ini</h2>
          <span className="text-xs py-1 px-2 rounded-md bg-white/10 text-slate-300">{todayRecords.length} Siswa</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#ffffff05] border-b border-white/5 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Siswa</th>
                <th className="px-4 py-3 font-medium">Kelas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ket</th>
                <th className="px-4 py-3 font-medium">Metode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                    <div className="text-3xl mb-2">📋</div>
                    Belum ada data absensi hari ini.
                  </td>
                </tr>
              ) : todayRecords.map(r => (
                <tr key={r.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-slate-400">{r.waktu}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{r.nama}</div>
                    <div className="text-xs text-indigo-400">{r.nis}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.kelas}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                      ${r.status === 'hadir' ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' :
                        r.status === 'sakit' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20' :
                        r.status === 'izin' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20' :
                        'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20'}`}>
                      {(r.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate" title={r.keterangan}>{r.keterangan || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.metode || 'web'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {showMandiriModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleBukaMandiri} className="glass-card p-6 w-full max-w-md animate-fade-in border border-indigo-500/30">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span>🔓</span> Buka Sesi Absen Siswa</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Materi Hari Ini</label>
                <input name="materi" required type="text" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Misal: Pemrograman Web" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Pilih Kelas</label>
                <select name="kelas" required className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                  <option value="Semua">Terapkan ke Semua Kelas</option>
                  {[...new Set((students || []).map(s => s.kelas))].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Deskripsi Tambahan</label>
                <textarea name="deskripsi" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" rows="2" placeholder="Catatan untuk siswa (Opsional)"></textarea>
              </div>
              {/* === TOGGLE MODE DARING / LURING === */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                <p className="text-sm font-semibold text-slate-200 mb-3">📡 Mode Pembelajaran</p>
                <div className="grid grid-cols-2 gap-3">
                  <label id="mode-luring-label" className="flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition has-checked:border-green-500 has-checked:bg-green-500/10 border-white/10">
                    <input type="radio" name="is_daring" value="false" defaultChecked className="hidden" />
                    <span className="text-2xl">🏫</span>
                    <span className="text-xs font-bold text-slate-300">Luring</span>
                    <span className="text-xs text-slate-500 text-center leading-tight">GPS wajib, harus di area sekolah</span>
                  </label>
                  <label id="mode-daring-label" className="flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition has-checked:border-blue-500 has-checked:bg-blue-500/10 border-white/10">
                    <input type="radio" name="is_daring" value="true" className="hidden" />
                    <span className="text-2xl">🌐</span>
                    <span className="text-xs font-bold text-slate-300">Daring</span>
                    <span className="text-xs text-slate-500 text-center leading-tight">Siswa bisa absen dari mana saja</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowMandiriModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                {loading ? "Memproses..." : "Buka Sesi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleManualAbsen} className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span>✏️</span> Input Absen Manual</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">NIS Siswa</label>
                <input name="nis" required type="text" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Ketik NIS" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Status Kehadiran</label>
                <select name="status" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                  <option value="hadir">Hadir</option>
                  <option value="sakit">Sakit</option>
                  <option value="izin">Izin</option>
                  <option value="terlambat">Terlambat</option>
                  <option value="alpa">Alpa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Keterangan</label>
                <input name="keterangan" type="text" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Opsional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                {loading ? "Memproses..." : "Simpan Absen"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
