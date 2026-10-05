# Panduan Integrasi Google Spreadsheet Otomatis (Google Apps Script)

Website **Kethai.co** sudah dirancang dengan fitur **Dual-Action Checkout**:
1. Setiap pesanan pelanggan otomatis tercatat ke **Google Spreadsheet** harian (seperti formulir Google Form otomatis).
2. Sekaligus mengarahkan pelanggan ke **WhatsApp** dengan rincian varian ketan susu, topping pilihan, dan metode pembayaran yang siap kirim.

---

## Langkah Setup Google Spreadsheet (Hanya 3 Menit)

### Langkah 1: Struktur Spreadsheet & Dashboard Rekap

Karena tabel transaksi dimulai dari baris ke-4 (**B4:K4**), manfaatkan **Baris 1–3** di bagian atas sebagai **Mini Dashboard Rekap Otomatis** (tidak akan tertimpa saat ada pesanan baru bertambah ke bawah):

#### A. Mini Dashboard (Baris 1 - 3)
| Range Sel | Label / Kartu | Rumus Google Sheets |
| :--- | :--- | :--- |
| **B2:C2** | 💰 Total Omset | `=SUM(J5:J)` *(Format: Rupiah)* |
| **E2:F2** | 📦 Total Transaksi | `=COUNTA(B5:B)` |
| **H2** | 📱 Omset QRIS | `=SUMIF(L5:L; "*QRIS*"; M5:M)` |
| **J2** | 💵 Omset Tunai | `=SUMIF(L5:L; "*Tunai*"; M5:M)` |

#### B. Header Tabel Transaksi (Baris 4)
- **A4**: `No`
- **B4**: `ID Pesanan`
- **C4**: `Tanggal`
- **D4**: `Jam`
- **E4**: `Nama Pemesan`
- **F4**: `Nomor WhatsApp` *(Privat - Khusus Admin)*
- **G4**: `Lokasi / Kampus`
- **H4**: `Jurusan`
- **I4**: `Alamat Lengkap / Catatan Lokasi`
- **J4**: `Rincian Menu & Topping`
- **K4**: `Admin Bertugas`
- **L4**: `Metode Pembayaran`
- **M4**: `Total Harga (Rp)`
- **N4**: `Catatan Khusus`
- **O4**: `Status Info Pemesanan (Dropdown)` *(Bisa diubah langsung di spreadsheet, otomatis live di web!)*
- **P4**: `Bukti QRIS / Foto Transfer` *(Foto otomatis muncul di sel & tersimpan di Google Drive!)*

> **Tips Membuat Dropdown Status di Spreadsheet (Hanya 1 Menit):**
> 1. Blok kolom **O** dari **O5 sampai ke bawah**.
> 2. Klik kanan > pilih **Dropdown (Validasi data)**.
> 3. Masukkan 4 opsi sesi status pemesanan:
>    - 🟡 `Pesanan Berhasil Masuk` (Pilih warna kuning/amber)
>    - 🔵 `Pesanan Sedang Dibuat` (Pilih warna biru)
>    - 🟢 `Pesanan Sudah Selesai Dibuat` (Pilih warna hijau)
>    - 🟣 `Pesanan Akan Dikirim` (Pilih warna ungu)
> 4. Klik **Selesai (Done)**. Sekarang setiap kali ada pesanan masuk atau kamu ubah statusnya di Spreadsheet, website rekap online akan **otomatis menampilkan status yang sama secara real-time**!

---

### Langkah 2: Kode Apps Script Presisi (Dua Arah: Simpan Order & Live Status Sync)
1. Di Google Sheets kamu, klik menu **Ekstensi (Extensions)** > **Apps Script**.
2. Hapus semua isi kode default yang ada, lalu tempel (*paste*) kode lengkap berikut:

