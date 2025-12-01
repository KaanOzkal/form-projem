const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { google } = require('googleapis');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// 1. Ortam Değişkenlerini Yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Admin Kullanıcı Bilgileri
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password123';
const MAIN_DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Ana Klasör ID'si

// 2. MongoDB Bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
    .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// 3. MongoDB Şeması (Aynı Kalır)
const ApplicationSchema = new mongoose.Schema({
    // Kişisel Bilgiler (Aynı Kalır)
    name: { type: String, required: true }, email: { type: String, required: true }, telefon: String, cinsiyet: String, dogumTarihi: Date, gozRengi: String, boy: String, kilo: String, adres: String, profession: String, egitim: Object, message: String,
    // Dosya Bilgileri (Aynı Kalır)
    cvPath: String, cvOriginalName: String, fotografPath: String, fotografOriginalName: String, pasaportPath: String, pasaportOriginalName: String, kimlikKartiPath: String, kimlikKartiOriginalName: String, surucuBelgesiPath: String, surucuBelgesiOriginalName: String, diplomaTranskriptPath: String, diplomaTranskriptOriginalName: String, mezuniyetBelgesiPath: String, mezuniyetBelgesiOriginalName: String, meslekiYeterlilikPath: String, meslekiYeterlilikOriginalName: String, muhtelifBelgelerPath: String, muhtelifBelgelerOriginalName: String, sgkHizmetCetveliPath: String, sgkHizmetCetveliOriginalName: String, adliSicilPath: String, adliSicilOriginalName: String, almancaAdliSicilPath: String, almancaAdliSicilOriginalName: String, nufusKayitPath: String, nufusKayitOriginalName: String, formulAPath: String, formulAOriginalName: String, formulBPath: String, formulBOriginalName: String, hukukiBelgelerPath: String, hukukiBelgelerOriginalName: String,
    raporPath: String,
}, { timestamps: true });

const Application = mongoose.model('Application', ApplicationSchema);

// 4. Express, Session ve Middleware Ayarları (Aynı Kalır)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'cok-gizli-bir-anahtar',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireLogin(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/login');
}

// 5. Multer ve File Fields (Aynı Kalır)
const upload = multer({ dest: 'uploads/' });
const fileFields = [
    { name: 'cv', maxCount: 1 }, { name: 'fotograf', maxCount: 1 }, { name: 'pasaport', maxCount: 1 }, { name: 'kimlikKarti', maxCount: 1 }, { name: 'surucuBelgesi', maxCount: 1 }, { name: 'diplomaTranskript', maxCount: 1 }, { name: 'mezuniyetBelgesi', maxCount: 1 }, { name: 'meslekiYeterlilik', maxCount: 1 }, { name: 'muhtelifBelgeler', maxCount: 1 }, { name: 'sgkHizmetCetveli', maxCount: 1 }, { name: 'adliSicil', maxCount: 1 }, { name: 'almancaAdliSicil', maxCount: 1 }, { name: 'nufusKayit', maxCount: 1 }, { name: 'formulA', maxCount: 1 }, { name: 'formulB', maxCount: 1 }, { name: 'hukukiBelgeler', maxCount: 1 },
];

// 6. Google Drive API Yapılandırması (Aynı Kalır)
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

// YENİ FONKSİYON: Türkçe karakterleri İngilizce eşdeğerlerine çevirir ve büyük harf yapar.
function generateDriveSafeName(text) {
    if (!text) return 'BILINMEYEN_ADAY';
    let safeName = text.trim();

    // 1. Türkçe karakterleri dönüştürme (küçük harfe çevirip dönüştürme daha güvenlidir)
    safeName = safeName.toLowerCase();
    safeName = safeName.replace(/ç/g, 'c');
    safeName = safeName.replace(/ğ/g, 'g');
    safeName = safeName.replace(/ı/g, 'i');
    safeName = safeName.replace(/ö/g, 'o');
    safeName = safeName.replace(/ş/g, 's');
    safeName = safeName.replace(/ü/g, 'u');
    
    // 2. Büyük harfe çevirme
    safeName = safeName.toUpperCase();

    // 3. Boşlukları alt çizgiye çevirme ve dosya sistemi için güvenli hale getirme
    safeName = safeName.replace(/[^\w\s-]/g, ''); // Harf, rakam, boşluk, tire dışındakileri sil
    safeName = safeName.replace(/\s+/g, '_'); // Birden fazla boşluğu tek alt çizgiye çevir

    return safeName;
}


/**
 * Drive'da yeni bir klasör oluşturur.
 * @param {string} folderName - Oluşturulacak klasörün adı (Büyük harfli ve güvenli isim).
 * @returns {Promise<string>} Oluşturulan klasörün ID'si.
 */
