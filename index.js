const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config(); // .env dosyasını okumak için

const app = express();

// PORT Render'da otomatik atanır, yoksa 3000 kullan
const PORT = process.env.PORT || 3000;

// --- Uploads klasörünü oluştur ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
        console.log("'uploads' klasörü başarıyla oluşturuldu.");
    } catch (err) {
        console.error("'uploads' klasörü oluşturulurken hata:", err);
    }
}

// --- MongoDB bağlantısı ---
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
    .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));


// --- Mongoose Schema ---
const applicationSchema = new mongoose.Schema({
    name: String, email: String, adres: String, message: String,
    dogumTarihi: Date, cinsiyet: String, telefon: String, gozRengi: String, boy: String, kilo: String,
    profession: String,
    egitim: {
        ilkokul: { okul: String, yil: String }, ortaokul: { okul: String, yil: String },
        lise: { okul: String, yil: String }, onlisans: { okul: String, yil: String },
        lisans: { okul: String, yil: String }, doktora: { okul: String, yil: String }
    },
    cvPath: String, cvOriginalName: String,
    fotografPath: String, fotografOriginalName: String,
    pasaportPath: String, pasaportOriginalName: String,
    kimlikKartiPath: String, kimlikKartiOriginalName: String,
    surucuBelgesiPath: String, surucuBelgesiOriginalName: String,
    diplomaTranskriptPath: String, diplomaTranskriptOriginalName: String,
    mezuniyetBelgesiPath: String, mezuniyetBelgesiOriginalName: String,
    meslekiYeterlilikPath: String, meslekiYeterlilikOriginalName: String,
    sgkHizmetCetveliPath: String, sgkHizmetCetveliOriginalName: String,
    adliSicilPath: String, adliSicilOriginalName: String,
    nufusKayitPath: String, nufusKayitOriginalName: String,
    formulAPath: String, formulAOriginalName: String,
    formulBPath: String, formulBOriginalName: String,
    muhtelifBelgelerPath: String, muhtelifBelgelerOriginalName: String,
    hukukiBelgelerPath: String, hukukiBelgelerOriginalName: String,
    almancaAdliSicilPath: String, almancaAdliSicilOriginalName: String,
    createdAt: { type: Date, default: Date.now }
});
const Application = mongoose.model('Application', applicationSchema);

// --- EJS Ayarları ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// --- Session Ayarları ---
app.use(session({
    secret: 'cok-gizli-bir-anahtar-buraya-yazin',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions'
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// --- Admin bilgileri ---
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password123';

// --- Login kontrolü ---
function requireLogin(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

// --- Multer Ayarları ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage }).fields([
    { name: 'cv', maxCount: 1 }, { name: 'fotograf', maxCount: 1 },
    { name: 'pasaport', maxCount: 1 }, { name: 'kimlikKarti', maxCount: 1 },
    { name: 'surucuBelgesi', maxCount: 1 }, { name: 'diplomaTranskript', maxCount: 1 },
    { name: 'mezuniyetBelgesi', maxCount: 1 }, { name: 'meslekiYeterlilik', maxCount: 1 },
    { name: 'sgkHizmetCetveli', maxCount: 1 }, { name: 'adliSicil', maxCount: 1 },
    { name: 'nufusKayit', maxCount: 1 }, { name: 'formulA', maxCount: 1 },
    { name: 'formulB', maxCount: 1 }, { name: 'muhtelifBelgeler', maxCount: 1 },
    { name: 'hukukiBelgeler', maxCount: 1 }, { name: 'almancaAdliSicil', maxCount: 1 }
]);

// --- Rotalar ---
app.get('/', (req, res) => res.render('form'));
app.get('/login', (req, res) => res.render('login', { error: null }));

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
        if (err) return res.redirect('/admin');
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.get('/admin', requireLogin, async (req, res) => {
    try {
        const applications = await Application.find().sort({ createdAt: -1 });
        res.render('admin', { applications });
    } catch (error) {
        res.status(500).send('Admin paneli yüklenirken hata oluştu.');
    }
});

app.post('/submit', upload, async (req, res) => {
    try {
        const { name, email, adres, message, dogumTarihi, cinsiyet, telefon, gozRengi, boy, kilo, profession, egitim } = req.body;

        const getFileData = (fieldName) => {
            if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
                const relativePath = path.relative(__dirname, req.files[fieldName][0].path);
                return {
                    path: relativePath.replace(/\\/g, '/'),
                    originalName: req.files[fieldName][0].originalname
                };
            }
            return { path: null, originalName: null };
        };

        const fileFields = [
            'cv', 'fotograf', 'pasaport', 'kimlikKarti', 'surucuBelgesi', 'diplomaTranskript',
            'mezuniyetBelgesi', 'meslekiYeterlilik', 'sgkHizmetCetveli', 'adliSicil', 'nufusKayit',
            'formulA', 'formulB', 'muhtelifBelgeler', 'hukukiBelgeler', 'almancaAdliSicil'
        ];

        const newApplicationData = {
            name, email, adres, message, dogumTarihi, cinsiyet, telefon, gozRengi, boy, kilo, profession, egitim
        };

        fileFields.forEach(field => {
            const file = getFileData(field);
            newApplicationData[`${field}Path`] = file.path;
            newApplicationData[`${field}OriginalName`] = file.originalName;
        });

        const newApplication = new Application(newApplicationData);
        await newApplication.save();
        res.render('success');

    } catch (error) {
        console.error('Form kaydetme hatası:', error);
        res.status(500).send('Başvuru kaydedilirken bir sunucu hatası oluştu.');
    }
});

// --- Sunucu Başlat ---
app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    console.log(`🔐 Admin Paneli: http://localhost:${PORT}/login`);
});
