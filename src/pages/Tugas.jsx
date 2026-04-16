import React, { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import {
  Plus, Loader2, BookOpen, Pause, Play, Trash2, CalendarDays,
  FileText, FolderOpen, Inbox, Award, Search, FilePlus2
} from 'lucide-react';

const TIPE_UPLOAD_OPTIONS = [
  { value: 'teks',          label: 'Teks / Jawaban Tertulis' },
  { value: 'foto',          label: 'Foto (Kamera atau Galeri)' },
  { value: 'file',          label: 'File Dokumen (PDF, Word, dll)' },
  { value: 'foto_atau_file',label: 'Foto atau File (Bebas)' },
];

export default function Tugas() {
  const { students, tugas = [], pengumpulan = [], addTugas, deleteTugas, updateTugas, nilaiPengumpulan, getClasses } = useAppStore();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedTugas, setSelectedTugas] = useState(null); // untuk detail/nilai
  const [showNilaiModal, setShowNilaiModal] = useState(null); // { pengumpulanId, nilai, komentar }
  const [search, setSearch] = useState('');

  const classes = getClasses();

  // Form state
  const [form, setForm] = useState({
    judul_tugas: '', mata_pelajaran: '', kelas: 'Semua',
    deskripsi: '', deadline: '', tipe_upload: 'teks',
  });

  const filteredTugas = useMemo(() => {
    return (tugas || [])
      .filter(t => !search || t.judul_tugas.toLowerCase().includes(search.toLowerCase()) || (t.mata_pelajaran && t.mata_pelajaran.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [tugas, search]);

  const handleSubmitTugas = async (e) => {
    e.preventDefault();
    if (!form.judul_tugas.trim()) return addToast('Judul tugas tidak boleh kosong', 'warning');
    if (!form.deadline) return addToast('Deadline harus diisi', 'warning');
    setLoading(true);
    try {
      await addTugas(form);
      addToast('Tugas berhasil dibuat!', 'success');
      setShowFormModal(false);
      setForm({ judul_tugas: '', mata_pelajaran: '', kelas: 'Semua', deskripsi: '', deadline: '', tipe_upload: 'teks' });
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (t) => {
    setLoading(true);
    try {
      await updateTugas(t.id, { is_active: !t.is_active });
      addToast(!t.is_active ? 'Tugas diaktifkan kembali' : 'Tugas dinonaktifkan', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Hapus tugas ini beserta semua pengumpulan siswa?')) {
      setLoading(true);
      try {
        await deleteTugas(id);
        if (selectedTugas?.id === id) setSelectedTugas(null);
        addToast('Tugas dihapus', 'success');
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const getPengumpulanForTugas = (tugasId) => {
    return (pengumpulan || []).filter(p => p.tugas_id === tugasId);
  };

  const isDeadlinePassed = (deadline) => deadline && new Date(deadline) < new Date();

  const handleNilai = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nilai = parseInt(fd.get('nilai'));
    const komentar = fd.get('komentar');
    if (isNaN(nilai) || nilai < 0 || nilai > 100) return addToast('Nilai harus antara 0-100', 'warning');
    
    setLoading(true);
    try {
      await nilaiPengumpulan(showNilaiModal.id, nilai, komentar);
      addToast('Nilai berhasil disimpan!', 'success');
      setShowNilaiModal(null);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="icon-wrap icon-wrap-md icon-indigo"><BookOpen size={18} /></div>
            Manajemen Tugas
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Buat dan kelola tugas untuk siswa</p>
        </div>
        <button
          onClick={() => setShowFormModal(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium text-sm shadow-lg shadow-indigo-500/20"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {loading ? 'Memproses...' : 'Buat Tugas Baru'}
        </button>
      </div>

      {/* SEARCH */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari tugas berdasarkan judul atau mata pelajaran..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0d0d25] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* TUGAS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTugas.length === 0 ? (
          <div className="lg:col-span-2 glass-card p-12 flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 icon-wrap icon-indigo rounded-2xl mb-5">
              <Inbox size={28} strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-lg mb-2">Belum Ada Tugas</h3>
            <p className="text-slate-400 text-sm mb-6">Klik tombol "Buat Tugas Baru" di atas untuk mulai memberikan tugas ke siswa.</p>
            <button onClick={() => setShowFormModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition">
              <FilePlus2 size={16} /> Buat Tugas Pertama
            </button>
          </div>
        ) : filteredTugas.map(t => {
          const pList = getPengumpulanForTugas(t.id);
          const siswaKelas = t.kelas === 'Semua' ? students.length : (students || []).filter(s => s.kelas === t.kelas).length;
          const deadlineLewat = isDeadlinePassed(t.deadline);
          return (
            <div
              key={t.id}
              className={`glass-card p-5 cursor-pointer hover:border-indigo-500/40 transition ${!t.isActive ? 'opacity-50' : ''}`}
              onClick={() => setSelectedTugas(t)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                  {!t.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border bg-slate-500/10 text-slate-400 border-slate-500/20">
                      <Pause size={10} /> Nonaktif
                    </span>
                  ) : deadlineLewat ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border bg-red-500/10 text-red-400 border-red-500/20">
                      <CalendarDays size={10} /> Deadline Lewat
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border bg-green-500/10 text-green-400 border-green-500/20">
                      <Play size={10} /> Aktif
                    </span>
                  )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {t.kelas === 'Semua' ? 'Semua Kelas' : t.kelas}
                    </span>
                  </div>
                  <h3 className="font-bold text-white truncate">{t.judul_tugas}</h3>
                  <p className="text-xs text-indigo-300">{t.mata_pelajaran || 'Tanpa Mata Pelajaran'}</p>
                </div>
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleActive(t)}
                    disabled={loading}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                    title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {t.is_active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={loading}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                    title="Hapus Tugas"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {t.deskripsi && <p className="text-sm text-slate-300 mb-3 line-clamp-2">{t.deskripsi}</p>}

              <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={12} />
                  {t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Tanpa batas'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-300">{pList.length}/{siswaKelas} dikumpulkan</span>
                </div>
              </div>

              <div className="mt-2">
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: siswaKelas > 0 ? `${(pList.length / siswaKelas) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FORM MODAL - BUAT TUGAS */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form onSubmit={handleSubmitTugas} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-lg animate-fade-in border border-indigo-500/30 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-3">
              <div className="icon-wrap icon-wrap-md icon-indigo"><FilePlus2 size={18} /></div>
              Buat Tugas Baru
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Judul Tugas <span className="text-red-400">*</span></label>
                <input
                  type="text" required
                  value={form.judul_tugas}
                  onChange={e => setForm({ ...form, judul_tugas: e.target.value })}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  placeholder="Misal: Latihan Soal Bab 3"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={form.mata_pelajaran}
                    onChange={e => setForm({ ...form, mata_pelajaran: e.target.value })}
                    className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                    placeholder="Misal: Matematika"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Ditujukan ke Kelas</label>
                  <select
                    value={form.kelas}
                    onChange={e => setForm({ ...form, kelas: e.target.value })}
                    className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  >
                    <option value="Semua">Semua Kelas</option>
                    {classes.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Deskripsi / Instruksi Tugas</label>
                <textarea
                  rows={4}
                  value={form.deskripsi}
                  onChange={e => setForm({ ...form, deskripsi: e.target.value })}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  placeholder="Tuliskan instruksi tugas secara detail..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Deadline <span className="text-red-400">*</span></label>
                  <input
                    type="datetime-local" required
                    value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tipe Pengumpulan</label>
                  <select
                    value={form.tipe_upload}
                    onChange={e => setForm({ ...form, tipe_upload: e.target.value })}
                    className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  >
                    {TIPE_UPLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
                <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition font-medium">Batal</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Buat Tugas'}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* DETAIL TUGAS MODAL */}
      {selectedTugas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTugas(null)}>
          <div className="bg-[#0d0d1f] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in border border-indigo-500/30 shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selectedTugas.judul_tugas}</h2>
                  <p className="text-indigo-300 text-sm">{selectedTugas.mata_pelajaran} · {selectedTugas.kelas === 'Semua' ? 'Semua Kelas' : selectedTugas.kelas}</p>
                </div>
                <button onClick={() => setSelectedTugas(null)} className="text-slate-400 hover:text-white text-2xl transition">×</button>
              </div>
              {selectedTugas.deskripsi && (
                <p className="mt-3 text-sm text-slate-300 bg-white/5 rounded-lg p-3">{selectedTugas.deskripsi}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CalendarDays size={11} /> Deadline: {selectedTugas.deadline ? new Date(selectedTugas.deadline).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Tanpa batas'}</span>
                <span className="flex items-center gap-1"><FileText size={11} /> Tipe: {TIPE_UPLOAD_OPTIONS.find(o => o.value === selectedTugas.tipe_upload)?.label}</span>
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-semibold mb-4">Daftar Pengumpulan ({getPengumpulanForTugas(selectedTugas.id).length} siswa)</h3>
              {getPengumpulanForTugas(selectedTugas.id).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="inline-flex items-center justify-center w-12 h-12 icon-wrap icon-indigo rounded-2xl mb-3">
                    <Inbox size={22} strokeWidth={1.5} />
                  </div>
                  <div>Belum ada siswa yang mengumpulkan</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {getPengumpulanForTugas(selectedTugas.id).map(p => (
                    <div key={p.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white">{p.nama}</div>
                          <div className="text-xs text-indigo-300">{p.nisn} · {p.kelas}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Dikumpulkan: {new Date(p.dikumpulkan_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>

                          {p.konten && (
                            <div className="mt-2 p-2 bg-black/20 rounded-lg text-sm text-slate-300 max-h-20 overflow-y-auto">
                              {p.konten}
                            </div>
                          )}
                          {p.file_url && p.file_type?.startsWith('image/') && (
                            <img src={p.file_url} alt="Tugas" className="mt-2 max-h-32 rounded-lg object-cover" />
                          )}
                          {p.file_name && !p.file_type?.startsWith('image/') && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-indigo-300">
                              <FolderOpen size={14} /> {p.file_name}
                            </div>
                          )}
                          {p.catatan && <div className="text-xs text-slate-400 mt-1 italic flex items-center gap-1"><FileText size={10} /> Catatan: {p.catatan}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          {p.nilai_guru !== null ? (
                            <div>
                              <div className={`text-2xl font-black ${p.nilai_guru >= 75 ? 'text-green-400' : p.nilai_guru >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {p.nilai_guru}
                              </div>
                              <div className="text-xs text-slate-400">/100</div>
                              {p.komentar_guru && <div className="text-xs text-slate-400 mt-1 italic max-w-30">"{p.komentar_guru}"</div>}
                              <button onClick={() => setShowNilaiModal(p)} disabled={loading} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition">Edit Nilai</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowNilaiModal(p)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                            >
                              Beri Nilai
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NILAI */}
      {showNilaiModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form onSubmit={handleNilai} className="bg-[#0d0d1f] rounded-2xl p-6 w-full max-w-sm animate-fade-in border border-indigo-500/30 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-3">
              <div className="icon-wrap icon-wrap-sm icon-amber"><Award size={16} /></div>
              Beri Nilai — {showNilaiModal.nama}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Nilai (0-100)</label>
                <input
                  type="number" name="nilai" min="0" max="100" required
                  defaultValue={showNilaiModal.nilai_guru ?? ''}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-2xl font-bold text-center"
                  placeholder="85"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Komentar / Catatan Guru</label>
                <textarea
                  name="komentar" rows={3}
                  defaultValue={showNilaiModal.komentar_guru ?? ''}
                  className="w-full bg-[#0d0d25] border border-white/10 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                  placeholder="Bagus! Pertahankan..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowNilaiModal(null)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition">Batal</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                {loading ? 'Memproses...' : 'Simpan Nilai'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
