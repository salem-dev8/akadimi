require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const moment = require('moment');
const app = express();

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// الصفحة الرئيسية - إحصائيات مصغرة
app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
        total: students.length,
        unpaid: students.reduce((acc, s) => acc + (s.subjects?.filter(sub => !sub.paid).length || 0), 0),
        primary: students.filter(s => s.cycle === 'ابتدائي').length,
        middle: students.filter(s => s.cycle === 'متوسط').length,
        high: students.filter(s => s.cycle === 'ثانوي').length
    };
    res.render('index', { students, stats, page: 'home' });
});

// صفحة البروفيل الشخصي
app.get('/profile/:id', async (req, res) => {
    const doc = await db.collection('students').doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/');
    res.render('profile', { s: { id: doc.id, ...doc.data() }, page: 'profile' });
});

// تحديث حالة الحصة أو الدفع
app.post('/update-sub-status/:id', async (req, res) => {
    const { subIndex, type, attIndex, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let { subjects } = doc.data();

    if (type === 'attendance') {
        subjects[subIndex].attendance[attIndex] = (value === 'true');
    } else if (type === 'paid') {
        subjects[subIndex].paid = (value === 'true');
    }

    await docRef.update({ subjects });
    res.json({ success: true });
});

// فتح شهر جديد (تصفير)
app.post('/reset-month/:id', async (req, res) => {
    const { subIndex } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let { subjects } = doc.data();

    subjects[subIndex].attendance = subjects[subIndex].attendance.fill(false);
    subjects[subIndex].paid = false;

    await docRef.update({ subjects });
    res.json({ success: true });
});

app.post('/add-student', async (req, res) => {
    const { name, cycle, year, subjects } = req.body;
    const subjectsList = Array.isArray(subjects) ? subjects : (subjects ? [subjects] : []);
    const subjectsData = subjectsList.map(s => ({
        name: s, sessionsCount: 4, attendance: [false, false, false, false], paid: false
    }));
    await db.collection('students').add({
        name, cycle, year, subjects: subjectsData, createdAt: new Date().toISOString()
    });
    res.redirect('/');
});

app.listen(3000, () => console.log('Maali System Pro Running...'));
