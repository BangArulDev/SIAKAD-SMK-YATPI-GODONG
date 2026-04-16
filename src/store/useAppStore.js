import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

// Helper to get today's date formatted for the DB
const getTodayDB = () => new Date().toLocaleDateString('en-CA');

const useAppStore = create(
  persist(
    (set, get) => ({
      // --- STATE ---
      session: null,       // Who is logged in (persisted locally)
      students: [],        // Cached from Supabase
      teachers: [],        // Cached from Supabase profiles
      records: [],         // Cached from Supabase
      mandiriSession: null, // Current active session
      tugas: [],           // Assignments
      pengumpulan: [],     // Submissions
      isInitialized: false,

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
            { data: profiles }
          ] = await Promise.all([
            supabase.from('students').select('*'),
            supabase.from('absensi_records').select('*'),
            supabase.from('tugas').select('*'),
            supabase.from('pengumpulan').select('*'),
            supabase.from('absensi_sessions').select('*').eq('is_open', true).eq('tanggal', getTodayDB()).order('opened_at', { ascending: false }).limit(1),
            supabase.from('profiles').select('*')
          ]);

          set({ 
            students: students || [], 
            records: records || [], 
            tugas: tugas || [], 
            pengumpulan: pengumpulan || [],
            teachers: profiles || [],
            mandiriSession: sessions?.[0] || null,
            isInitialized: true 
          });

          // 3. Option to perform migration if needed
          // await get().migrateFromLocalStorage();

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

      // --- MANDIRI SESSION ---
      openMandiri: async (materi, deskripsi, kelas, isDaring = false) => {
        const session = get().session;
        if (!session || (session.role !== 'guru' && session.role !== 'admin')) throw new Error('Hanya guru/admin');
        
        const mSess = {
          materi,
          deskripsi,
          kelas,
          guru_id: session.id,
          guru_nama: session.nama,
          tanggal: getTodayDB(),
          is_open: true,
          is_daring: isDaring,   // TRUE = pembelajaran online, bypass validasi GPS
          opened_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('absensi_sessions')
          .insert([mSess])
          .select()
          .single();

        if (error) throw error;
        set({ mandiriSession: data });
        return data;
      },

      closeMandiri: async () => {
        const m = get().mandiriSession;
        if (!m) return;

        const { error } = await supabase
          .from('absensi_sessions')
          .update({ is_open: false, closed_at: new Date().toISOString() })
          .eq('id', m.id);

        if (error) throw error;
        set({ mandiriSession: null });
      },

      isMandiriOpen: () => {
        const s = get().mandiriSession;
        if (!s || !s.is_open) return false;
        const opened = new Date(s.opened_at).getTime();
        if (Date.now() - opened > 8 * 60 * 60 * 1000) return false;
        if (s.tanggal !== getTodayDB()) return false;

        // Sesi absensi mandiri hanya dibuka pada jam 07:00 - 07:30 WIB
        const now = new Date();
        const totalMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinute  = 7 * 60;       // 07:00
        const closeMinute = 7 * 60 + 30;  // 07:30
        if (totalMinutes < openMinute || totalMinutes >= closeMinute) return false;

        return true;
      },

      // Menentukan status kehadiran otomatis berdasarkan jam absen
      // 07:00-07:15 → 'hadir', 07:16-07:30 → 'terlambat'
      getAutoAttendanceStatus: () => {
        const now = new Date();
        const totalMinutes = now.getHours() * 60 + now.getMinutes();
        const lateStart = 7 * 60 + 16; // 07:16
        return totalMinutes >= lateStart ? 'terlambat' : 'hadir';
      },

      // --- RECORDS ---
      addRecord: async (rec) => {
        const today = getTodayDB();
        
        // Prevent duplicate today in cache first
        const records = get().records || [];
        const exists = records.find(r => r.nisn === rec.nisn && r.tanggal === today);
        if (exists) throw new Error('Siswa ini sudah diabsen hari ini');

        const newRec = {
          ...rec,
          tanggal: today,
          waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          materi: get().mandiriSession?.materi || rec.materi
        };

        const { data, error } = await supabase
          .from('absensi_records')
          .insert([newRec])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') throw new Error('Siswa ini sudah diabsen hari ini');
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
        // Input dari datetime-local: "2026-04-16T16:00" (tanpa timezone → dianggap lokal WIB)
        // new Date() akan membacanya sebagai lokal, kemudian .toISOString() mengubah ke UTC yang benar
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
