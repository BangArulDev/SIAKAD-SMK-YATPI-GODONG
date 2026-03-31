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
        // Since Supabase Auth usually uses Email, we might need to handle username/email conversion
        // If the user uses username, we might need a workaround or just recommend email.
        // For simplicity, let's assume they use email as the "username" input for now, 
        // OR we use a edge function/table look up.
        // Actually, SMK Yatpi might use username as dummy email: username@smkyatpi.sch.id
        const email = username.includes('@') ? username : `${username}@smkyatpi.sch.id`;
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          set({ session: { ...profile, email: data.user.email } });
          return profile;
        }
        throw new Error('Profile not found');
      },

      loginSiswa: async (nis) => {
        const { data: student, error } = await supabase
          .from('students')
          .select('*')
          .eq('nis', nis)
          .single();

        if (error || !student) throw new Error('NIS tidak terdaftar');

        const sess = { ...student, role: 'siswa', id: student.nis };
        set({ session: sess });
        return sess;
      },

      logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Logout error:", error);
        set({ session: null });
      },

      // --- TEACHERS (PROFILES) ---
      addTeacher: async (t) => {
        // Teacher needs auth account. Since we can't create auth accounts easily without admin key,
        // we'll instruct user to create auth users manually and then we link here, 
        // OR we just insert into profiles if the user already exists.
        // For bypass, we'll try to insert. This will fail if no auth user, 
        // but it's the only way without a service role.
        const { data, error } = await supabase.from('profiles').insert([t]).select().single();
        if (error) throw error;
        set(state => ({ teachers: [...(state.teachers || []), data] }));
      },

      updateTeacher: async (id, updates) => {
        const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
        if (error) throw error;
        set(state => ({
          teachers: (state.teachers || []).map(t => t.id === id ? data : t)
        }));
      },

      deleteTeacher: async (id) => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
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
        return true;
      },

      // --- RECORDS ---
      addRecord: async (rec) => {
        const today = getTodayDB();
        
        // Prevent duplicate today in cache first
        const records = get().records || [];
        const exists = records.find(r => r.nis === rec.nis && r.tanggal === today);
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
          if (error.code === '23505') throw new Error('NIS sudah terpakai');
          throw error;
        }
        set(state => ({ students: [...(state.students || []), data] }));
      },

      updateStudent: async (nis, updates) => {
        const { data, error } = await supabase.from('students').update(updates).eq('nis', nis).select().single();
        if (error) throw error;
        set(state => ({
          students: (state.students || []).map(s => s.nis === nis ? data : s)
        }));
      },

      deleteStudent: async (nis) => {
        const { error } = await supabase.from('students').delete().eq('nis', nis);
        if (error) throw error;
        set(state => ({
          students: (state.students || []).filter(s => s.nis !== nis)
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
        
        const payload = {
          ...data,
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
          nis: session.nis,
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
            nis: s.nis, nama: s.nama, kelas: s.kelas
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
