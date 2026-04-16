import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAppStore from '../store/useAppStore';
import { useToast } from '../components/Toast';
import { supabase } from "../lib/supabase";
import {
  getCurrentLocation,
  isWithinSchoolArea,
  haversineDistance,
  SCHOOL_NAME,
  SCHOOL_RADIUS_METERS,
} from "../lib/schoolConfig";
import {
  ClipboardList, BookOpen, LogOut, Lock, MapPin, Wifi,
  Loader2, AlertTriangle, XCircle, RefreshCw, CheckCircle2,
  Camera, RotateCcw, Send, Clock, CheckCheck, MapPinOff
} from 'lucide-react';

// Status validasi lokasi
const LOC_STATUS = {
  IDLE: 'idle',           // Belum diminta
  LOADING: 'loading',     // Sedang mendeteksi
  IN_AREA: 'in_area',     // Dalam area sekolah ✅
  OUT_AREA: 'out_area',   // Di luar area ❌
  ERROR: 'error',         // Gagal akses GPS
  SKIPPED: 'skipped',     // Sesi daring, GPS dilewati 🌐
};

export default function Absensi() {
  const navigate = useNavigate();
  const { session, mandiriSessions, getActiveSessionForKelas, getAutoAttendanceStatus, addRecord, logout, settings } = useAppStore();
  const { addToast } = useToast();

  // Cari sesi aktif untuk kelas siswa ini (null jika tidak ada)
  const activeSession = getActiveSessionForKelas(session?.kelas);
  const mandiriActive = !!activeSession;
  const isDaring = activeSession?.is_daring === true;

  const [status, setStatus] = useState("hadir");
  const [foto, setFoto] = useState(null);
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // === GPS STATE ===
  const [locStatus, setLocStatus] = useState(LOC_STATUS.IDLE);
  const [locData, setLocData] = useState(null);
  const [locError, setLocError] = useState("");
  const [locDistance, setLocDistance] = useState(null);

  // === KAMERA STATE ===
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Siswa diizinkan hadir jika: mode daring ATAU dalam area sekolah
  const canAbsenHadir = isDaring || locStatus === LOC_STATUS.IN_AREA;

  // === DETEKSI LOKASI OTOMATIS ===
  const detectLocation = useCallback(async () => {
    if (isDaring) {
      setLocStatus(LOC_STATUS.SKIPPED);
      return;
    }

    setLocStatus(LOC_STATUS.LOADING);
    setLocError("");
    setLocData(null);
    setLocDistance(null);

    try {
      const coords = await getCurrentLocation();
      const inArea = isWithinSchoolArea(coords.latitude, coords.longitude);
      const dist = Math.round(
        haversineDistance(
          // SCHOOL_LAT/LNG sudah diimpor dari schoolConfig
          -7.027408734931382, 110.77992211997835,
          coords.latitude,
          coords.longitude
        )
      );

      setLocData(coords);
      setLocDistance(dist);
      setLocStatus(inArea ? LOC_STATUS.IN_AREA : LOC_STATUS.OUT_AREA);

      if (!inArea) {
        addToast(`Kamu berada ${dist}m dari sekolah. Hanya Sakit/Izin yang bisa dipilih.`, 'warning');
      }
    } catch (err) {
      setLocStatus(LOC_STATUS.ERROR);
      setLocError(err.message);
      addToast(err.message, 'error');
    }
  }, [isDaring, addToast]);

  // Jalankan deteksi lokasi saat sesi aktif terbuka
  useEffect(() => {
    if (mandiriActive) {
      detectLocation();
    }
  }, [mandiriActive, detectLocation]);

  // Jika di luar area sekolah dan masih pilih 'hadir', reset ke 'sakit'
  useEffect(() => {
    if (locStatus === LOC_STATUS.OUT_AREA && status === 'hadir') {
      setStatus('sakit');
      setFoto(null);
      stopCamera();
    }
  }, [locStatus]);

  // === KAMERA ===
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => console.error("Play error:", e));
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    setCameraError("");
    setFoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Gagal akses kamera:", err);
      setCameraError("Gagal mengakses kamera. Pastikan memberikan izin akses.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const maxDim = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > height) { if (width > maxDim) { height *= maxDim / width; width = maxDim; } }
    else { if (height > maxDim) { width *= maxDim / height; height = maxDim; } }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
    setFoto(compressedBase64);
    stopCamera();
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;

    // Blokir memilih hadir jika di luar area dan bukan daring
    if (val === 'hadir' && !canAbsenHadir) {
      addToast('Kamu tidak berada di area sekolah. Pilih Sakit atau Izin.', 'warning');
      return;
    }

    setStatus(val);
    if (val !== "hadir") {
      setFoto(null);
      stopCamera();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Tentukan status final berdasarkan waktu absen (otomatis) + sesi aktif
    const sesiAktif = activeSession?.sesi || 'pagi';
    const finalStatus = status === 'hadir' ? getAutoAttendanceStatus(sesiAktif) : status;

    // Validasi ulang lokasi sebelum submit
    if (finalStatus === 'hadir' && !canAbsenHadir) {
      return addToast('Kamu tidak berada di area sekolah. Tidak bisa absen Hadir/Terlambat.', 'error');
    }

    if (status === "hadir" && !foto) {
      return addToast('WAJIB mengambil foto selfie bukti kehadiran!', 'warning');
    }

    if (status !== "hadir" && !keterangan.trim()) {
      return addToast('WAJIB menuliskan keterangan alasannya!', 'warning');
    }

    setIsSubmitting(true);
    stopCamera();

    try {
      let finalFotoUrl = null;

      if (foto && status === "hadir") {
        // 1. Convert base64 to Blob
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
        const blob = new Blob(byteArrays, { type: contentType });

        // 2. Upload to Supabase Storage
        const fileName = `${session.nisn}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('absensi-foto')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('absensi-foto')
          .getPublicUrl(uploadData.path);

        finalFotoUrl = publicUrl;
      }

      // 4. Save Record to DB
      await addRecord({
        nisn: session.nisn,
        nama: session.nama,
        kelas: session.kelas,
        status: finalStatus,
        sesi: activeSession?.sesi || 'pagi',   // 'pagi' | 'siang'
        keterangan,
        foto_url: finalFotoUrl,
        metode: isDaring ? 'siswa-daring' : 'siswa-form',
        materi: activeSession?.materi || '-',
        latitude: locData?.latitude || null,
        longitude: locData?.longitude || null,
        is_in_area: locStatus === LOC_STATUS.IN_AREA ? true : (locStatus === LOC_STATUS.SKIPPED ? null : false),
      });

      setIsSubmitting(false);
      setSuccess(true);
    } catch (error) {
      setIsSubmitting(false);
      addToast(error.message, 'error');
    }
  };

  // === RENDER: Sukses ===
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="glass-card w-full max-w-md p-10 shadow-lg text-center border border-emerald-500/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl icon-wrap icon-green mb-6">
            <CheckCheck size={40} strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-emerald-400">Absensi Berhasil!</h1>
          <p className="text-sm text-slate-400 mb-8">Data kehadiran kamu telah tercatat ke dalam sistem.</p>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition border border-white/10 flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Keluar Sesi
          </button>
        </div>
      </div>
    );
  }

  // === RENDER: Komponen Status Lokasi ===
  const renderLocationStatus = () => {
    if (isDaring) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="icon-wrap icon-wrap-sm icon-blue"><Wifi size={14} /></div>
          <div>
            <div className="text-sm font-semibold text-blue-300">Mode Daring Aktif</div>
            <div className="text-xs text-slate-400">Validasi lokasi dilewati — kamu bisa absen dari mana saja.</div>
          </div>
        </div>
      );
    }

    if (locStatus === LOC_STATUS.IDLE) return null;

    if (locStatus === LOC_STATUS.LOADING) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <Loader2 size={18} className="text-indigo-400 animate-spin shrink-0" />
          <div>
            <div className="text-sm font-semibold text-slate-200">Mendeteksi Lokasi...</div>
            <div className="text-xs text-slate-400">Pastikan GPS aktif dan izin lokasi diberikan.</div>
          </div>
        </div>
      );
    }

    if (locStatus === LOC_STATUS.IN_AREA) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="icon-wrap icon-wrap-sm icon-green shrink-0"><MapPin size={14} /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-400">Lokasi Terverifikasi</div>
            <div className="text-xs text-slate-400 truncate">
              ±{locDistance}m dari {SCHOOL_NAME} (radius {SCHOOL_RADIUS_METERS}m)
            </div>
          </div>
          <button type="button" onClick={detectLocation}
            className="shrink-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition text-slate-300">
            <RefreshCw size={13} />
          </button>
        </div>
      );
    }

    if (locStatus === LOC_STATUS.OUT_AREA) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="icon-wrap icon-wrap-sm icon-red shrink-0"><MapPinOff size={14} /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-400">Di Luar Area Sekolah</div>
            <div className="text-xs text-slate-400">
              ±{locDistance}m dari {SCHOOL_NAME}. Hadir/Terlambat tidak tersedia.
            </div>
          </div>
          <button type="button" onClick={detectLocation}
            className="shrink-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition text-slate-300">
            <RefreshCw size={13} />
          </button>
        </div>
      );
    }

    if (locStatus === LOC_STATUS.ERROR) {
      return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="icon-wrap icon-wrap-sm icon-orange shrink-0"><XCircle size={14} /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-orange-400">Gagal Akses Lokasi</div>
            <div className="text-xs text-slate-400 mt-0.5">{locError}</div>
            <button type="button" onClick={detectLocation}
              className="mt-2 flex items-center gap-1 px-3 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition text-orange-300 font-semibold">
              <RefreshCw size={11} /> Coba Lagi
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // === RENDER: Main ===
  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* TOP BAR */}
      <div className="w-full max-w-lg flex items-center justify-between p-4 mb-4 border border-white/8 bg-[#06061a]/80 backdrop-blur-md rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="icon-wrap icon-wrap-sm icon-indigo"><ClipboardList size={15} /></div>
          <div>
            <div className="font-bold text-sm text-white">Form Absensi</div>
            <div className="text-xs text-indigo-300">{session?.nama} · {session?.kelas}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/tugas-siswa')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition">
            <BookOpen size={13} /> Tugas
          </button>
          <button onClick={() => { stopCamera(); logout(); navigate("/"); }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {!mandiriActive ? (
        <div className="w-full max-w-lg glass-card p-10 text-center animate-fade-in border border-red-500/20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl icon-wrap icon-red mb-5">
            <Lock size={28} strokeWidth={1.8} />
          </div>
          <h2 className="text-xl font-bold mb-2 text-red-400">Sesi Absensi Ditutup</h2>
          <p className="text-sm text-slate-400">Sesi absensi hanya dibuka otomatis pada pukul <strong className="text-slate-300">{settings?.jam_buka || '07:00'} – {settings?.jam_tutup || '07:30'} WIB</strong>.</p>
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span><strong className="text-green-400">{settings?.jam_buka || '07:00'} – {settings?.jam_batas_hadir || '07:15'}</strong> → Status: <strong className="text-green-400">Hadir</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
              <span><strong className="text-yellow-400">{settings?.jam_batas_hadir || '07:15'} – {settings?.jam_tutup || '07:30'}</strong> → Status: <strong className="text-yellow-400">Terlambat</strong></span>
            </div>
          </div>
          <button onClick={() => window.location.reload()}
            className="mt-6 btn-primary text-sm">
            <RefreshCw size={14} /> Cek Ulang Status
          </button>
        </div>
      ) : (
        <div className="w-full max-w-lg glass-card animate-fade-in">
          <div className="p-5 border-b border-white/10 bg-indigo-500/5">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${activeSession?.sesi === 'siang' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {activeSession?.sesi === 'siang' ? '🌙 SESI SIANG' : '☀️ SESI PAGI'}
              </span>
            </div>
            <h1 className="text-lg font-bold mb-0.5">Materi: {activeSession?.materi}</h1>
            <p className="text-xs text-slate-400">{activeSession?.deskripsi || 'Sesi mandiri aktif'}</p>
            {isDaring && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                <Wifi size={11} /> MODE DARING
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {/* === STATUS LOKASI === */}
            {renderLocationStatus()}

            {/* === INFO WAKTU OTOMATIS === */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-2">
                <Clock size={13} /> Status Kehadiran Otomatis
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span><strong className="text-green-400">{settings?.jam_buka || '07:00'} – {settings?.jam_batas_hadir || '07:15'}</strong> → Hadir</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span><strong className="text-yellow-400">{settings?.jam_batas_hadir || '07:15'} – {settings?.jam_tutup || '07:30'}</strong> → Terlambat</span>
                </div>
              </div>
              <p className="text-slate-500 italic mt-2">Status ditentukan otomatis saat menekan tombol kirim.</p>
            </div>

            {/* === STATUS KEHADIRAN === */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Status Kehadiran</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: 'hadir', label: 'Hadir',
                    activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                    Icon: CheckCircle2, locked: !canAbsenHadir },
                  { val: 'sakit', label: 'Sakit',
                    activeClass: 'border-amber-500 bg-amber-500/10 text-amber-400',
                    Icon: AlertTriangle, locked: false },
                  { val: 'izin', label: 'Izin',
                    activeClass: 'border-blue-500 bg-blue-500/10 text-blue-400',
                    Icon: ClipboardList, locked: false },
                ].map(({ val, label, activeClass, Icon, locked }) => (
                  <label
                    key={val}
                    title={locked ? 'Tidak tersedia — kamu di luar area sekolah' : ''}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-3 border rounded-xl cursor-pointer transition select-none
                      ${status === val ? activeClass : 'border-white/10 hover:border-white/25 text-slate-400'}
                      ${locked ? 'opacity-40 cursor-not-allowed' : ''}
                    `}
                  >
                    <input type="radio" name="status" value={val} checked={status === val}
                      onChange={handleStatusChange} disabled={locked} className="hidden" />
                    <Icon size={20} strokeWidth={1.8} />
                    <span className="font-semibold text-sm">{label}</span>
                    {locked && (
                      <div className="absolute top-1 right-1.5"><Lock size={10} className="text-current opacity-60" /></div>
                    )}
                  </label>
                ))}
              </div>
              {locStatus === LOC_STATUS.OUT_AREA && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Hadir dikunci — kamu di luar area {SCHOOL_NAME}.
                </p>
              )}
              {locStatus === LOC_STATUS.ERROR && (
                <p className="mt-2 text-xs text-orange-400 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Hadir dikunci — GPS tidak dapat diakses.
                </p>
              )}
            </div>

            {/* === FOTO (hanya untuk hadir) === */}
            {status === "hadir" && (
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4 rounded-xl border border-indigo-500/30">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300 mb-3">
                  <Camera size={15} /> Foto Selfie (Wajib)
                </div>

                {cameraError && (
                  <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
                    <XCircle size={14} /> {cameraError}
                  </div>
                )}

                {!foto && isCameraActive && (
                  <div className="relative w-full overflow-hidden rounded-xl border border-indigo-500/30 bg-black aspect-3/4">
                    <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" playsInline autoPlay muted />
                    <div className="absolute inset-x-0 bottom-4 flex justify-center">
                      <button type="button" onClick={capturePhoto}
                        className="w-16 h-16 bg-white/20 hover:bg-white/40 border-4 border-white/60 rounded-full transition shadow-lg backdrop-blur-md flex items-center justify-center">
                        <Camera size={24} className="text-white" />
                      </button>
                    </div>
                  </div>
                )}

                {!foto && !isCameraActive && (
                  <div onClick={startCamera}
                    className="w-full py-10 border-2 border-dashed border-indigo-500/50 rounded-xl flex flex-col items-center justify-center text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer gap-2">
                    <Camera size={32} strokeWidth={1.5} />
                    <span className="font-semibold text-sm">Ketuk untuk Membuka Kamera</span>
                  </div>
                )}

                {foto && (
                  <div className="relative w-full overflow-hidden rounded-xl border border-indigo-500/30">
                    <img src={foto} alt="Bukti" className="w-full object-cover max-h-64" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-linear-to-t from-black/80 to-transparent flex justify-end">
                      <button type="button" onClick={startCamera}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-lg">
                        <RotateCcw size={13} /> Ulangi Foto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === KETERANGAN === */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Keterangan {status !== "hadir" && <span className="text-[#f59e0b]">(Wajib)</span>}
              </label>
              <textarea
                className="w-full bg-[#0d0d25] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-24 transition"
                placeholder={status === "hadir" ? "Catatan opsional..." : `Alasan status ${status}...`}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            {/* === TOMBOL SUBMIT === */}
            <button
              type="submit"
              disabled={isSubmitting || locStatus === LOC_STATUS.LOADING}
              className={`w-full py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg ${
                isSubmitting || locStatus === LOC_STATUS.LOADING
                  ? 'bg-indigo-500/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-500/30'
              }`}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Mengirim...</>
              ) : locStatus === LOC_STATUS.LOADING ? (
                <><Loader2 size={18} className="animate-spin" /> Mendeteksi Lokasi...</>
              ) : (
                <><Send size={18} /> Kirim Kehadiran</>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
