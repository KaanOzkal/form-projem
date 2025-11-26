const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { google } = require('googleapis');

// 1. Ortam Değişkenlerini Yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 2. MongoDB Bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
    .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// 3. MongoDB Şeması (RAPOR ALANI EKLENDİ)
const ApplicationSchema = new mongoose.Schema({
    // Kişisel Bilgiler
    name: { type: String, required: true },
    email: { type: String, required: true },
    telefon: String,
    cinsiyet: String,
    dogumTarihi: Date,
    gozRengi: String,
    boy: String,
    kilo: String,
    adres: String,

    // Meslek ve Eğitim
    profession: String,
    egitim: Object,

    // Ek Notlar
    message: String,
    
    // Dosya Bilgileri (Google Drive Linkleri)
    cvPath: String, cvOriginalName: String,
    fotografPath: String, fotografOriginalName: String,
    pasaportPath: String, pasaportOriginalName: String,
    kimlikKartiPath: String, kimlikKartiOriginalName: String,
    surucuBelgesiPath: String, surucuBelgesiOriginalName: String,
    diplomaTranskriptPath: String, diplomaTranskriptOriginalName: String,
    mezuniyetBelgesiPath: String, mezuniyetBelgesiOriginalName: String,
    meslekiYeterlilikPath: String, meslekiYeterlilikOriginalName: String,
    muhtelifBelgelerPath: String, muhtelifBelgelerOriginalName: String,
    sgkHizmetCetveliPath: String, sgkHizmetCetveliOriginalName: String,
    adliSicilPath: String, adliSicilOriginalName: String,
    almancaAdliSicilPath: String, almancaAdliSicilOriginalName: String,
    nufusKayitPath: String, nufusKayitOriginalName: String,
    formulAPath: String, formulAOriginalName: String,
    formulBPath: String, formulBOriginalName: String,
    hukukiBelgelerPath: String, hukukiBelgelerOriginalName: String,

    raporPath: String, // 👈 YENİ: Oluşturulan rapor dosya yolu
    
}, { timestamps: true });

const Application = mongoose.model('Application', ApplicationSchema);

// 4. Express Ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// 5. Multer (Geçici Dosya Yükleme) Ayarları
const upload = multer({ dest: 'uploads/' });

// Tüm dosya alanlarının listesi
const fileFields = [
    { name: 'cv', maxCount: 1 }, { name: 'fotograf', maxCount: 1 },
    { name: 'pasaport', maxCount: 1 }, { name: 'kimlikKarti', maxCount: 1 },
    { name: 'surucuBelgesi', maxCount: 1 }, { name: 'diplomaTranskript', maxCount: 1 },
    { name: 'mezuniyetBelgesi', maxCount: 1 }, { name: 'meslekiYeterlilik', maxCount: 1 },
    { name: 'muhtelifBelgeler', maxCount: 1 }, { name: 'sgkHizmetCetveli', maxCount: 1 },
    { name: 'adliSicil', maxCount: 1 }, { name: 'almancaAdliSicil', maxCount: 1 },
    { name: 'nufusKayit', maxCount: 1 }, { name: 'formulA', maxCount: 1 },
    { name: 'formulB', maxCount: 1 }, { name: 'hukukiBelgeler', maxCount: 1 },
];

// 6. Google Drive API Yapılandırması
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
);

oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN
});

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
});

/**
 * Dosyayı Google Drive'a yükler ve herkese açık bir URL döndürür.
 * @param {string} filePath - Geçici dosya yolu.
 * @param {string} fileName - Orijinal dosya adı.
 * @param {string} mimeType - Dosya MIME tipi.
 * @returns {Promise<string>} Yüklenen dosyanın herkese açık linki.
 */
async function uploadFileToDrive(filePath, fileName, mimeType) {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: mimeType,
                parents: [process.env.DRIVE_FOLDER_ID], // Belirtilen klasör ID'si (DRIVE_FOLDER_ID değişkeni kullanılıyor)
            },
            media: {
                mimeType: mimeType,
                body: fs.createReadStream(filePath),
            },
            fields: 'id, webViewLink'
        });

        // Dosyayı herkesin erişimine aç
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return response.data.webViewLink; // Tarayıcıda görüntülenebilir link
    } catch (error) {
        console.error('❌ Drive Yükleme Hatası:', error.message);
        return null; 
    }
}

