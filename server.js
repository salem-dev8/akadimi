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

app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // إحصائيات متقدمة
    const stats = {
        total: students.length,
        primary: students.filter(s => s.cycle === 'ابتدائي').length,
        middle: students.filter(s => s.cycle === 'متوسط').length,
        secondary: students.filter(s => s.cycle === 'ثانوي').length,
        paidCount: students.filter(s => s.paid).length,
        unpaidCount: students.filter(s => !s.paid).length,
        // حساب نسبة الإنجاز في الحصص
        totalAttendance: students.reduce((acc, s) => acc + (s.attendance ? s.attendance.filter(a => a).length : 0), 0)
    };

    res.render('index', { students, stats, moment });
});

// تحديث الحصص والدفع (AJAX)
app.post('/update/:id', async (req, res) => {
    const { type, index, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    if (type === 'attendance') {
        const doc = await docRef.get();
        let att = doc.data().attendance || [false, false, false, false];
        att[index] = (value === 'true');
        await docRef.update({ attendance: att });
    } else {
        await docRef.update({ paid: (value === 'true') });
    }
    res.json({ success: true });
});

app.post('/add-student', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        attendance: [false, false, false, false],
        paid: false,
        createdAt: new Date().toISOString()
    });
    res.redirect('/');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