async function createFolderInDrive(folderName) {
    try {
        const fileMetadata = {
            'name': folderName,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [MAIN_DRIVE_FOLDER_ID] 
        };
        const response = await drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        console.log(`✅ Drive Klasörü Oluşturuldu: ${folderName}`);
        return response.data.id;
    } catch (error) {
        console.error('❌ Drive Klasör Oluşturma Hatası:', error.message);
        throw error;
    }
}


/**
 * Dosyayı Drive'a yükler, artık dinamik parentFolderId kabul ediyor.
 */
async function uploadFileToDrive(filePath, fileName, mimeType, parentFolderId) {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: mimeType,
                parents: [parentFolderId],
            },
            media: {
                mimeType: mimeType,
                body: fs.createReadStream(filePath),
            },
            fields: 'id, webViewLink'
        });

        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return response.data.webViewLink;
    } catch (error) {
        console.error('❌ Drive Yükleme Hatası:', error.message);
        return null;
    }
}

// 7. Form verilerini bir rapora dönüştürür (Aynı Kalır)
function generateReportFile(data, applicantName) {
    const tempFileName = `${Date.now()}-${applicantName}-BILGI_RAPORU.txt`;
    const tempFilePath = path.join(__dirname, 'uploads', tempFileName);

    let content = `--- ADAY BAŞVURU BİLGİLERİ RAPORU ---\n\n`;
    content += `Başvuru Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
    content += `Aday Adı Soyadı: ${data.name || '-'}\n`;
    content += `E-posta: ${data.email || '-'}\n`;
    // ... (Diğer tüm veri alanları aynı kalır)

    fs.writeFileSync(tempFilePath, content, 'utf8');
    
    return { 
        filePath: tempFilePath,
        fileName: tempFileName
    };
}


// --- ROTLAR ---
app.get('/', (req, res) => { res.render('form'); });
app.get('/login', (req, res) => { res.render('login', { error: req.query.error ? req.query.error : null }); });
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.isLoggedIn = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Geçersiz kullanıcı adı veya şifre.' });
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { console.error(err); return res.redirect('/admin'); }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});
app.get('/admin', requireLogin, async (req, res) => {
    try {
        const applications = await Application.find().sort({ createdAt: -1 });
        res.render('admin', { applications });
    } catch (error) {
        console.error('❌ Admin paneli hatası:', error);
        res.status(500).send('Başvurular yüklenirken hata oluştu.');
    }
});


// Başvuru İşleme Rotası
app.post('/submit', upload.fields(fileFields), async (req, res) => {
    const { body, files } = req;
    const uploadedFilesData = {};
    const localFilePaths = []; 
    
    // YENİ: İsim soyisim alınıyor, dönüştürülüyor ve büyük harf yapılıyor (örn: KAAN_OZKAL)
    const applicantSafeName = generateDriveSafeName(body.name);
    // Klasör Adı: İSİM_SOYİSİM_TIMESTAMP
    const applicantFolderName = `${applicantSafeName}_${Date.now()}`;


    try {
        // 1. ADIM: Başvuranın Adına Özel Klasörü Oluştur
        const applicantFolderId = await createFolderInDrive(applicantFolderName);


        // 2. ADIM: OLUŞTURULAN BİLGİ RAPORUNU YÜKLEME
        const report = generateReportFile(body, applicantSafeName);
        localFilePaths.push(report.filePath);

        const reportLink = await uploadFileToDrive(
            report.filePath,
            `${applicantSafeName} - BASVURU_RAPORU.txt`,
            'text/plain',
            applicantFolderId
        );

        if (reportLink) {
            uploadedFilesData.raporPath = reportLink;
        }

        // 3. ADIM: TÜM DİĞER EKLENEN DOSYALARI YÜKLEME
        for (const field of fileFields) {
            const fieldName = field.name;
            const fileArray = files[fieldName];

            if (fileArray && fileArray.length > 0) {
                const file = fileArray[0];
                
                // Dosya Adı Ön Eki: İSİM_SOYİSİM - Orijinal Belge Adı
                const newFileName = `${applicantSafeName} - ${file.originalname}`;
                
                const link = await uploadFileToDrive(
                    file.path, 
                    newFileName, 
                    file.mimetype,
                    applicantFolderId // Yeni klasör ID'si kullanıldı
                );
                
                uploadedFilesData[`${fieldName}Path`] = link;
                uploadedFilesData[`${fieldName}OriginalName`] = newFileName;
                localFilePaths.push(file.path);
            }
        }

        // 4. ADIM: Başvuru Verilerini MongoDB'ye Kaydet
        const newApplication = new Application({
            ...body,
            ...uploadedFilesData
        });

        await newApplication.save();

        res.send('✅ Başvurunuz başarıyla alındı. <a href="/">Yeni Başvuru</a>');
        
    } catch (error) {
        console.error('❌ Başvuru veya Kayıt Hatası:', error);
        res.status(500).send('Başvuru sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {

        localFilePaths.forEach(filePath => {
            fs.unlink(filePath, (err) => {
                if (err) console.error('❗ Yerel dosya silinirken hata:', err);
            });
        });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});