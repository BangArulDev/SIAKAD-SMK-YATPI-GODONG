import React, { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import * as XLSX from 'xlsx';
import { Printer, FileSpreadsheet, RefreshCw, CalendarDays, Trash2, Search, ClipboardList } from 'lucide-react';

export default function Rekap() {
  const { records, deleteRecord, getClasses } = useAppStore();
  const { addToast } = useToast();

  const classes = getClasses();
  
  // Set default to today
  const today = new Date().toLocaleDateString('en-CA');
  const [filterFrom, setFilterFrom] = useState(today);
  const [filterTo, setFilterTo] = useState(today);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFoto, setSelectedFoto] = useState(null);

  const filteredRecords = useMemo(() => {
    return (records || []).filter(r => {
      const isAfterFrom = !filterFrom || r.tanggal >= filterFrom;
      const isBeforeTo = !filterTo || r.tanggal <= filterTo;
      const matchKelas = !filterKelas || r.kelas === filterKelas;
      const matchStatus = !filterStatus || r.status === filterStatus;
      const matchSearch = !search || r.nama.toLowerCase().includes(search.toLowerCase()) || (r.nisn || '').includes(search);
      return isAfterFrom && isBeforeTo && matchKelas && matchStatus && matchSearch;
    }).sort((a, b) => {
      // sort latest first
      const timeA = a.tanggal + a.waktu;
      const timeB = b.tanggal + b.waktu;
      return timeB.localeCompare(timeA);
    });
  }, [records, filterFrom, filterTo, filterKelas, filterStatus, search]);

  const stats = useMemo(() => {
    const s = { hadir: 0, sakit: 0, izin: 0, terlambat: 0, alpa: 0 };
    filteredRecords.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [filteredRecords]);

  const handleReset = () => {
    setFilterFrom('');
    setFilterTo('');
    setFilterKelas('');
    setFilterStatus('');
    setSearch('');
  };

  const handleDelete = async (id) => {
    if (window.confirm("Hapus data absensi ini?")) {
      try {
        await deleteRecord(id);
        addToast('Data absensi dihapus', 'success');
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!filteredRecords.length) return addToast('Tidak ada data untuk diekspor', 'warning');
    
    const exportData = filteredRecords.map((r, i) => ({
      No: i + 1,
      Tanggal: r.tanggal,
      Waktu: r.waktu,
      NISN: r.nisn,
      Nama: r.nama,
      Kelas: r.kelas,
      Status: r.status.toUpperCase(),
      Keterangan: r.keterangan || '-',
      Metode: r.metode || 'web'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    XLSX.writeFile(wb, `Rekap_Absensi_${filterFrom || 'All'}_to_${filterTo || 'All'}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rekap Absensi</h1>
          <p className="text-slate-400">Lihat dan filter seluruh data kehadiran siswa</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={handleCetak} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition font-medium text-sm">
            <Printer size={15} /> Cetak Laporan
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 rounded-lg transition font-medium text-sm">
            <FileSpreadsheet size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="glass-card p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Dari Tanggal</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Sampai Tanggal</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Kelas</label>
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Semua Kelas</option>
              {classes.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Status Kehadiran</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-[#0d0d25] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Semua Status</option>
              <option value="hadir">Hadir</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="terlambat">Terlambat</option>
              <option value="alpa">Alpa</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm font-medium rounded-lg text-slate-300">
            <RefreshCw size={13} /> Reset Filter
          </button>
          <button onClick={() => { const d = new Date().toLocaleDateString('en-CA'); setFilterFrom(d); setFilterTo(d); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-lg text-white">
            <CalendarDays size={13} /> Hari Ini
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ label: 'Hadir', val: stats.hadir, color: 'text-[#10b981]' },
          { label: 'Sakit', val: stats.sakit, color: 'text-[#f59e0b]' },
          { label: 'Izin', val: stats.izin, color: 'text-[#3b82f6]' },
          { label: 'Terlaat', val: stats.terlambat, color: 'text-[#f97316]' },
          { label: 'Alpa', val: stats.alpa, color: 'text-[#ef4444]' }].map(s => (
          <div key={s.label} className="glass-card p-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase">{s.label}</span>
            <span className={`font-bold text-lg ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <ClipboardList size={16} className="text-indigo-400" />
            Data Absensi ({filteredRecords.length} Catatan)
          </h2>
          <div className="print:hidden w-full sm:w-64 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Cari nama atau NISN..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#080818] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#ffffff05] border-b border-white/5 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">NISN</th>
                <th className="px-4 py-3 font-medium">Nama Siswa</th>
                <th className="px-4 py-3 font-medium">Kelas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Foto</th>
                <th className="px-4 py-3 font-medium">Ket</th>
                <th className="px-4 py-3 font-medium print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRecords.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Tidak ada data ditemukan</td></tr>
              ) : filteredRecords.map(r => (
                <tr key={r.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.tanggal}</td>
                  <td className="px-4 py-3 text-indigo-400 font-mono text-xs">{r.nisn}</td>
                  <td className="px-4 py-3 font-medium text-white">{r.nama}</td>
                  <td className="px-4 py-3 text-slate-300">{r.kelas}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                      ${r.status === 'hadir' ? 'bg-[#10b981]/10 text-[#10b981]' :
                        r.status === 'sakit' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                        r.status === 'izin' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' :
                        'bg-[#f97316]/10 text-[#f97316]'}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.waktu}</td>
                  <td className="px-4 py-3">
                    {r.foto_url ? (
                      <button 
                        onClick={() => setSelectedFoto(r.foto_url)}
                        className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-indigo-500 transition-all group relative"
                      >
                        <img src={r.foto_url} alt="Absensi" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-[10px] font-bold">VIEW</span>
                        </div>
                      </button>
                    ) : (
                      <span className="text-slate-600">No Photo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate" title={r.keterangan}>{r.keterangan || '-'}</td>
                  <td className="px-4 py-3 print:hidden">
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOTO PREVIEW MODAL */}
      {selectedFoto && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedFoto(null)}
        >
          <div className="relative glass-card max-w-2xl w-full border border-white/20 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedFoto(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-2xl transition"
            >×</button>
            <img src={selectedFoto} alt="Preview Absensi" className="w-full h-auto max-h-[80vh] object-contain" />
            <div className="p-4 bg-black/60 backdrop-blur-md border-t border-white/10 text-center">
              <a 
                href={selectedFoto} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition underline"
              >
                Buka Gambar di Tab Baru ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
