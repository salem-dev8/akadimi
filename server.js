require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const app = express();

// إعداد Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- ROUTES ---

// 1. الرئيسية والإحصائيات
app.get('/', async (req, res) => {
    const students = await db.collection('students').get();
    const payments = await db.collection('payments').get();
    const sessions = await db.collection('sessions').get();
    
    let totalIncome = 0;
    payments.forEach(doc => totalIncome += Number(doc.data().amount));

    const stats = {
        students: students.size,
        income: totalIncome,
        sessions: sessions.size,
        recentStudents: students.docs.slice(0, 5).map(d => d.data())
    };
    res.render('index', { stats });
});

// 2. إدارة الطلاب (بناءً على المنهاج الجزائري)
app.get('/students', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    res.render('students', { students });
});

app.post('/students/add', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        status: 'نشط',
        createdAt: new Date().toISOString()
    });
    res.redirect('/students');
});

// 3. إدارة المواد والأسعار
app.get('/subjects', async (req, res) => {
    const snap = await db.collection('subjects').get();
    const subjects = snap.docs.map(doc => doc.data());
    res.render('subjects', { subjects });
});

app.post('/subjects/add', async (req, res) => {
    await db.collection('subjects').add(req.body);
    res.redirect('/subjects');
});

// 4. إدارة الحصص والمدفوعات
app.get('/sessions', async (req, res) => {
    const sessSnap = await db.collection('sessions').get();
    const stuSnap = await db.collection('students').get();
    const subSnap = await db.collection('subjects').get();
    res.render('sessions', { 
        sessions: sessSnap.docs.map(d => d.data()),
        students: stuSnap.docs.map(d => d.data()),
        subjects: subSnap.docs.map(d => d.data())
    });
});

app.post('/sessions/add', async (req, res) => {
    await db.collection('sessions').add(req.body);
    // إضافة سجل مدفوعات تلقائي
    await db.collection('payments').add({
        studentName: req.body.studentName,
        amount: req.body.price,
        date: new Date().toISOString()
    });
    res.redirect('/sessions');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
