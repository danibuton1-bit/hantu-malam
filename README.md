# Hantu Malam

Buat game horror multiplayer online bernama HANTU MALAM: MABAR HOROR

PENTING: JANGAN PAKAI EMOJI SAMA SEKALI. Semua karakter, logo, dan icon harus digambar dari kode SVG / Canvas, atau pakai gambar yang saya upload.

KARAKTER RESMI YANG WAJIB DIPAKAI (Jangan buat karakter baru, pakai desain ini):
1. RAKA - Cowok Pemburu: Hoodie hitam, celana hitam, bawa senter, muka serius, rambut coklat.
2. AISYAH - Cewek Pemburu 1: Hijab pink pastel, jaket pink, rok pink, bawa senter kuning, muka ceria.
3. ZAHRA - Cewek Pemburu 2: Hijab hitam elegan, hoodie hitam, muka berani, bawa senter putih.
4. NABILA - Cewek Pemburu 3: Hijab ungu lavender, jaket ungu muda, bawa senter, muka kalem.
5. HANTU ASAP - Musuh: Putih pucat transparan, mata hitam besar kosong, mulut hitam menganga, tangan panjang, kain bawah bergelombang seperti asap, melayang, bukan emoji.
6. NPC TAMBAHAN: Kuntilanak rambut panjang hitam, Pocong putih melompat, berkeliaran di map sebagai jebakan.

LOGO GAME: Pakai logo "HANTU MALAM" dengan 4 pemburu di depan dan Hantu Asap besar di belakang, background rumah hantu gelap. Jadikan logo ini sebagai loading screen dan icon di menu utama.

SISTEM AKUN ID CARD AI - TANPA EMAIL (FITUR UTAMA, WAJIB ADA):
- Tidak ada login email / password / Google. Hanya pakai ID CARD.
- Halaman pertama ada 2 tombol besar: [DAFTAR AKUN BARU] dan [LOGIN PAKAI ID CARD]
- DAFTAR AKUN BARU:
  Form hanya 2 kolom:
  Nama:
  Tanggal Lahir:
  Tombol: [GENERATE AKUN]
  Setelah klik, AI otomatis buatkan:
    - Username unik contoh: RAKA_4821
    - Kode ID 6 digit contoh: HM-8821
    - ID CARD digital bergambar: Foto avatar karakter yang dipilih, Nama, Tanggal Lahir, Username, Kode ID, QR Code, dan tulisan HANTU MALAM OFFICIAL ID
    - ID Card ini bisa di-Download sebagai gambar PNG dan bisa di-Screenshot.
    - Simpan data akun ke Supabase tabel: profiles (id, nama, tanggal_lahir, username, kode_id, karakter_pilihan, created_at)
    - Setelah ID Card muncul, ada tombol [MASUK KE GAME] dan pemain langsung terhubung, tidak perlu login lagi.
- LOGIN PAKAI ID CARD:
    - Pemain tinggal upload foto ID Card-nya ATAU ketik Kode ID (HM-XXXX) + Nama, lalu klik MASUK.
    - Sistem cek ke Supabase, kalau cocok langsung masuk ke lobby, data nama dan karakternya ke-load otomatis.
    - Simpan login di localStorage, jadi kalau buka lagi game, langsung masuk tanpa login ulang, kecuali klik Logout.

SISTEM PILIH KARAKTER:
- Setelah daftar, pemain pilih 1 dari 4 karakter pemburu: RAKA, AISYAH, ZAHRA, NABILA. Karakter yang dipilih tersimpan di akunnya dan tampil di ID Card.
- Di dalam game, semua pemain tampil dengan karakter sesuai pilihan mereka.

KONSEP GAME:
- 1 orang jadi HANTU, 3 orang jadi PEMBURU.
- Pemburu harus cari 5 kunci dan kabur dari rumah tua sebelum waktu habis 5 menit.
- Hantu harus tangkap semua pemburu sebelum mereka kabur.
- Map: Rumah tua 2D top-down view, 6 ruangan: Ruang Tamu, Dapur, Kamar Mandi, Gudang, Lorong, Kuburan Belakang. Gelap, hanya ada cahaya senter bulat di sekitar pemain.

FITUR MULTIPLAYER ONLINE REAL-TIME DENGAN SUPABASE:
- Tabel Supabase: rooms, players, game_state, profiles. Pakai Supabase Realtime untuk sinkronisasi posisi pemain setiap 100ms.
- Setelah login ID Card, langsung masuk ke Halaman Utama: Input Buat Room (dapat kode 4 huruf), atau Join Room pakai kode diganti dengan invite teman yang sedang online 
- Lobby: Tampilkan daftar pemain yang sudah join beserta avatar karakter dan nama dari ID Card mereka, tombol Start hanya untuk host. Minimal 2 pemain untuk mulai.
- In-game: Posisi semua pemain terlihat real-time, kalau pemburu tertangkap, layarnya jadi hitam putih dan jadi penonton.
- Tombol teriak "TOLONG!" yang munculkan tanda seru di atas kepala (pakai SVG, bukan emoji).

SUARA & EFEK SERAM:
- Pakai Web Audio API, jangan pakai file mp3 dari luar.
- Suara langkah kaki, pintu berderit, napas hantu, jantung berdetak kenceng kalau hantu dekat, teriakan saat tertangkap, musik latar horor pelan piano.
- Tombol Mute di pojok kanan atas.
- Efek layar: Vignette gelap, glitch / noise kalau hantu dekat, senter berkedip.

GAMEPLAY & UI:
- Joystick virtual untuk HP, WASD + Arrow untuk PC.
- Baterai senter bisa habis, harus cari baterai di map.
- Notifikasi "Kamu dapat Kunci Dapur!" kalau dapat kunci.
- Layar menang "KAMU BERHASIL KABUR!" kalau kalah "HANTU MENANG..."
- Desain HP-first, gelap, warna utama hitam, merah darah, ungu gelap. Font seram.
- Tampilkan di atas: Sisa Waktu, Jumlah Kunci (0/5), Daftar Pemain Hidup.
- Di pojok profil, tampilkan foto mini ID Card pemain dan tombol Lihat ID Card Saya.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hantu-malam.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9aa74d32-0ef4-41f9-88b6-f9849214ce2b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
