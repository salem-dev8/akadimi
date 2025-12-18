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

// الصفحة الرئيسية + حساب الإحصائيات الحقيقية
app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const cycleCounts = { 'ابتدائي': 0, 'متوسط': 0, 'ثانوي': 0 };
    let unpaidCount = 0;

    students.forEach(s => {
        if (cycleCounts[s.cycle] !== undefined) cycleCounts[s.cycle]++;
        if (s.subjects) {
            s.subjects.forEach(sub => { if (!sub.paid) unpaidCount++; });
        }
    });

    const stats = {
        total: students.length,
        cycleData: Object.values(cycleCounts),
        unpaid: unpaidCount,
        incomeData: [15000, 22000, 18000, 28000, 35000] // يمكنك ربطها بمجموعة 'invoices' مستقبلاً
    };
    res.render('index', { students, stats, moment });
});

// إضافة طالب جديد بمواد متعددة
app.post('/add-student', async (req, res) => {
    const { name, cycle, year, stream, subjects } = req.body;
    const subjectsList = Array.isArray(subjects) ? subjects : [subjects];
    
    const subjectsData = subjectsList.map(subName => ({
        name: subName,
        sessionsCount: 4,
        attendance: [false, false, false, false],
        paid: false
    }));

    await db.collection('students').add({
        name, cycle, year, stream: stream || 'عام',
        subjects: subjectsData,
        createdAt: new Date().toISOString()
    });
    res.redirect('/');
});

// إضافة مادة جديدة لطالب موجود
app.post('/add-subject/:id', async (req, res) => {
    const { subName, sessions } = req.body;
    const studentRef = db.collection('students').doc(req.params.id);
    const newSub = {
        name: subName,
        sessionsCount: parseInt(sessions),
        attendance: Array(parseInt(sessions)).fill(false),
        paid: false
    };
    await studentRef.update({
        subjects: admin.firestore.FieldValue.arrayUnion(newSub)
    });
    res.json({ success: true });
});

// تحديث الحصص أو الدفع (تعامل مع المصفوفة)
app.post('/update-sub-status/:id', async (req, res) => {
    const { subIndex, type, attIndex, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let { subjects } = doc.data();

    if (type === 'attendance') {
        subjects[subIndex].attendance[attIndex] = (value === 'true');
        // إذا اكتملت جميع الحصص، تصفير تلقائي
        if (subjects[subIndex].attendance.every(v => v === true)) {
            subjects[subIndex].attendance = subjects[subIndex].attendance.fill(false);
            subjects[subIndex].paid = false;
        }
    } else if (type === 'paid') {
        subjects[subIndex].paid = (value === 'true');
    }

    await docRef.update({ subjects });
    res.json({ success: true, reset: subjects[subIndex].attendance.every(v => v === false) });
});

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Maali Pro: Active on Port 3000'));
