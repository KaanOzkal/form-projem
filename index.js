const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { google } = require('googleapis');
const session = require('express-session');
const MongoStore = require('connect-mongo');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password123';

// 2. MongoDB Bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
    .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// 3. MongoDB Şeması
const ApplicationSchema = new mongoose.Schema({
    // Kişisel Bilgiler (Aynı Kalır)
    name: { type: String, required: true },
    email: { type: String, required: true },
    telefon: String, cinsiyet: String, dogumTarihi: Date, gozRengi: String, boy: String, kilo: String, adres: String,
    // Meslek ve Eğitim (Aynı Kalır)
    profession: String, egitim: Object,
    // Ek Notlar (Aynı Kalır)
    message: String,
    // Dosya Bilgileri (Aynı Kalır)
    cvPath: String, cvOriginalName: String, fotografPath: String, fotografOriginalName: String, pasaportPath: String, pasaportOriginalName: String, kimlikKartiPath: String, kimlikKartiOriginalName: String, surucuBelgesiPath: String, surucuBelgesiOriginalName: String, diplomaTranskriptPath: String, diplomaTranskriptOriginalName: String, mezuniyetBelgesiPath: String, mezuniyetBelgesiOriginalName: String, meslekiYeterlilikPath: String, meslekiYeterlilikOriginalName: String, muhtelifBelgelerPath: String, muhtelifBelgelerOriginalName: String, sgkHizmetCetveliPath: String, sgkHizmetCetveliOriginalName: String, adliSicilPath: String, adliSicilOriginalName: String, almancaAdliSicilPath: String, almancaAdliSicilOriginalName: String, nufusKayitPath: String, nufusKayitOriginalName: String, formulAPath: String, formulAOriginalName: String, formulBPath: String, formulBOriginalName: String, hukukiBelgelerPath: String, hukukiBelgelerOriginalName: String,
    raporPath: String, 
}, { timestamps: true });

const Application = mongoose.model('Application', ApplicationSchema);

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

const upload = multer({ dest: 'uploads/' });
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
 * @param {string} 
 * @param {string} 
 * @param {string} 
 * @returns {Promise<string>} 
 */
async function uploadFileToDrive(filePath, fileName, mimeType) {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: mimeType,
                parents: [process.env.DRIVE_FOLDER_ID],
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

function generateReportFile(data, applicantName) {
    const tempFileName = `${Date.now()}-${applicantName}-BILGI_RAPORU.txt`;
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





app.get('/', (req, res) => {
    res.render('form');
});

app.get('/login', (req, res) => {

    res.render('login', { error: req.query.error ? req.query.error : null });
});

// YENİ: Giriş İşleme Rotası
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Başarılı giriş
        req.session.isLoggedIn = true;
        res.redirect('/admin');
    } else {
   
        res.render('login', { error: 'Geçersiz kullanıcı adı veya şifre.' });
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.redirect('/admin');
        }
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


app.post('/submit', upload.fields(fileFields), async (req, res) => {
    const { body, files } = req;
    const uploadedFilesData = {};
    const localFilePaths = []; 
    const applicantName = body.name ? body.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') : 'Bilinmeyen_Aday';

    try {
        const report = generateReportFile(body, applicantName);
        localFilePaths.push(report.filePath);

        const reportLink = await uploadFileToDrive(
            report.filePath,
            `${applicantName} - BASVURU_RAPORU.txt`,
            'text/plain'
        );

        if (reportLink) {
            uploadedFilesData.raporPath = reportLink;
        }

        for (const field of fileFields) {
            const fieldName = field.name;
            const fileArray = files[fieldName];

            if (fileArray && fileArray.length > 0) {
                const file = fileArray[0];
                
                const newFileName = `${applicantName} - ${file.originalname}`;
                
                const link = await uploadFileToDrive(file.path, newFileName, file.mimetype);
                
                uploadedFilesData[`${fieldName}Path`] = link;
                uploadedFilesData[`${fieldName}OriginalName`] = newFileName;
                localFilePaths.push(file.path);
            }
        }

        const newApplication = new Application({
            ...body,
            ...uploadedFilesData
        });

        await newApplication.save();

        res.send('✅ Başvurunuz başarıyla alındı. Belgeler ve Rapor Google Drive\'a yüklendi. <a href="/">Yeni Başvuru</a>');
        
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