// 7. YENİ FONKSİYON: Form verilerini bir rapora dönüştürür
function generateReportFile(data, applicantName) {
    const tempFileName = `${Date.now()}-${applicantName}-BILGI_RAPORU.txt`; // .txt uzantısı kullandık
    const tempFilePath = path.join(__dirname, 'uploads', tempFileName);

    let content = `--- Aday Başvuru Bilgileri Raporu ---\n\n`;
    content += `Başvuru Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
    content += `Aday Adı Soyadı: ${data.name || '-'}\n`;
    content += `E-posta: ${data.email || '-'}\n`;
    content += `Telefon: ${data.telefon || '-'}\n`;
    content += `Doğum Tarihi: ${data.dogumTarihi || '-'}\n`;
    content += `Cinsiyet: ${data.cinsiyet || '-'}\n`;
    content += `Boy/Kilo: ${data.boy || '-'} / ${data.kilo || '-'}\n`;
    content += `Göz Rengi: ${data.gozRengi || '-'}\n`;
    content += `Adres: ${data.adres || '-'}\n`;
    content += `Meslek/Uzmanlık: ${data.profession || '-'}\n`;

    // Eğitim bilgilerini formatlama
    if (data.egitim) {
        content += `\n--- Eğitim Bilgileri ---\n`;
        for (const seviye in data.egitim) {
            if (data.egitim[seviye] && data.egitim[seviye].okul) {
                content += `${seviye.charAt(0).toUpperCase() + seviye.slice(1)}: ${data.egitim[seviye].okul} (${data.egitim[seviye].yil || 'Yıl Belirtilmemiş'})\n`;
            }
        }
    }
    
    content += `\n--- Ek Notlar ---\n`;
    content += `${data.message || 'Ek not bulunmamaktadır.'}\n`;

    fs.writeFileSync(tempFilePath, content, 'utf8');
    
    return { 
        filePath: tempFilePath,
        fileName: tempFileName
    };
}


// --- ROTLAR ---

// Ana Sayfa (Form)
app.get('/', (req, res) => {
    res.render('form');
});

// Başvuru İşleme Rotası
app.post('/submit', upload.fields(fileFields), async (req, res) => {
    const { body, files } = req;
    const uploadedFilesData = {};
    const localFilePaths = []; // Temizlenecek yerel dosyalar

    // İsim soyisim alınıyor ve dosya adı için temizleniyor
    const applicantName = body.name ? body.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') : 'Bilinmeyen_Aday';

    try {
        // 1. OLUŞTURULAN BİLGİ RAPORUNU YÜKLEME
        const report = generateReportFile(body, applicantName);
        localFilePaths.push(report.filePath); // Temizlenecekler listesine ekle

        const reportLink = await uploadFileToDrive(
            report.filePath,
            `${applicantName} - BASVURU_RAPORU.txt`, // Drive'a yüklenen dosya adı
            'text/plain'
        );

        if (reportLink) {
            uploadedFilesData.raporPath = reportLink;
        }

        // 2. TÜM DİĞER EKLENEN DOSYALARI YÜKLEME
        for (const field of fileFields) {
            const fieldName = field.name;
            const fileArray = files[fieldName];

            if (fileArray && fileArray.length > 0) {
                const file = fileArray[0];
                
                // YENİ DOSYA ADINI OLUŞTURMA: "Ad_Soyad - Orijinal Belge Adı"
                const newFileName = `${applicantName} - ${file.originalname}`;
                
                const link = await uploadFileToDrive(file.path, newFileName, file.mimetype);
                
                // Drive linki ve YENİ, formatlanmış adı kaydedilir
                uploadedFilesData[`${fieldName}Path`] = link;
                uploadedFilesData[`${fieldName}OriginalName`] = newFileName;
                localFilePaths.push(file.path);
            }
        }

        // 3. Başvuru Verilerini MongoDB'ye Kaydet
        const newApplication = new Application({
            ...body, // Tüm metin alanları
            ...uploadedFilesData // Drive dosya bilgileri
        });

        await newApplication.save();

        // 4. Başarılı yanıt
        res.send('✅ Başvurunuz başarıyla alındı. Belgeler ve Rapor Google Drive\'a yüklendi. <a href="/">Yeni Başvuru</a>');
        
    } catch (error) {
        console.error('❌ Başvuru veya Kayıt Hatası:', error);
        res.status(500).send('Başvuru sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        // 5. Geçici Yerel Dosyaları Sil
        localFilePaths.forEach(filePath => {
            fs.unlink(filePath, (err) => {
                if (err) console.error('❗ Yerel dosya silinirken hata:', err);
            });
        });
    }
});


// Yönetici Paneli Rotası
app.get('/admin', async (req, res) => {
    try {
        const applications = await Application.find().sort({ createdAt: -1 });
        res.render('admin', { applications });
    } catch (error) {
        console.error('❌ Admin paneli hatası:', error);
        res.status(500).send('Başvurular yüklenirken hata oluştu.');
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});