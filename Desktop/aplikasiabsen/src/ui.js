// Helper bersama untuk semua layar.

/**
 * Amankan teks dari API sebelum dimasukkan ke innerHTML.
 * Tanpa ini, nama magang atau alasan izin bisa menyuntikkan HTML.
 */
export function esc(nilai) {
  return String(nilai ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/** Tampilkan / sembunyikan kotak galat. El harus punya [data-galat] dan [data-galat-teks]. */
export function tampilkanGalat(el, pesan) {
  const kotak = el.querySelector('[data-galat]');
  if (!kotak) return;
  kotak.querySelector('[data-galat-teks]').textContent = pesan;
  kotak.hidden = false;
}

export function sembunyikanGalat(el) {
  const kotak = el.querySelector('[data-galat]');
  if (kotak) kotak.hidden = true;
}

// Zona waktu kantor. Semua tampilan waktu dikunci ke sini, jadi jam tetap benar
// walau zona waktu perangkat salah disetel (php.ini XAMPP di mesin ini saja
// masih Europe/Berlin — kesalahan seperti itu tidak boleh sampai ke layar).
const ZONA = 'Asia/Jakarta';

function keTanggal(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "19 Okt 2026, 08.03" */
export function waktu(iso) {
  const d = keTanggal(iso);
  if (!d) return '—';
  return d.toLocaleString('id-ID', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "08.03" */
export function jam(iso) {
  const d = keTanggal(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('id-ID', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "19 Okt 2026" */
export function tanggal(iso) {
  const d = keTanggal(iso);
  if (!d) return '—';
  return d.toLocaleDateString('id-ID', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Senin, 19 Oktober 2026" */
export function tanggalPanjang(iso) {
  const d = iso ? keTanggal(iso) : new Date();
  if (!d) return '—';
  return d.toLocaleDateString('id-ID', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * "Sen, 19" — cukup untuk daftar harian dalam satu bulan; tahunnya sudah
 * tertulis di pemilih bulan di atasnya.
 *
 * Tanggalnya dibaca sebagai UTC karena "YYYY-MM-DD" memang disimpan begitu.
 * Memakai zona waktu perangkat akan menggesernya sehari pada laptop yang
 * jamnya belum disetel.
 */
export function labelTanggal(tanggal) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(tanggal);
  return `${HARI_PENDEK[d.getUTCDay()]}, ${d.getUTCDate()}`;
}

/**
 * Jam berjalan. Mengembalikan fungsi penghenti — WAJIB dipanggil saat layar
 * dilepas, kalau tidak timer-nya terus hidup di latar belakang.
 */
export function jamBerjalan(elJam, elTanggal) {
  const gambar = () => {
    const kini = new Date();
    if (elJam) {
      elJam.textContent = kini.toLocaleTimeString('id-ID', {
        timeZone: ZONA,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }
    if (elTanggal) elTanggal.textContent = tanggalPanjang(kini);
  };

  gambar();
  const timer = setInterval(gambar, 1000);
  return () => clearInterval(timer);
}

/** Inisial dari nama, maksimal dua huruf: "Budi Santoso" -> "BS" */
export function inisial(nama) {
  return String(nama ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0])
    .join('')
    .toUpperCase();
}

// Gaya kolom isian dipakai bersama oleh layar masuk dan kiosk, jadi ditulis
// sekali di sini. Kalau salah satunya diubah sendirian, dua layar itu akan
// tampak seperti dua aplikasi berbeda.
export const KELAS_ISIAN =
  'block w-full rounded-xl border border-ink/10 bg-white/70 px-3.5 py-3 text-ink transition ' +
  'placeholder:text-muted focus:border-merek/50 focus:bg-white/90 focus:ring-4 ' +
  'focus:ring-merek/15 focus:outline-none';

// ── Dialog ─────────────────────────────────────────────────────────────────
// Memakai <dialog> bawaan browser: backdrop, kunci fokus, dan tombol Esc sudah
// ditangani browser, jadi tidak ada kode perangkap fokus yang perlu ditulis.
//
// Judul dan pesan diisi lewat textContent, bukan innerHTML, sehingga teks dari
// API tidak bisa menyuntikkan HTML.
//
// Elemennya ditempel di <body>, bukan di dalam #akar, supaya tidak ikut
// terhapus saat berpindah layar.

// Nilai map ini harus berupa nama kelas utuh. Tailwind memindai berkas ini
// sebagai teks, jadi kelas yang dirakit dari potongan tidak akan ikut dibuat.
const KELAS_TOMBOL = {
  utama:
    'cursor-pointer rounded-full bg-merek px-5 py-2.5 text-sm font-medium text-white shadow-naik ' +
    'transition duration-200 ease-apple hover:bg-merek-gelap active:scale-[0.97]',
  batal:
    'cursor-pointer rounded-full border border-ink/12 bg-white/70 px-5 py-2.5 text-sm font-medium ' +
    'text-ink transition duration-200 ease-apple hover:bg-white active:scale-[0.97]',
  bahaya:
    'cursor-pointer rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-naik ' +
    'transition duration-200 ease-apple hover:bg-rose-700 active:scale-[0.97]',
};

const GAYA_IKON = {
  berhasil: 'bg-emerald-500/15 text-emerald-700',
  tanya: 'bg-amber-500/15 text-amber-700',
};

const IKON_DIALOG = {
  berhasil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
               <path d="M20 6L9 17l-5-5" />
             </svg>`,
  tanya: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.2a2.5 2.5 0 1 1 3.1 2.6c-.6.2-.9.8-.9 1.4v.3" />
            <path d="M12 16.6h.01" />
          </svg>`,
};

let kotakDialog = null;

function ambilDialog() {
  if (kotakDialog) return kotakDialog;

  kotakDialog = document.createElement('dialog');
  // `kaca-tebal`, bukan `kaca`: dialog menampilkan keputusan yang harus dibaca
  // benar, jadi bahannya lebih pekat. Latar belakangnya diatur di style.css.
  kotakDialog.className = 'kaca-tebal m-auto w-full max-w-sm rounded-[1.5rem] p-6 text-ink';
  kotakDialog.innerHTML = `
    <div class="flex gap-3.5">
      <span data-ikon-dialog class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full"></span>
      <div class="min-w-0">
        <h2 data-judul-dialog class="font-semibold text-ink"></h2>
        <p data-pesan-dialog class="mt-1 text-sm text-muted"></p>
      </div>
    </div>
    <div data-aksi-dialog class="mt-6 flex flex-wrap justify-end gap-2"></div>`;

  document.body.appendChild(kotakDialog);
  return kotakDialog;
}

function bukaDialog({ jenis, judul, pesan, tombol }) {
  const d = ambilDialog();

  d.querySelector('[data-judul-dialog]').textContent = judul;
  d.querySelector('[data-pesan-dialog]').textContent = pesan;

  const ikon = d.querySelector('[data-ikon-dialog]');
  ikon.className = `mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${GAYA_IKON[jenis]}`;
  ikon.innerHTML = IKON_DIALOG[jenis];

  const wadah = d.querySelector('[data-aksi-dialog]');
  wadah.replaceChildren();

  return new Promise((selesai) => {
    let sudahSelesai = false;

    // Satu pintu keluar. Promise ini hanya boleh selesai sekali, dari tombol
    // atau dari Esc.
    const selesaikan = (nilai) => {
      if (sudahSelesai) return;
      sudahSelesai = true;
      selesai(nilai);
    };

    for (const t of tombol) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = KELAS_TOMBOL[t.gaya];
      b.textContent = t.label;
      b.addEventListener('click', () => {
        // Selesai langsung dari tombolnya, bukan menunggu event `close`.
        //
        // Chrome menunda event `close` selama halamannya tidak terlihat
        // (diminimalkan atau jadi tab latar). Kalau tombol hanya menutup
        // dialog dan seluruh alur bergantung pada event itu, alur yang
        // menunggu akan berhenti tanpa pesan apa pun — pengguna menekan
        // "Mengerti" dan layarnya diam saja.
        selesaikan(t.nilai);
        if (d.open) d.close();
      });
      wadah.appendChild(b);
    }

    // Esc ikut menutup dialog tanpa lewat tombol; hasilnya tetap false.
    d.addEventListener('close', () => selesaikan(false), { once: true });

    if (!d.open) d.showModal();
  });
}

/** Dialog pemberitahuan. Satu tombol, tidak mengembalikan apa pun. */
export function beritahu({ judul, pesan, tombol = 'Mengerti' }) {
  return bukaDialog({
    jenis: 'berhasil',
    judul,
    pesan,
    tombol: [{ label: tombol, gaya: 'utama', nilai: true }],
  });
}

/** Dialog pertanyaan. Mengembalikan true kalau disetujui, false kalau dibatalkan. */
export function konfirmasi({ judul, pesan, tombol = 'Ya', batal = 'Batal', bahaya = false }) {
  return bukaDialog({
    jenis: 'tanya',
    judul,
    pesan,
    // Batal ditaruh lebih dulu supaya fokus awal browser jatuh ke sana,
    // dan tombol Enter tidak langsung menyetujui hal yang berbahaya.
    tombol: [
      { label: batal, gaya: 'batal', nilai: false },
      { label: tombol, gaya: bahaya ? 'bahaya' : 'utama', nilai: true },
    ],
  });
}

// ── Bulan ──────────────────────────────────────────────────────────────────
//
// Tiga layar memakai nama bulan yang sama panjang (Riwayat Absen, Izin & Cuti,
// dan Rekap & Laporan). Dua daftar nama bulan di dua berkas akan berbeda pada
// satu ejaan cepat atau lambat, dan itu jenis kesalahan yang paling lama
// ketahuan karena angkanya tetap benar.

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** "2026-10" -> "Oktober 2026" */
export function labelBulan(bulan) {
  const [tahun, bln] = String(bulan).split('-');
  const nama = NAMA_BULAN[Number(bln) - 1];
  return nama ? `${nama} ${tahun}` : String(bulan);
}

/** Bulan berjalan menurut jam kantor, bentuk "2026-10". */
export function bulanIni() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7);
}

/** Bulan digeser n bulan. Dipakai tombol mundur/maju di riwayat dan laporan. */
export function geserBulan(bulan, n) {
  const [tahun, bln] = String(bulan).split('-').map(Number);
  const d = new Date(Date.UTC(tahun, bln - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Dialog formulir ────────────────────────────────────────────────────────
//
// Dialog pemberitahuan dan pertanyaan isinya cuma teks, jadi bentuknya tetap
// dan satu elemen bisa dipakai bergantian. Formulir tidak: kolomnya berbeda di
// tiap layar. Karena itu formulir membuat elemen <dialog> baru setiap kali
// dibuka dan membuangnya lagi setelah ditutup — kalau dipakai bersama, kolom
// sisa dari layar sebelumnya akan ikut terbawa.

const IKON_GALAT_FORM = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 size-4 shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7.8v5" /><path d="M12 16.4h.01" />
  </svg>`;

const TIPE_ISIAN = {
  teks: 'text',
  email: 'email',
  sandi: 'password',
  angka: 'number',
  tanggal: 'date',
  jam: 'time',
};

function satuKolom(k, nilaiAwal, id) {
  const isi =
    k.jenis === 'pilih'
      ? `<select id="${id}" name="${k.nama}" class="${KELAS_ISIAN}">
           ${(k.pilihan ?? [])
             .map(
               (p) =>
                 `<option value="${esc(p.nilai)}"${String(p.nilai) === String(nilaiAwal) ? ' selected' : ''}>${esc(p.label)}</option>`,
             )
             .join('')}
         </select>`
      : k.jenis === 'panjang'
        ? // Alasan izin dan catatan penolakan panjangnya tidak bisa ditebak, dan
          // kotak satu baris memaksa orang menggulir isiannya sendiri untuk
          // membaca ulang apa yang baru dia tulis.
          `<textarea id="${id}" name="${k.nama}" rows="3" class="${KELAS_ISIAN} min-h-24 resize-y"
                     placeholder="${esc(k.contoh ?? '')}">${esc(nilaiAwal)}</textarea>`
        : `<input id="${id}" name="${k.nama}" type="${TIPE_ISIAN[k.jenis] ?? 'text'}"
                  value="${esc(nilaiAwal)}" class="${KELAS_ISIAN}"
                  placeholder="${esc(k.contoh ?? '')}"
                  ${k.jenis === 'sandi' ? 'autocomplete="new-password"' : 'autocomplete="off"'}
                  ${k.langkah ? `step="${esc(k.langkah)}"` : ''}
                  ${k.min !== undefined ? `min="${esc(k.min)}"` : ''}>`;

  return `
    <div class="${k.lebar === 'penuh' ? 'sm:col-span-2' : ''}">
      <label for="${id}" class="mb-1.5 block text-sm font-medium text-ink">${esc(k.label)}</label>
      ${isi}
      ${k.petunjuk ? `<p class="mt-1.5 text-xs text-muted">${esc(k.petunjuk)}</p>` : ''}
    </div>`;
}

/**
 * Dialog berisi formulir. Mengembalikan true kalau tersimpan, false kalau
 * dibatalkan.
 *
 * `kolom` menerangkan tiap isian:
 *   { nama, label, jenis, wajib, contoh, petunjuk, pilihan, lebar, min, langkah }
 *   jenis  : 'teks' | 'email' | 'sandi' | 'angka' | 'tanggal' | 'jam' | 'pilih' | 'panjang'
 *   wajib  : dicek di sini, tanpa memakai validasi bawaan browser
 *   pilihan: [{ nilai, label }] untuk jenis 'pilih'
 *   lebar  : 'penuh' supaya kolom mengisi dua lajur sekaligus
 *
 * `kirim(nilai)` dipanggil saat disimpan. Lempar Error untuk menampilkan
 * pesannya di dalam dialog tanpa menutupnya — jadi aturan yang cuma diketahui
 * server (NIP sudah dipakai, misalnya) tetap tampil di tempat yang benar.
 */
export function dialogFormulir({
  judul,
  keterangan = '',
  kolom,
  nilai = {},
  tombolKirim = 'Simpan',
  kirim,
}) {
  const d = document.createElement('dialog');
  d.className = 'kaca-tebal m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[1.5rem] p-6 text-ink';

  const baris = kolom
    .map((k, i) => satuKolom(k, nilai[k.nama] ?? '', `f${i}-${k.nama}`))
    .join('');

  d.innerHTML = `
    <form novalidate>
      <h2 class="text-lg font-semibold tracking-tight text-ink">${esc(judul)}</h2>
      ${keterangan ? `<p class="mt-1 text-sm text-muted">${esc(keterangan)}</p>` : ''}

      <div data-galat role="alert" hidden
           class="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900">
        ${IKON_GALAT_FORM}
        <span data-galat-teks></span>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">${baris}</div>

      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" data-batal class="${KELAS_TOMBOL.batal}">Batal</button>
        <button type="submit" data-simpan class="${KELAS_TOMBOL.utama}">${esc(tombolKirim)}</button>
      </div>
    </form>`;

  document.body.appendChild(d);

  const form = d.querySelector('form');
  const tombolSimpan = d.querySelector('[data-simpan]');

  return new Promise((selesai) => {
    let sudah = false;
    const tutup = (hasil) => {
      if (sudah) return;
      sudah = true;
      if (d.open) d.close();
      d.remove(); // sekali pakai
      selesai(hasil);
    };

    d.querySelector('[data-batal]').addEventListener('click', () => tutup(false));

    // Esc menutup dialog tanpa lewat tombol. Ini hanya jalan cadangan:
    // penyelesaian normal selalu lewat tombol, bukan lewat event `close`.
    d.addEventListener(
      'close',
      () => {
        if (sudah) return;
        sudah = true;
        d.remove();
        selesai(false);
      },
      { once: true },
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      sembunyikanGalat(d);

      const isian = {};
      for (const k of kolom) isian[k.nama] = form.elements[k.nama].value.trim();

      // Dicek sendiri, bukan lewat `required`, supaya pesannya berbahasa
      // Indonesia dan tampil di kotak galat yang sama dengan pesan server.
      const kosong = kolom.find((k) => k.wajib && !isian[k.nama]);
      if (kosong) {
        tampilkanGalat(d, `${kosong.label} belum diisi.`);
        form.elements[kosong.nama].focus();
        return;
      }

      tombolSimpan.disabled = true;
      tombolSimpan.textContent = 'Menyimpan…';

      try {
        await kirim(isian);
        tutup(true);
      } catch (galat) {
        // Termasuk aturan yang cuma diketahui server. Dialognya sengaja tidak
        // ditutup: isian yang sudah diketik tidak boleh hilang gara-gara satu
        // kolom yang perlu diperbaiki.
        tampilkanGalat(d, galat.message);
        tombolSimpan.disabled = false;
        tombolSimpan.textContent = tombolKirim;
      }
    });

    d.showModal();
    form.elements[kolom[0].nama].focus();
  });
}
