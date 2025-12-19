require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// إعداد Firebase
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// المسارات (Routes)

// 1. الصفحة الرئيسية: عرض الطلاب
app.get('/', async (req, res) => {
    const snapshot = await db.collection('students').get();
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('index', { students });
});

// 2. إضافة طالب جديد
app.post('/add-student', async (req, res) => {
    const { firstName, lastName, level, year, stream, subjects } = req.body;
    await db.collection('students').add({
        firstName, lastName, level, year, stream, 
        subjects: Array.isArray(subjects) ? subjects : [subjects],
        attendance: [], // سجل الحصص
        paymentStatus: 'لم يتم الدفع',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.redirect('/');
});

// 3. صفحة الإحصائيات
app.get('/stats', async (req, res) => {
    const snapshot = await db.collection('students').get();
    const total = snapshot.size;
    res.render('stats', { total });
});

// 4. ملف الطالب الشخصي
app.get('/profile/:id', async (req, res) => {
    const doc = await db.collection('students').doc(req.params.id).get();
    res.render('profile', { student: { id: doc.id, ...doc.data() } });
});

// 5. تحديث حالة الدفع والحضور
app.post('/update-student/:id', async (req, res) => {
    const { paymentStatus, attendanceDate } = req.body;
    const ref = db.collection('students').doc(req.params.id);
    if (paymentStatus) await ref.update({ paymentStatus });
    if (attendanceDate) await ref.update({
        attendance: admin.firestore.FieldValue.arrayUnion({ date: attendanceDate, status: 'حاضر' })
    });
    res.redirect(`/profile/${req.params.id}`);
});

// 6. حذف طالب
app.get('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Server started on http://localhost:3000'));
