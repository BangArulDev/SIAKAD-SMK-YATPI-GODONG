// =============================================================
// KONFIGURASI SEKOLAH: SMK Yatpi
// Koordinat GPS dan utilitas validasi lokasi
// =============================================================

/**
 * Koordinat pusat SMK Yatpi Godong, Grobogan
 * Sumber: Google Maps → klik lokasi sekolah → salin koordinat
 */
export const SCHOOL_LAT = -7.027408734931382;
export const SCHOOL_LNG = 110.77992211997835;

/**
 * Radius area yang diizinkan untuk absen (dalam meter).
 * Siswa yang berada dalam radius ini dianggap di sekolah.
 * Sesuaikan jika area kampus lebih luas.
 */
export const SCHOOL_RADIUS_METERS = 200;

/**
 * Nama sekolah untuk ditampilkan di UI
 */
export const SCHOOL_NAME = 'SMK Yatpi';

/**
 * Menghitung jarak antara dua titik koordinat menggunakan formula Haversine.
 * @param {number} lat1 - Latitude titik 1 (sekolah)
 * @param {number} lng1 - Longitude titik 1 (sekolah)
 * @param {number} lat2 - Latitude titik 2 (siswa)
 * @param {number} lng2 - Longitude titik 2 (siswa)
 * @returns {number} Jarak dalam meter
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Hasil dalam meter
}

/**
 * Cek apakah koordinat siswa berada dalam radius area sekolah.
 * @param {number} lat - Latitude siswa
 * @param {number} lng - Longitude siswa
 * @returns {boolean} TRUE jika dalam area sekolah
 */
export function isWithinSchoolArea(lat, lng) {
  const distance = haversineDistance(SCHOOL_LAT, SCHOOL_LNG, lat, lng);
  return distance <= SCHOOL_RADIUS_METERS;
}

/**
 * Mendapatkan lokasi perangkat saat ini menggunakan Geolocation API.
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat ini tidak mendukung GPS/Geolocation.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, // Akurasi dalam meter
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Izin akses lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Informasi lokasi tidak tersedia. Pastikan GPS aktif.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Permintaan lokasi habis waktu. Coba lagi.'));
            break;
          default:
            reject(new Error('Gagal mendapatkan lokasi.'));
        }
      },
      {
        enableHighAccuracy: true,  // Gunakan GPS, bukan WiFi/Cell tower
        timeout: 15000,            // Timeout 15 detik
        maximumAge: 0,             // Jangan gunakan cache lokasi
      }
    );
  });
}