```javascript
// ==============================================================================
// 1. FUNGSI AKTIVASI IZIN GOOGLE DRIVE (JALANKAN SEKALI SAJA)
// ==============================================================================
function tesIzinGoogleDrive() {
  var folderId = "1zuasuWSnECB9XjzI5yII9tj83GyDIwB_";
  var folder = DriveApp.getFolderById(folderId);
  var testFile = folder.createFile("tes_koneksi.txt", "Koneksi Google Drive aktif!");
  testFile.setTrashed(true); // Otomatis hapus file test
  Logger.log("✅ SUKSES! Izin aktif & terhubung ke folder: " + folder.getName());
}

// ==============================================================================
// 2. FUNGSI MENERIMA PESANAN BARU / HAPUS (doPost)
// ==============================================================================
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Fitur Hapus Riwayat Uji Coba dari Web
    if (data.action === "clearOrders") {
      var lastRow = sheet.getLastRow();
      if (lastRow >= 5) {
        sheet.deleteRows(5, lastRow - 4);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Riwayat pesanan berhasil dibersihkan dari spreadsheet."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Cari baris terakhir di tabel (mulai dari baris ke-4 sebagai header)
    var lastRow = sheet.getLastRow();
    if (lastRow < 4) {
      lastRow = 4;
    }
    var nextRow = lastRow + 1;
    var noUrut = nextRow - 4; // Baris 5 = No 1, Baris 6 = No 2, dst.
    
    // 1. Simpan Foto Bukti Pembayaran QRIS ke Folder Google Drive Khusus
    var FOLDER_ID = "1zuasuWSnECB9XjzI5yII9tj83GyDIwB_";
    var driveUrl = "";
    var fileId = "";
    var proofTextFallback = "-";
    
    if (data.proofImage && data.proofImage.indexOf("base64,") !== -1) {
      try {
        var base64Data = data.proofImage.split("base64,")[1];
        var decodedBytes = Utilities.base64Decode(base64Data);
        var cleanCustName = (data.customerName || "Pelanggan").replace(/[^a-zA-Z0-9]/g, "_");
        var fileName = "Bukti_QRIS_" + (data.id || ("KTC-" + Date.now())) + "_" + cleanCustName + ".jpg";
        var blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
        
        // Simpan langsung ke dalam folder khusus yang ditentukan
        var targetFolder = DriveApp.getFolderById(FOLDER_ID);
        var driveFile = targetFolder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        driveUrl = driveFile.getUrl();
        fileId = driveFile.getId();
      } catch (driveErr) {
        proofTextFallback = "⚠️ Gagal Simpan Drive: " + driveErr.message;
      }
    } else if (data.paymentMethod && data.paymentMethod.indexOf("Tunai") !== -1) {
      proofTextFallback = "💵 Bayar Tunai (COD)";
    }
    
    // Sesi awal: "Pesanan Berhasil Masuk"
    var initialStatus = data.orderStatus || "Pesanan Berhasil Masuk";
    
    // 2. Masukkan data teks/angka ke Kolom A sampai O (15 Kolom)
    sheet.getRange(nextRow, 1, 1, 15).setValues([[
      noUrut,                                     // A: No
      data.id,                                    // B: ID Pesanan
      data.date,                                  // C: Tanggal
      data.time,                                  // D: Jam
      data.customerName,                          // E: Nama Pemesan
      data.customerPhone || "-",                  // F: Nomor WhatsApp (Privat Admin)
      data.campus || "-",                         // G: Lokasi / Kampus
      data.major || "-",                          // H: Jurusan
      data.customerAddress || "-",                // I: Alamat Lengkap / Catatan Pengiriman
      data.itemsSummary,                          // J: Rincian Menu & Topping
      data.adminTarget || "Admin 1",              // K: Admin Bertugas
      data.paymentMethod,                         // L: Metode Pembayaran
      Number(data.totalAmount) || 0,              // M: Total Harga (Format Rupiah)
      data.customerNotes || "-",                  // N: Catatan Khusus
      initialStatus                               // O: Status Info Pemesanan (Dropdown)
    ]]);
    
    // 3. Masukkan Bukti QRIS ke Kolom P (Kolom ke-16) secara presisi
    var cellP = sheet.getRange(nextRow, 16);
    if (driveUrl && fileId) {
      var thumbUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400";
      cellP.setFormula('=IMAGE("' + thumbUrl + '")');
      cellP.setNote("📁 Buka Foto Asli Ukuran Penuh di Google Drive:\n" + driveUrl);
      sheet.setRowHeight(nextRow, 75); // Mengatur tinggi baris agar foto struk terlihat jelas
    } else {
      cellP.setValue(proofTextFallback);
    }
    
    // Format mata uang Rupiah untuk kolom M (Total Harga)
    sheet.getRange(nextRow, 13).setNumberFormat('"Rp"#,##0');
    // Rata tengah kolom Status (O) & Bukti (P)
    sheet.getRange(nextRow, 15, 1, 2).setHorizontalAlignment("center");
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", row: nextRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// 3. FUNGSI SINKRONISASI LIVE KE WEB (doGet - Real-time Status Sync & JSONP)
// ==============================================================================
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
    var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : "";
    
    // Fitur Hapus Riwayat Uji Coba dari Web (via GET request)
    if (action === "clearOrders") {
      var lastRow = sheet.getLastRow();
      if (lastRow >= 5) {
        sheet.deleteRows(5, lastRow - 4);
      }
      return outputResponse({
        status: "success",
        message: "Riwayat pesanan berhasil dibersihkan dari spreadsheet."
      }, callback);
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 5) {
      return outputResponse({
        status: "success",
        total: 0,
        orders: []
      }, callback);
    }
    
    // Deteksi Kolom Otomatis dari Baris Header ke-4 (Sangat Fleksibel & Anti-Error)
    var lastCol = sheet.getLastColumn();
    var headerRow = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
    
    var colMap = {
      no: 0,
      id: 1,
      date: 2,
      time: 3,
      customerName: 4,
      customerPhone: 5,
      campus: 6,
      major: 7,
      customerAddress: 8,
      itemsSummary: 9,
      adminTarget: 10,
      paymentMethod: 11,
      totalAmount: 12,
      customerNotes: 13,
      orderStatus: 14 // Default kolom O
    };
    
    for (var h = 0; h < headerRow.length; h++) {
      var hName = String(headerRow[h] || "").toLowerCase().trim();
      if (hName.indexOf("status") !== -1 || hName.indexOf("sesi") !== -1 || hName.indexOf("info pemesanan") !== -1) {
        colMap.orderStatus = h;
      } else if (hName.indexOf("id") !== -1 || hName.indexOf("pesanan") !== -1) {
        colMap.id = h;
      } else if (hName.indexOf("tgl") !== -1 || hName.indexOf("tanggal") !== -1) {
        colMap.date = h;
      } else if (hName.indexOf("jam") !== -1 || hName.indexOf("waktu") !== -1) {
        colMap.time = h;
      } else if (hName.indexOf("nama") !== -1 || hName.indexOf("pemesan") !== -1) {
        colMap.customerName = h;
      } else if (hName.indexOf("wa") !== -1 || hName.indexOf("whatsapp") !== -1 || hName.indexOf("hp") !== -1 || hName.indexOf("telepon") !== -1) {
        colMap.customerPhone = h;
      } else if (hName.indexOf("menu") !== -1 || hName.indexOf("topping") !== -1 || hName.indexOf("rincian") !== -1) {
        colMap.itemsSummary = h;
      } else if (hName.indexOf("total") !== -1 || hName.indexOf("harga") !== -1) {
        colMap.totalAmount = h;
      } else if (hName.indexOf("metode") !== -1 || hName.indexOf("bayar") !== -1) {
        colMap.paymentMethod = h;
      } else if (hName.indexOf("admin") !== -1) {
        colMap.adminTarget = h;
      } else if (hName.indexOf("alamat") !== -1 || hName.indexOf("lokasi") !== -1) {
        colMap.customerAddress = h;
      }
    }
    
    var numRows = lastRow - 4;
    var values = sheet.getRange(5, 1, numRows, lastCol).getValues();
    var orders = [];
    
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var orderId = String(row[colMap.id] || ("KTC-" + (i + 1))).trim();
      if (!orderId && !row[colMap.customerName]) continue;
      
      // Ambil status info pemesanan (dari kolom terdeteksi, atau fallback ke kolom O / N)
      var currentStatus = "";
      if (colMap.orderStatus !== undefined && row[colMap.orderStatus]) {
        currentStatus = String(row[colMap.orderStatus]).trim();
      }
      if (!currentStatus) {
        currentStatus = String(row[14] || row[13] || "Pesanan Berhasil Masuk").trim();
      }
      
      orders.push({
        no: row[colMap.no] || (i + 1),
        id: orderId,
        date: String(row[colMap.date] || ""),
        time: String(row[colMap.time] || ""),
        customerName: String(row[colMap.customerName] || ""),
        customerPhone: String(row[colMap.customerPhone] || "-"),
        campus: String(row[colMap.campus] || "-"),
        major: String(row[colMap.major] || "-"),
        customerAddress: String(row[colMap.customerAddress] || "-"),
        itemsSummary: String(row[colMap.itemsSummary] || ""),
        adminTarget: String(row[colMap.adminTarget] || ""),
        paymentMethod: String(row[colMap.paymentMethod] || ""),
        totalAmount: Number(row[colMap.totalAmount] || 0),
        customerNotes: String(row[colMap.customerNotes] || "-"),
        orderStatus: currentStatus // Live Status Otomatis dari Dropdown Spreadsheet!
      });
    }
    
    return outputResponse({
      status: "success",
      total: orders.length,
      orders: orders
    }, callback);
  } catch (err) {
    return outputResponse({
      status: "error",
      message: err.toString()
    }, callback);
  }
}

// Helper untuk Output JSON atau JSONP (Anti-CORS 100%)
function outputResponse(obj, callback) {
  var str = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + str + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(str)
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### Langkah 3: Berikan Izin Akses Google Drive (Sangat Penting! Wajib Dilakukan)
Karena script ini bertugas menyimpan foto ke Google Drive kamu secara otomatis, Google mewajibkan konfirmasi izin sekali saja:

1. Di menu bar atas Apps Script, perhatikan dropdown fungsi di sebelah tombol **Run (Jalankan)** / ikon play `▶`.
2. Ubah pilihan dropdown dari `doPost` menjadi **`tesIzinGoogleDrive`**.
3. Klik tombol **Run (Jalankan)** `▶`.
4. Muncul jendela popup **Authorization required (Otorisasi diperlukan)**:
   - Klik **Review permissions (Tinjau izin)**.
   - Pilih akun Google milikmu.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced (Lanjutan)** di kiri bawah.
   - Klik **Go to Untitled project (Buka project)**.
   - Klik tombol biru **Allow (Izinkan)**.
5. Di bagian Execution log bawah akan muncul: `✅ SUKSES! Izin Google Drive & Spreadsheet sudah aktif.`

---

### Langkah 4: Terapkan / Update Web App (Deploy Versi Baru - Wajib Dilakukan!)
> **PENTING: Kenapa status yang diubah di Spreadsheet belum berubah di Web?**
> Di Google Apps Script, menekan tombol Save (Ctrl+S) saja **TIDAK AKAN** mengubah respon Webhook live. Google mewajibkan kamu membuat **"Versi Baru" (New version)** dan memastikan izin diatur ke **"Siapa saja" (Anyone)** agar script baru mulai aktif:

1. Di pojok kanan atas Apps Script, klik tombol biru **Deploy (Terapkan)** > **Manage deployments (Kelola penerapan)**.
2. Klik ikon **Pensil (Edit)** di kanan atas kartu Web app.
3. Di dropdown **Version (Versi)**, klik dan pilih **New version (Versi baru)**.
4. Pastikan 2 pengaturan ini tepat:
   - **Execute as (Jalankan sebagai):** `Me (email kamu)`
   - **Who has access (Siapa yang memiliki akses):** `Anyone (Siapa saja)` *(Wajib Anyone agar web bisa membaca status secara langsung tanpa login Google).*
5. Klik tombol biru **Deploy (Terapkan)**.
6. Klik **Done (Selesai)**. *(URL Webhook kamu tetap sama, tidak berubah).*

---

### Langkah 5: Tempel URL ke Website
Buka file [app.js](file:///c:/Users/Navii/Documents/Coding/Kewirausahaan/app.js) di bagian state:
```javascript
sheetsEndpointURL: 'TEMPEL_URL_GOOGLE_APPS_SCRIPT_KAMU_DI_SINI'
```
Simpan file [app.js](file:///c:/Users/Navii/Documents/Coding/Kewirausahaan/app.js). **Selesai!** 

---

## Fitur Cadangan (Tanpa Google Sheets pun Tetap Aman!)
Bahkan jika kamu belum sempat memasang Google Sheets:
- Semua pesanan **tetap otomatis tersimpan di browser** (Database Lokal).
- Kamu bisa mengklik tombol **"Lihat Rekap Spreadsheet Pesanan"** di footer website kapan saja.
- Terdapat tombol **"Download CSV / Excel"** untuk langsung mendownload rekap pesanan harian Kethai.co ke laptop kamu!
