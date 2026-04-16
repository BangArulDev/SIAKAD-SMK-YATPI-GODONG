import React, { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import {
  CheckCircle2, HeartPulse, FileText, Clock, XCircle,
  PenLine, ClipboardCheck, Hash, Loader2,
  Sun, Moon, Play, Square, Wifi, WifiOff, ChevronDown, ChevronUp, Users
} from 'lucide-react';

export default function Dashboard() {
  const {
    session, records = [], students = [], addRecord,
    mandiriSessions, openMandiri, closeMandiri, getClasses
  } = useAppStore();
  const { addToast } = useToast();

  const [showManualModal, setShowManualModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalSesi, setSessionModalSesi] = useState('pagi'); // 'pagi' | 'siang'
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState(null);

  // Stats Hari Ini
  const today = new Date().toLocaleDateString('en-CA');
  const todayRecords = useMemo(() => (records || []).filter(r => r.tanggal === today), [records, today]);
  const stats = useMemo(() => {
    const s = { hadir: 0, sakit: 0, izin: 0, terlambat: 0, alpa: 0 };
    todayRecords.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [todayRecords]);

  // Pisahkan sesi aktif hari ini berdasarkan pagi/siang
  const pagiSessions  = useMemo(() => (mandiriSessions || []).filter(s => s.sesi !== 'siang'), [mandiriSessions]);
  const siangSessions = useMemo(() => (mandiriSessions || []).filter(s => s.sesi === 'siang'), [mandiriSessions]);
  const classes = useMemo(() => getClasses(), [students]);

  // === HANDLERS ===
  const handleManualAbsen = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nisn = fd.get('nisn');
    const status = fd.get('status');
    const keterangan = fd.get('keterangan');
    const sesi = fd.get('sesi');

    const student = (students || []).find(s => s.nisn === nisn);
    if (!student) return addToast('Siswa dengan NISN tersebut tidak ditemukan', 'error');

    setLoading(true);
    try {
      await addRecord({ nisn: student.nisn, nama: student.nama, kelas: student.kelas, status, keterangan, metode: 'manual', sesi });
      addToast(`Berhasil menambahkan absen untuk ${student.nama}`, 'success');
      setShowManualModal(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setLoading(true);
    try {
      await openMandiri(
        fd.get('materi'),
        fd.get('deskripsi'),
        fd.get('kelas'),
        fd.get('mode') === 'daring',
        sessionModalSesi
      );
      addToast(`Sesi ${sessionModalSesi === 'siang' ? 'Siang' : 'Pagi'} berhasil dibuka!`, 'success');
      setShowSessionModal(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async (sessionId, sesiLabel) => {
    if (!window.confirm(`Tutup sesi ${sesiLabel} ini? Siswa tidak bisa absen lagi setelah ditutup.`)) return;
    setClosingId(sessionId);
    try {
      await closeMandiri(sessionId);
      addToast(`Sesi ${sesiLabel} berhasil ditutup`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setClosingId(null);
    }
  };

  if (session && session.role === 'siswa') {
    return <div>Siswa bukan disini tempatnya</div>;
  }

  // Komponen card sesi
  const SessionCard = ({ label, icon: Icon, iconClass, sessions, sesiKey, accentClass, borderClass }) => (
    <div className={`glass-card overflow-hidden border ${borderClass}`}>
      {/* Header */}
      <div className={`p-4 flex items-center justify-between border-b border-white/10 bg-white/3`}>
        <div className="flex items-center gap-2">
          <div className={`icon-wrap icon-wrap-sm ${iconClass}`}><Icon size={15} /></div>
          <span className="font-bold text-white">Sesi {label}</span>
          {sessions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
              {sessions.length} AKTIF
            </span>
          )}
        </div>
        <button
          onClick={() => { setSessionModalSesi(sesiKey); setShowSessionModal(true); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition ${accentClass}`}
        >
          <Play size={13} /> Buka Sesi
        </button>
      </div>

      {/* Active sessions list */}
      <div className="p-3 space-y-2 min-h-[60px]">
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">Tidak ada sesi {label.toLowerCase()} aktif</p>
        ) : sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white truncate">{s.kelas}</span>
                {s.is_daring && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    DARING
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{s.materi} · {s.guru_nama}</p>
            </div>
            <button
              onClick={() => handleCloseSession(s.id, label)}
              disabled={closingId === s.id}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-semibold transition border border-red-500/20"
            >
              {closingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
              Tutup
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Halo, <span className="text-gradient">{session?.nama || 'Guru'}</span> 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => setShowManualModal(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition font-semibold text-sm text-white">
          <PenLine size={15} /> Absen Manual
        </button>
      </div>

      {/* SESSION MANAGEMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SessionCard
          label="Pagi" icon={Sun} sesiKey="pagi"
          iconClass="icon-amber" accentClass="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
          borderClass="border-amber-500/20" sessions={pagiSessions}
        />
        <SessionCard
          label="Siang" icon={Moon} sesiKey="siang"
          iconClass="icon-blue" accentClass="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
          borderClass="border-blue-500/20" sessions={siangSessions}
        />
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
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Siswa</th>
                <th className="px-4 py-3 font-medium">Kelas</th>
                <th className="px-4 py-3 font-medium">Sesi</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ket</th>
                <th className="px-4 py-3 font-medium">Metode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
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
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.sesi === 'siang' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {r.sesi === 'siang' ? '🌙 Siang' : '☀️ Pagi'}
                    </span>
                  </td>
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

      {/* MODAL: BUKA SESI */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowSessionModal(false)}>
          <form onSubmit={handleOpenSession} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-md animate-slide-up border border-indigo-500/30 shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className={`icon-wrap icon-wrap-md ${sessionModalSesi === 'siang' ? 'icon-blue' : 'icon-amber'}`}>
                {sessionModalSesi === 'siang' ? <Moon size={18} /> : <Sun size={18} />}
              </div>
              <div>
                <h2 className="text-xl font-bold">Buka Sesi {sessionModalSesi === 'siang' ? 'Siang' : 'Pagi'}</h2>
                <p className="text-xs text-slate-400">Siswa yang dipilih bisa mulai absen</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Kelas</label>
                <select name="kelas" required className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                  <option value="Semua">Semua Kelas</option>
                  {classes.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Materi / Mata Pelajaran</label>
                <input name="materi" required type="text" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Misal: Matematika, Praktik TKJ..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Deskripsi (opsional)</label>
                <input name="deskripsi" type="text" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" placeholder="Catatan tambahan..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Mode Pembelajaran</label>
                <select name="mode" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                  <option value="tatap">🏫 Tatap Muka (validasi GPS)</option>
                  <option value="daring">💻 Daring / Online (tanpa GPS)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowSessionModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {loading ? 'Membuka...' : 'Buka Sesi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ABSEN MANUAL */}
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
                <label className="block text-sm text-slate-300 mb-1">Sesi</label>
                <select name="sesi" className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                  <option value="pagi">☀️ Pagi</option>
                  <option value="siang">🌙 Siang</option>
                </select>
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
