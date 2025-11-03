const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = 3000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
        console.log("'uploads' klasörü başarıyla oluşturuldu.");
    } catch (err) {
        console.error("'uploads' klasörü oluşturulurken hata:", err);
    }
}

const MONGO_URI = 'mongodb+srv://ozkalkaan490_db_user:G1xEB0KJNTzJKySf@kaan.acpeeot.mongodb.net/basvuruDB?retryWrites=true&w=majority&appName=KAAN';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB bağlantısı başarılı.'))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));


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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public'))); 
app.use('/uploads', express.static(uploadsDir)); 

app.use(session({
    secret: 'cok-gizli-bir-anahtar-buraya-yazin', 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI, 
        collectionName: 'sessions' 
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));


const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password123'; 

function requireLogin(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        next(); 
    } else {
        res.redirect('/login'); 
    }
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage }).fields([
    { name: 'cv', maxCount: 1 }, { name: 'fotograf', maxCount: 1 },
    { name: 'pasaport', maxCount: 1 }, { name: 'kimlikKarti', maxCount: 1 },
    { name: 'surucuBelgesi', maxCount: 1 }, { name: 'diplomaTranskript', maxCount: 1 },
    { name: 'mezuniyetBelgesi', maxCount: 1 }, { name: 'meslekiYeterlilik', maxCount: 1 },
    { name: 'sgkHizmetCetveli', maxCount: 1 }, { name: 'adliSicil', maxCount: 1 },
    { name: 'nufusKayit', maxCount: 1 }, { name: 'formulA', maxCount: 1 },
    { name: 'formulB', maxCount: 1 }, { name: 'muhtelifBelgeler', maxCount: 1 },
    { name: 'hukukiBelgeler', maxCount: 1 }, { name: 'almancaAdliSicil', maxCount: 1 }
]);

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
        res.render('admin', { applications: applications }); 
    } catch (error) {
        res.status(500).send('Admin paneli yüklenirken hata oluştu.');
    }
});


app.post('/submit', upload, async (req, res) => {
    try {
        const { 
            name, email, adres, message, 
            dogumTarihi, cinsiyet, telefon, gozRengi, boy, kilo,
            profession, egitim 
        } = req.body;


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

        const cvFile = getFileData('cv');
        const fotografFile = getFileData('fotograf');
        const pasaportFile = getFileData('pasaport');
        const kimlikKartiFile = getFileData('kimlikKarti');
        const surucuBelgesiFile = getFileData('surucuBelgesi');
        const diplomaTranskriptFile = getFileData('diplomaTranskript');
        const mezuniyetBelgesiFile = getFileData('mezuniyetBelgesi');
        const meslekiYeterlilikFile = getFileData('meslekiYeterlilik');
        const sgkHizmetCetveliFile = getFileData('sgkHizmetCetveli');
        const adliSicilFile = getFileData('adliSicil');
        const nufusKayitFile = getFileData('nufusKayit');
        const formulAFile = getFileData('formulA');
        const formulBFile = getFileData('formulB');
        const muhtelifBelgelerFile = getFileData('muhtelifBelgeler');
        const hukukiBelgelerFile = getFileData('hukukiBelgeler');
        const almancaAdliSicilFile = getFileData('almancaAdliSicil');

        const newApplication = new Application({
            name, email, adres, message,
            dogumTarihi, cinsiyet, telefon, gozRengi, boy, kilo,
            profession, egitim,
            cvPath: cvFile.path, cvOriginalName: cvFile.originalName,
            fotografPath: fotografFile.path, fotografOriginalName: fotografFile.originalName,
            pasaportPath: pasaportFile.path, pasaportOriginalName: pasaportFile.originalName,
            kimlikKartiPath: kimlikKartiFile.path, kimlikKartiOriginalName: kimlikKartiFile.originalName,
            surucuBelgesiPath: surucuBelgesiFile.path, surucuBelgesiOriginalName: surucuBelgesiFile.originalName,
            diplomaTranskriptPath: diplomaTranskriptFile.path, diplomaTranskriptOriginalName: diplomaTranskriptFile.originalName,
            mezuniyetBelgesiPath: mezuniyetBelgesiFile.path, mezuniyetBelgesiOriginalName: mezuniyetBelgesiFile.originalName,
            meslekiYeterlilikPath: meslekiYeterlilikFile.path, meslekiYeterlilikOriginalName: meslekiYeterlilikFile.originalName,
            sgkHizmetCetveliPath: sgkHizmetCetveliFile.path, sgkHizmetCetveliOriginalName: sgkHizmetCetveliFile.originalName,
            adliSicilPath: adliSicilFile.path, adliSicilOriginalName: adliSicilFile.originalName,
            nufusKayitPath: nufusKayitFile.path, nufusKayitOriginalName: nufusKayitFile.originalName,
            formulAPath: formulAFile.path, formulAOriginalName: formulAFile.originalName,
            formulBPath: formulBFile.path, formulBOriginalName: formulBFile.originalName,
            muhtelifBelgelerPath: muhtelifBelgelerFile.path, muhtelifBelgelerOriginalName: muhtelifBelgelerFile.originalName,
            hukukiBelgelerPath: hukukiBelgelerFile.path, hukukiBelgelerOriginalName: hukukiBelgelerFile.originalName,
            almancaAdliSicilPath: almancaAdliSicilFile.path, almancaAdliSicilOriginalName: almancaAdliSicilFile.originalName
        });

        await newApplication.save();
        res.render('success');

    } catch (error) {
        console.error('Form kaydetme hatası:', error);
        if (error instanceof multer.MulterError) {
            res.status(500).send('Dosya yüklenirken bir hata oluştu: ' + error.message);
        } else {
            res.status(500).send('Başvuru kaydedilirken bir sunucu hatası oluştu.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    console.log(`Admin Paneli (Giriş): http://localhost:${PORT}/login`);
});