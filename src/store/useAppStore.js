import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

// Helper to get today's date formatted for the DB
const getTodayDB = () => new Date().toLocaleDateString('en-CA');

// Helper: convert "HH:MM" or "HH:MM:SS" to total minutes
const toMinutes = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

const useAppStore = create(
  persist(
    (set, get) => ({
      // --- STATE ---
      session: null,         // Who is logged in (persisted locally)
      students: [],          // Cached from Supabase
      teachers: [],          // Cached from Supabase profiles
      records: [],           // Cached from Supabase
      mandiriSessions: [],   // ALL active sessions today (pagi & siang, multiple kelas)
      tugas: [],             // Assignments
      pengumpulan: [],       // Submissions
      isInitialized: false,
      // Pengaturan jam absensi — nilai default sebagai fallback jika DB belum ada
      settings: {
        jam_buka:              '07:00',
        jam_batas_hadir:       '07:15',
        jam_tutup:             '07:30',
        jam_buka_siang:        '12:30',
        jam_batas_hadir_siang: '12:45',
        jam_tutup_siang:       '13:00',
      },

      // --- INITIALIZATION ---
      initApp: async () => {
        try {
          // 1. Check current Supabase Auth session
          const { data: { session: authSession } } = await supabase.auth.getSession();
          
          if (authSession) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authSession.user.id)
              .single();
            if (profile) {
              set({ session: { ...profile, email: authSession.user.email } });
            }
          }

          // 2. Fetch all data needed for the app
          const [
            { data: students },
            { data: records },
            { data: tugas },
            { data: pengumpulan },
            { data: sessions },
            { data: profiles },
            { data: settingsRow }
          ] = await Promise.all([
            supabase.from('students').select('*'),
            supabase.from('absensi_records').select('*'),
            supabase.from('tugas').select('*'),
            supabase.from('pengumpulan').select('*'),
            // Load ALL open sessions for today (pagi & siang)
            supabase.from('absensi_sessions').select('*').eq('is_open', true).eq('tanggal', getTodayDB()).order('opened_at', { ascending: false }),
            supabase.from('profiles').select('*'),
            supabase.from('settings').select('*').eq('id', 'default').single()
          ]);

          // Parse waktu dari format 'HH:MM:SS' ke 'HH:MM'
          const parseTime = (t) => t ? t.slice(0, 5) : null;

          set({ 
            students: students || [], 
            records: records || [], 
            tugas: tugas || [], 
            pengumpulan: pengumpulan || [],
            teachers: profiles || [],
            mandiriSessions: sessions || [],
            isInitialized: true,
            ...(settingsRow ? {
              settings: {
                jam_buka:              parseTime(settingsRow.jam_buka)             || '07:00',
                jam_batas_hadir:       parseTime(settingsRow.jam_batas_hadir)      || '07:15',
                jam_tutup:             parseTime(settingsRow.jam_tutup)            || '07:30',
                jam_buka_siang:        parseTime(settingsRow.jam_buka_siang)       || '12:30',
                jam_batas_hadir_siang: parseTime(settingsRow.jam_batas_hadir_siang)|| '12:45',
                jam_tutup_siang:       parseTime(settingsRow.jam_tutup_siang)      || '13:00',
              }
            } : {})
          });

        } catch (err) {
          console.error("Initialization Failed:", err);
        }
      },

      // --- AUTHENTICATION ---
      loginGuru: async (username, password) => {
        // Login langsung via tabel profiles (tidak pakai Supabase Auth)
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', username.trim());

        if (error) throw new Error('Terjadi kesalahan koneksi saat memeriksa data');
        
        if (!profiles || profiles.length === 0) {
          throw new Error('Username tidak ditemukan');
        }

        const profile = profiles.find(p => p.password === password);
        
        if (!profile) {
          throw new Error('Password yang dimasukkan salah');
        }

        set({ session: profile });
        return profile;
      },

      loginSiswa: async (nisn) => {
        const { data: student, error } = await supabase
          .from('students')
          .select('*')
          .eq('nisn', nisn.trim())
          .single();

        if (error || !student) throw new Error('NISN tidak terdaftar');

        const sess = { ...student, role: 'siswa', id: student.nisn };
        set({ session: sess });
        return sess;
      },

      logout: async () => {
        // Tidak pakai Supabase Auth — cukup hapus session lokal
        set({ session: null });
      },

      // --- TEACHERS (PROFILES) ---
      addTeacher: async (t) => {
        // Generate UUID untuk id jika belum ada
        const payload = { ...t, id: t.id || crypto.randomUUID() };
        const { data, error } = await supabase.from('profiles').insert([payload]).select().single();
        if (error) throw error;
        set(state => ({ teachers: [...(state.teachers || []), data] }));
      },

      updateTeacher: async (id, updates) => {
        // Hapus kolom yang tidak perlu diupdate jika ada
        const { password, ...restUpdates } = updates;
        // Jika password diisi, sertakan; jika kosong, jangan ubah
        const payload = password && password.trim() ? updates : restUpdates;

        const { data, error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) {
          if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
            throw new Error('Gagal update: Data tidak ditemukan atau akses ditolak (cek RLS Policy Supabase)');
          }
          throw error;
        }
        if (!data) throw new Error('Gagal memperbarui data guru: tidak ada data yang dikembalikan');
        set(state => ({
          teachers: (state.teachers || []).map(t => t.id === id ? data : t)
        }));
      },

      deleteTeacher: async (id) => {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);
        if (error) {
          if (error.message?.includes('violates') || error.code === '23503') {
            throw new Error('Gagal hapus: Data guru ini masih memiliki referensi pada data lain (absensi/tugas)');
          }
          throw new Error(`Gagal menghapus: ${error.message} (Pastikan RLS Policy Supabase sudah diatur)`);
        }
        set(state => ({
          teachers: (state.teachers || []).filter(t => t.id !== id)
        }));
      },

      // --- MANDIRI SESSIONS (MULTI-SESI: PAGI & SIANG) ---

      /**
       * Buka sesi absensi baru.
       * @param {string} materi
       * @param {string} deskripsi
       * @param {string} kelas  - kelas yang dituju, atau 'Semua'
       * @param {boolean} isDaring  - mode online / bypass GPS
       * @param {string} sesi   - 'pagi' | 'siang'
       */
      openMandiri: async (materi, deskripsi, kelas, isDaring = false, sesi = 'pagi') => {
        const session = get().session;
        if (!session || (session.role !== 'guru' && session.role !== 'admin')) throw new Error('Hanya guru/admin');
        
        const mSess = {
          materi,
          deskripsi,
          kelas,
          sesi,                              // 'pagi' | 'siang'
          guru_id: session.id,
          guru_nama: session.nama,
          tanggal: getTodayDB(),
          is_open: true,
          is_daring: isDaring,
          opened_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('absensi_sessions')
          .insert([mSess])
          .select()
          .single();

        if (error) throw error;
        // Tambahkan ke array (tidak replace)
        set(state => ({ mandiriSessions: [...(state.mandiriSessions || []), data] }));
        return data;
      },

      /**
       * Tutup sesi berdasarkan ID spesifik.
       * @param {string} sessionId
       */
      closeMandiri: async (sessionId) => {
        const { error } = await supabase
          .from('absensi_sessions')
          .update({ is_open: false, closed_at: new Date().toISOString() })
          .eq('id', sessionId);

        if (error) throw error;
        // Hapus dari array state
        set(state => ({
          mandiriSessions: (state.mandiriSessions || []).filter(s => s.id !== sessionId)
        }));
      },

      /**
       * Cari sesi yang aktif untuk kelas tertentu pada waktu sekarang.
       * Digunakan di halaman siswa (Absensi.jsx).
       * Mengembalikan objek sesi atau null.
       */
      getActiveSessionForKelas: (kelas) => {
        const sessions = get().mandiriSessions || [];
        const settings = get().settings;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        for (const s of sessions) {
          if (!s.is_open) continue;
          if (s.tanggal !== getTodayDB()) continue;
          // Cocokkan kelas (atau sesi untuk Semua kelas)
          if (s.kelas !== 'Semua' && s.kelas !== kelas) continue;

          // Tentukan jendela waktu berdasarkan sesi pagi/siang
          const isSiang = s.sesi === 'siang';
          const jamBuka  = isSiang ? settings.jam_buka_siang  : settings.jam_buka;
          const jamTutup = isSiang ? settings.jam_tutup_siang : settings.jam_tutup;

          if (nowMin >= toMinutes(jamBuka) && nowMin < toMinutes(jamTutup)) {
            return s;  // Sesi ini aktif dan dalam jendela waktu yang benar
          }
        }
        return null;
      },

      /**
       * Menentukan status kehadiran otomatis (hadir/terlambat)
       * berdasarkan jam saat ini dan pengaturan sesi (pagi/siang).
       */
      getAutoAttendanceStatus: (sesi = 'pagi') => {
        const settings = get().settings;
        const batas = sesi === 'siang'
          ? settings.jam_batas_hadir_siang
          : settings.jam_batas_hadir;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        return nowMin > toMinutes(batas) ? 'terlambat' : 'hadir';
      },

      // --- SETTINGS ---
      updateSettings: async (newSettings) => {
        const { data, error } = await supabase
          .from('settings')
          .update({
            jam_buka:              newSettings.jam_buka,
            jam_batas_hadir:       newSettings.jam_batas_hadir,
            jam_tutup:             newSettings.jam_tutup,
            jam_buka_siang:        newSettings.jam_buka_siang,
            jam_batas_hadir_siang: newSettings.jam_batas_hadir_siang,
            jam_tutup_siang:       newSettings.jam_tutup_siang,
            updated_at:            new Date().toISOString(),
          })
          .eq('id', 'default')
          .select()
          .single();

        if (error) throw error;

        const parseTime = (t) => t ? t.slice(0, 5) : t;
        set({
          settings: {
            jam_buka:              parseTime(data.jam_buka)             || newSettings.jam_buka,
            jam_batas_hadir:       parseTime(data.jam_batas_hadir)      || newSettings.jam_batas_hadir,
            jam_tutup:             parseTime(data.jam_tutup)            || newSettings.jam_tutup,
            jam_buka_siang:        parseTime(data.jam_buka_siang)       || newSettings.jam_buka_siang,
            jam_batas_hadir_siang: parseTime(data.jam_batas_hadir_siang)|| newSettings.jam_batas_hadir_siang,
            jam_tutup_siang:       parseTime(data.jam_tutup_siang)      || newSettings.jam_tutup_siang,
          }
        });
      },

      // --- RECORDS ---
      addRecord: async (rec) => {
        const today = getTodayDB();
        const sesi = rec.sesi || 'pagi';
        
        // Prevent duplicate: satu siswa hanya bisa absen sekali per sesi per hari
        const records = get().records || [];
        const exists = records.find(r => r.nisn === rec.nisn && r.tanggal === today && r.sesi === sesi);
        if (exists) throw new Error(`Siswa ini sudah diabsen untuk sesi ${sesi === 'siang' ? 'Siang' : 'Pagi'} hari ini`);

        // Ambil materi dari sesi yang aktif untuk kelas siswa
        const activeSession = get().getActiveSessionForKelas(rec.kelas);

        const newRec = {
          ...rec,
          sesi,
          tanggal: today,
          waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          materi: activeSession?.materi || rec.materi || '-'
        };

        const { data, error } = await supabase
          .from('absensi_records')
          .insert([newRec])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') throw new Error(`Siswa ini sudah diabsen untuk sesi ${sesi === 'siang' ? 'Siang' : 'Pagi'} hari ini`);
          throw error;
        }

        set(state => ({ records: [...(state.records || []), data] }));
        return data;
      },

      deleteRecord: async (id) => {
        const { error } = await supabase.from('absensi_records').delete().eq('id', id);
        if (error) throw error;
        set(state => ({ records: (state.records || []).filter(r => r.id !== id) }));
      },

      getTodayRecords: () => {
        const today = getTodayDB();
        const recs = get().records || [];
        return recs.filter(r => r.tanggal === today);
      },

      // --- STUDENTS ---
      addStudent: async (s) => {
        const { data, error } = await supabase.from('students').insert([s]).select().single();
        if (error) {
          if (error.code === '23505') throw new Error('NISN sudah terpakai');
          throw error;
        }
        set(state => ({ students: [...(state.students || []), data] }));
      },

      updateStudent: async (nisn, updates) => {
        const { data, error } = await supabase.from('students').update(updates).eq('nisn', nisn).select().single();
        if (error) throw error;
        set(state => ({
          students: (state.students || []).map(s => s.nisn === nisn ? data : s)
        }));
      },

      deleteStudent: async (nisn) => {
        const { error } = await supabase.from('students').delete().eq('nisn', nisn);
        if (error) throw error;
        set(state => ({
          students: (state.students || []).filter(s => s.nisn !== nisn)
        }));
      },

      getClasses: () => {
        const studs = get().students || [];
        return [...new Set(studs.map(s => s.kelas))].sort();
      },

      // --- TUGAS ---
      addTugas: async (data) => {
        const session = get().session;
        if (!session || (session.role !== 'guru' && session.role !== 'admin')) throw new Error('Hanya guru/admin');
        
        // Konversi deadline dari local datetime ke UTC ISO string
        const deadlineISO = data.deadline ? new Date(data.deadline).toISOString() : null;

        const payload = {
          ...data,
          deadline: deadlineISO,
          guru_id: session.id,
          guru_nama: session.nama,
          is_active: true
        };

        const { data: res, error } = await supabase.from('tugas').insert([payload]).select().single();
        if (error) throw error;

        set(state => ({ tugas: [...(state.tugas || []), res] }));
        return res;
      },

      updateTugas: async (id, updates) => {
        const { data, error } = await supabase.from('tugas').update(updates).eq('id', id).select().single();
        if (error) throw error;
        set(state => ({
          tugas: (state.tugas || []).map(t => t.id === id ? data : t)
        }));
      },

      deleteTugas: async (id) => {
        const { error } = await supabase.from('tugas').delete().eq('id', id);
        if (error) throw error;
        set(state => ({
          tugas: (state.tugas || []).filter(t => t.id !== id),
          pengumpulan: (state.pengumpulan || []).filter(p => p.tugas_id !== id)
        }));
      },

      // --- PENGUMPULAN ---
      addPengumpulan: async (data) => {
        const session = get().session;
        if (!session) throw new Error('Harus login sebagai siswa');
        
        const payload = {
          ...data,
          nisn: session.nisn,
          nama: session.nama,
          kelas: session.kelas
        };

        const { data: res, error } = await supabase.from('pengumpulan').insert([payload]).select().single();
        if (error) {
          if (error.code === '23505') throw new Error('Tugas ini sudah dikumpulkan');
          throw error;
        }

        set(state => ({ pengumpulan: [...(state.pengumpulan || []), res] }));
        return res;
      },

      nilaiPengumpulan: async (id, nilai, komentar) => {
        const { data, error } = await supabase
          .from('pengumpulan')
          .update({ nilai_guru: nilai, komentar_guru: komentar })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        set(state => ({
          pengumpulan: (state.pengumpulan || []).map(p => p.id === id ? data : p)
        }));
      },

      // --- DATA MIGRATION ---
      migrateFromLocalStorage: async () => {
        const students = get().students;

        if (students.length > 0) {
          await supabase.from('students').insert(students.map(s => ({
            nisn: s.nisn, nama: s.nama, kelas: s.kelas
          })));
        }

        console.log("Migration finished.");
      }
    }),
    {
      name: 'smkyatpi_session', // Only persist session/auth local
      partialize: (state) => ({ session: state.session }), 
    }
  )
);

export default useAppStore;
