import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import { supabase } from "../lib/supabase";
import {
  BookOpen, ClipboardList, LogOut, CheckCircle2, Clock,
  AlertCircle, LayoutList, Camera, Image, FolderOpen,
  FileText, Trash2, Upload, Send, Loader2, User, CalendarDays,
  CheckCheck, Timer, Pin, X
} from 'lucide-react';

const TIPE_LABEL = {
  teks: 'Jawaban Teks',
  foto: 'Foto',
  file: 'File Dokumen',
  foto_atau_file: 'Foto atau File',
};

export default function TugasSiswa() {
  const navigate = useNavigate();
  const { session, tugas = [], pengumpulan = [], addPengumpulan, logout } = useAppStore();
  const { addToast } = useToast();

  const [selectedTugas, setSelectedTugas] = useState(null);
  const [filterStatus, setFilterStatus] = useState('semua'); // semua | belum | sudah | terlambat

  // Form submission state
  const [konten, setKonten] = useState('');
  const [catatan, setCatatan] = useState('');
  const [foto, setFoto] = useState(null); // base64
  const [fileRaw, setFileRaw] = useState(null); // The actual File object
  const [file, setFile] = useState(null); // { base64, name, type } untuk preview
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const tugasSiswa = useMemo(() => {
    if (!session) return [];
    return (tugas || []).filter(t => t.is_active && (t.kelas === 'Semua' || t.kelas === session.kelas));
  }, [tugas, session]);

  const pengumpulanSiswa = useMemo(() => {
    if (!session) return [];
    return (pengumpulan || []).filter(p => p.nisn === session?.nisn);
  }, [pengumpulan, session]);

  const getSudahKumpul = (tugasId) => pengumpulanSiswa.find(p => p.tugas_id === tugasId);
  const isExpired = (deadline) => deadline && new Date(deadline) < new Date();

  const filteredTugas = useMemo(() => {
    return tugasSiswa.filter(t => {
      const sudah = pengumpulanSiswa.find(p => p.tugas_id === t.id);
      const expired = t.deadline && new Date(t.deadline) < new Date();
      if (filterStatus === 'sudah') return !!sudah;
      if (filterStatus === 'belum') return !sudah && !expired;
      if (filterStatus === 'terlambat') return !sudah && expired;
      return true;
    }).sort((a, b) => new Date(a.deadline || '9999') - new Date(b.deadline || '9999'));
  }, [tugasSiswa, pengumpulanSiswa, filterStatus]);

  // Camera helpers
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }
  useEffect(() => { return () => stopCamera(); }, []);
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    setCameraError('');
    setFoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch {
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const maxDim = 1280;
    let w = video.videoWidth, h = video.videoHeight;
    if (w > maxDim) { h = h * maxDim / w; w = maxDim; }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    setFoto(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileRaw(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFile({ base64: ev.target.result, name: f.name, type: f.type });
    };
    reader.readAsDataURL(f);
  };

  const resetForm = () => {
    setKonten(''); setCatatan(''); setFoto(null); setFile(null); setFileRaw(null);
    stopCamera();
    setSelectedTugas(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = selectedTugas;
    if (!t) return;

    if (t.tipe_upload === 'teks' && !konten.trim()) return addToast('Jawaban teks tidak boleh kosong!', 'warning');
    if (t.tipe_upload === 'foto' && !foto) return addToast('Wajib mengambil atau mengunggah foto!', 'warning');
    if (t.tipe_upload === 'file' && !file) return addToast('Wajib mengunggah file!', 'warning');
    if (t.tipe_upload === 'foto_atau_file' && !foto && !file) return addToast('Wajib melampirkan foto atau file!', 'warning');

    setIsSubmitting(true);
    try {
      let finalFileUrl = null;
      let finalFileName = null;
      let finalFileType = null;

      // 1. Handle File Upload if exists
      if (foto || fileRaw) {
        let blobToUpload = null;
        
        if (foto) {
          // Convert base64 to Blob
          const base64Data = foto.split(',')[1];
          const contentType = foto.split(',')[0].split(':')[1].split(';')[0];
          const byteCharacters = atob(base64Data);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          blobToUpload = new Blob(byteArrays, { type: contentType });
          finalFileName = `foto_${session.nisn}_${Date.now()}.jpg`;
          finalFileType = contentType;
        } else if (fileRaw) {
          blobToUpload = fileRaw;
          finalFileName = `${session.nisn}_${Date.now()}_${fileRaw.name}`;
          finalFileType = fileRaw.type;
        }

        if (blobToUpload) {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tugas-files')
            .upload(finalFileName, blobToUpload);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('tugas-files')
            .getPublicUrl(uploadData.path);
          
          finalFileUrl = publicUrl;
        }
      }

      // 2. Submit to DB
      await addPengumpulan({
        tugas_id: t.id,
        konten: konten.trim(),
        file_url: finalFileUrl,
        file_name: finalFileName,
        file_type: finalFileType,
        catatan: catatan.trim(),
      });

      addToast('Tugas berhasil dikumpulkan! 🎉', 'success');
      resetForm();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => ({
    total: tugasSiswa.length,
    sudah: tugasSiswa.filter(t => pengumpulanSiswa.find(p => p.tugas_id === t.id)).length,
    belum: tugasSiswa.filter(t => !pengumpulanSiswa.find(p => p.tugas_id === t.id) && !(t.deadline && new Date(t.deadline) < new Date())).length,
    terlambat: tugasSiswa.filter(t => !pengumpulanSiswa.find(p => p.tugas_id === t.id) && !!(t.deadline && new Date(t.deadline) < new Date())).length,
  }), [tugasSiswa, pengumpulanSiswa]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* TOP BAR */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between p-4 mb-5 border border-white/8 bg-[#06061a]/80 backdrop-blur-md rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="icon-wrap icon-wrap-sm icon-indigo"><BookOpen size={15} /></div>
          <div>
            <div className="font-bold text-sm text-white">Tugas Siswa</div>
            <div className="text-xs text-indigo-300">{session?.nama} · {session?.kelas}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/absensi')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/10">
            <ClipboardList size={13} /> Absensi
          </button>
          <button onClick={() => { stopCamera(); logout(); navigate('/'); }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition" title="Keluar">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-4">
        {/* STATS */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',  val: stats.total,     Icon: LayoutList,   color: 'text-white',       bg: 'bg-white/5',         status: 'semua'    },
            { label: 'Selesai',val: stats.sudah,     Icon: CheckCircle2, color: 'text-green-400',   bg: 'bg-green-500/8',     status: 'sudah'    },
            { label: 'Aktif',  val: stats.belum,     Icon: Clock,        color: 'text-indigo-400',  bg: 'bg-indigo-500/8',    status: 'belum'    },
            { label: 'Lewat',  val: stats.terlambat, Icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-500/8',       status: 'terlambat'},
          ].map(s => (
            <button key={s.status} onClick={() => setFilterStatus(s.status)}
              className={`${s.bg} rounded-xl p-3 text-center border transition ${filterStatus === s.status ? 'border-indigo-500' : 'border-white/5 hover:border-white/20'}`}>
              <s.Icon size={18} className={`mx-auto mb-1 ${s.color}`} strokeWidth={filterStatus === s.status ? 2.5 : 1.8} />
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </button>
          ))}
        </div>

        {/* TUGAS LIST */}
        {filteredTugas.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 icon-wrap icon-indigo rounded-2xl mb-4">
              <BookOpen size={28} strokeWidth={1.5} />
            </div>
            <h3 className="font-bold mb-1">
              {filterStatus === 'sudah' ? 'Belum ada tugas yang selesai' :
               filterStatus === 'belum' ? 'Tidak ada tugas aktif' :
               filterStatus === 'terlambat' ? 'Tidak ada tugas yang terlewat' :
               'Belum ada tugas diberikan'}
            </h3>
            <p className="text-slate-400 text-sm">Guru belum memberikan tugas untuk kelas Anda.</p>
          </div>
        ) : filteredTugas.map(t => {
          const kumpulan = getSudahKumpul(t.id);
          const expired = isExpired(t.deadline);
          return (
            <div
              key={t.id}
              className="glass-card p-5 cursor-pointer hover:border-indigo-500/40 transition"
              onClick={() => { resetForm(); setSelectedTugas(t); }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${
                      kumpulan ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      expired  ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {kumpulan
                        ? <><CheckCircle2 size={11} /> Sudah Dikumpulkan</>
                        : expired
                        ? <><Timer size={11} /> Waktu Habis</>
                        : <><Pin size={11} /> Perlu Dikumpulkan</>}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                      {TIPE_LABEL[t.tipe_upload]}
                    </span>
                  </div>
                  <h3 className="font-bold text-white">{t.judul_tugas}</h3>
                  <p className="text-xs text-indigo-300">{t.mata_pelajaran || 'Tanpa Mata Pelajaran'}</p>
                  {t.deskripsi && <p className="text-sm text-slate-400 mt-1.5 line-clamp-2">{t.deskripsi}</p>}
                </div>
                <div className="text-right shrink-0">
                  {kumpulan?.nilai_guru !== null && kumpulan?.nilai_guru !== undefined ? (
                    <div className={`text-2xl font-black ${kumpulan.nilai_guru >= 75 ? 'text-green-400' : kumpulan.nilai_guru >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {kumpulan.nilai_guru}
                    </div>
                  ) : (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      kumpulan ? 'bg-green-500/10 text-green-400' : expired ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {kumpulan ? <CheckCheck size={16} /> : expired ? <AlertCircle size={16} /> : <Clock size={16} />}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><User size={11} /> {t.guru_nama}</span>
                <span className="flex items-center gap-1.5"><CalendarDays size={11} /> {t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Tanpa batas'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAIL & FORM MODAL */}
      {selectedTugas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={resetForm}>
          <div className="glass-card w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in border border-indigo-500/30" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selectedTugas.judul_tugas}</h2>
                  <p className="text-indigo-300 text-sm">{selectedTugas.mata_pelajaran}</p>
                </div>
                <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/8 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>
              {selectedTugas.deskripsi && (
                <div className="mt-3 p-3 bg-white/5 rounded-lg text-sm text-slate-300 whitespace-pre-wrap">
                  {selectedTugas.deskripsi}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CalendarDays size={11} /> Deadline: {selectedTugas.deadline ? new Date(selectedTugas.deadline).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Tanpa batas'}</span>
                <span className="flex items-center gap-1"><FileText size={11} /> {TIPE_LABEL[selectedTugas.tipe_upload]}</span>
              </div>
            </div>

            {/* Konten */}
            {(() => {
              const kumpulan = getSudahKumpul(selectedTugas.id);
              if (kumpulan) {
                return (
                  <div className="p-6">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-4">
                      <div className="flex items-center gap-2 font-semibold text-green-400 mb-1">
                        <CheckCheck size={16} /> Tugas Sudah Dikumpulkan
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(kumpulan.dikumpulkan_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {kumpulan.konten && <div className="mb-3 p-3 bg-white/5 rounded-lg text-sm text-slate-300">{kumpulan.konten}</div>}
                    {kumpulan.file_url && kumpulan.file_type?.startsWith('image/') && (
                      <img src={kumpulan.file_url} alt="Tugas" className="w-full rounded-xl object-cover max-h-64 mb-3" />
                    )}
                    {kumpulan.file_name && !kumpulan.file_type?.startsWith('image/') && (
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg text-sm text-indigo-300 mb-3">
                        <FolderOpen size={16} /> {kumpulan.file_name}
                      </div>
                    )}
                    {kumpulan.nilai_guru !== null && kumpulan.nilai_guru !== undefined ? (
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`text-4xl font-black ${kumpulan.nilai_guru >= 75 ? 'text-green-400' : kumpulan.nilai_guru >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {kumpulan.nilai_guru}
                          </div>
                          <div>
                            <div className="font-semibold text-white">Nilai dari Guru</div>
                            {kumpulan.komentar_guru && <div className="text-sm text-slate-300 italic">"{kumpulan.komentar_guru}"</div>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                        <Loader2 size={13} className="animate-spin" /> Menunggu penilaian dari guru...
                      </div>
                    )}
                  </div>
                );
              }

              const expired = isExpired(selectedTugas.deadline);
              if (expired) {
                return (
                  <div className="p-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 icon-wrap icon-red rounded-2xl mb-3">
                        <Timer size={22} strokeWidth={1.5} />
                      </div>
                      <div className="font-semibold text-red-400">Waktu Pengumpulan Sudah Habis</div>
                      <div className="text-sm text-slate-400 mt-1">Tugas ini tidak dapat dikumpulkan lagi.</div>
                    </div>
                  </div>
                );
              }

              return (
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <Upload size={16} className="text-indigo-400" /> Form Pengumpulan Tugas
                  </div>

                  {/* TEKS */}
                  {(selectedTugas.tipe_upload === 'teks') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Jawaban Teks <span className="text-red-400">*</span></label>
                      <textarea
                        rows={5}
                        value={konten}
                        onChange={e => setKonten(e.target.value)}
                        className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 text-sm transition"
                        placeholder="Tulis jawaban kamu di sini..."
                      />
                    </div>
                  )}

                  {/* FOTO */}
                  {(selectedTugas.tipe_upload === 'foto' || selectedTugas.tipe_upload === 'foto_atau_file') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                        Upload Foto {selectedTugas.tipe_upload === 'foto' && <span className="text-red-400">*</span>}
                      </label>
                      {cameraError && <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{cameraError}</div>}
                      {!foto && isCameraActive && (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-indigo-500/30 bg-black">
                          <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" playsInline autoPlay muted />
                          <div className="absolute inset-x-0 bottom-3 flex justify-center">
                            <button type="button" onClick={capturePhoto}
                              className="w-14 h-14 bg-white/20 hover:bg-white/40 border-4 border-white/60 rounded-full transition shadow-lg backdrop-blur-md flex items-center justify-center">
                              <Camera size={22} className="text-white" />
                            </button>
                          </div>
                        </div>
                      )}
                      {!foto && !isCameraActive && (
                        <div className="flex gap-2">
                          <div onClick={startCamera}
                            className="flex-1 py-8 border-2 border-dashed border-indigo-500/40 rounded-xl flex flex-col items-center justify-center text-indigo-400 hover:bg-indigo-500/5 transition cursor-pointer gap-1.5">
                            <Camera size={24} strokeWidth={1.5} />
                            <span className="text-sm font-semibold">Buka Kamera</span>
                          </div>
                          <label className="flex-1 py-8 border-2 border-dashed border-indigo-500/40 rounded-xl flex flex-col items-center justify-center text-indigo-400 hover:bg-indigo-500/5 transition cursor-pointer gap-1.5">
                            <Image size={24} strokeWidth={1.5} />
                            <span className="text-sm font-semibold">Pilih dari Galeri</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) { const reader = new FileReader(); reader.onload = ev => setFoto(ev.target.result); reader.readAsDataURL(f); }
                            }} />
                          </label>
                        </div>
                      )}
                      {foto && (
                        <div className="relative rounded-xl overflow-hidden border border-indigo-500/30">
                          <img src={foto} alt="Foto Tugas" className="w-full object-cover max-h-56" />
                          <button type="button" onClick={() => setFoto(null)}
                            className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                            <Trash2 size={12} /> Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FILE */}
                  {(selectedTugas.tipe_upload === 'file' || selectedTugas.tipe_upload === 'foto_atau_file') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                        Upload File {selectedTugas.tipe_upload === 'file' && <span className="text-red-400">*</span>}
                      </label>
                      {!file ? (
                        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-indigo-500/40 rounded-xl cursor-pointer hover:bg-indigo-500/5 transition">
                          <FolderOpen size={28} className="text-indigo-400" strokeWidth={1.5} />
                          <div>
                            <div className="font-semibold text-indigo-300">Klik untuk pilih file</div>
                            <div className="text-xs text-slate-400">PDF, Word, PowerPoint, Excel, dll (maks. 10MB)</div>
                          </div>
                          <input ref={fileInputRef} type="file" className="hidden"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                            onChange={handleFileChange}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                          <FolderOpen size={20} className="text-indigo-400 shrink-0" />
                          <span className="flex-1 text-sm font-semibold text-white truncate">{file.name}</span>
                          <button type="button" onClick={() => setFile(null)}
                            className="text-red-400 hover:text-red-300 transition p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CATATAN */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Catatan untuk Guru (Opsional)</label>
                    <input
                      type="text"
                      value={catatan}
                      onChange={e => setCatatan(e.target.value)}
                      className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm transition"
                      placeholder="Catatan tambahan..."
                    />
                  </div>

                  <button type="submit" disabled={isSubmitting}
                    className={`w-full py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg ${
                      isSubmitting ? 'bg-indigo-500/40 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-500/30'
                    }`}>
                    {isSubmitting
                      ? <><Loader2 size={18} className="animate-spin" /> Mengirim...</>
                      : <><Send size={18} /> Kumpulkan Tugas</>}
                  </button>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
