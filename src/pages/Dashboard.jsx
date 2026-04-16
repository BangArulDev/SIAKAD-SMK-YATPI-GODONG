import React, { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import {
  CheckCircle2, HeartPulse, FileText, Clock, XCircle,
  PenLine, Camera, ClipboardCheck, User, Hash, Loader2
} from 'lucide-react';

export default function Dashboard() {
  const { session, records = [], students = [], addRecord } = useAppStore();
  const { addToast } = useToast();

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

  // === HANDLERS ===
  const handleManualAbsen = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nisn = fd.get('nisn');
    const status = fd.get('status');
    const keterangan = fd.get('keterangan');

    const student = (students || []).find(s => s.nisn === nisn);
    if (!student) return addToast('Siswa dengan NISN tersebut tidak ditemukan', 'error');

    setLoading(true);
    try {
      await addRecord({
        nisn: student.nisn,
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
          <h1 className="text-2xl font-bold">Halo, <span className="text-gradient">{session?.nama || 'Guru'}</span> 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManualModal(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition font-semibold text-sm text-white">
            <PenLine size={15} />
            Absen Manual
          </button>
        </div>
      </div>


      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: 'Hadir',     val: stats.hadir,     Icon: CheckCircle2, wrap: 'icon-green',  val_class: 'text-emerald-400' },
          { label: 'Sakit',     val: stats.sakit,     Icon: HeartPulse,   wrap: 'icon-amber',  val_class: 'text-amber-400'   },
          { label: 'Izin',      val: stats.izin,      Icon: FileText,     wrap: 'icon-blue',   val_class: 'text-blue-400'    },
          { label: 'Terlambat', val: stats.terlambat, Icon: Clock,        wrap: 'icon-orange', val_class: 'text-orange-400'  },
          { label: 'Alpa',      val: stats.alpa,      Icon: XCircle,      wrap: 'icon-red',    val_class: 'text-red-400'     },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center gap-3 relative">
              <div className={`icon-wrap icon-wrap-md ${s.wrap}`}>
                <s.Icon size={18} strokeWidth={2} />
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{s.label}</div>
                <div className={`text-2xl font-black ${s.val_class}`}>{s.val}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABEL */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-indigo-400" />
            <h2 className="font-semibold">Absensi Hari Ini</h2>
          </div>
          <span className="badge badge-info">{todayRecords.length} Siswa</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#ffffff05] border-b border-white/5 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-400">Waktu</th>
                <th className="px-4 py-3 font-medium text-slate-400">Siswa</th>
                <th className="px-4 py-3 font-medium text-slate-400">Kelas</th>
                <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 font-medium text-slate-400">Ket</th>
                <th className="px-4 py-3 font-medium text-slate-400">Metode</th>
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
                    <div className="text-xs text-indigo-400">{r.nisn}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.kelas}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                        r.status === 'hadir'     ? 'badge-success' :
                        r.status === 'sakit'     ? 'badge-warning'  :
                        r.status === 'izin'      ? 'badge-info'     :
                        r.status === 'terlambat' ? 'badge-orange'   :
                        'badge-danger'
                      }`}>
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
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleManualAbsen} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-md animate-slide-up border border-indigo-500/30 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="icon-wrap icon-wrap-md icon-indigo"><PenLine size={18} /></div>
              <h2 className="text-xl font-bold">Input Absen Manual</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><Hash size={13}/>NISN Siswa</label>
                <input name="nisn" required type="text" className="input-field" placeholder="Ketik NISN siswa" />
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
