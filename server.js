require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const moment = require('moment'); // تأكد من تنصيبه: npm install moment
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
        primary: students.filter(s => s.cycle === 'ابتدائي').length,
        middle: students.filter(s => s.cycle === 'متوسط').length,
        secondary: students.filter(s => s.cycle === 'ثانوي').length,
        totalEarnings: students.filter(s => s.paid).length * 2000, // مثال لحساب الدخل
        currentTime: moment().format('LLLL') // الوقت والتاريخ بالعربي
    };

    res.render('index', { students, stats, count: students.length, moment });
});

app.post('/add-student', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        attendance: [false, false, false, false],
        paid: false,
        createdAt: new Date().toISOString(), // تخزين وقت التسجيل الدقيق
        regDay: moment().format('dddd'),      // يوم التسجيل
        regMonth: moment().format('MMMM YYYY') // شهر التسجيل
    });
    res.redirect('/');
});

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

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Server running on port 3000'));
