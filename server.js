require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const moment = require('moment');
const app = express();

// إعداد Firebase
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// الصفحة الرئيسية
app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
        total: students.length,
        primary: students.filter(s => s.cycle === 'ابتدائي').length,
        middle: students.filter(s => s.cycle === 'متوسط').length,
        secondary: students.filter(s => s.cycle === 'ثانوي').length,
        paid: students.filter(s => s.paid).length
    };
    res.render('index', { students, stats, moment });
});

// تحديث الحضور والدفع (المنطق الذكي للدورة الشهرية)
app.post('/update/:id', async (req, res) => {
    const { type, index, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let data = doc.data();

    if (type === 'attendance') {
        let att = data.attendance || [false, false, false, false];
        att[index] = (value === 'true');

        // إذا أصبحت كل الحصص (صح)، يتم تصفير الشهر وتغيير حالة الدفع
        if (att.every(h => h === true)) {
            await docRef.update({ 
                attendance: [false, false, false, false], 
                paid: false 
            });
            return res.json({ success: true, reset: true });
        } else {
            await docRef.update({ attendance: att });
        }
    } else {
        await docRef.update({ paid: (value === 'true') });
    }
    res.json({ success: true, reset: false });
});

// إضافة طالب جديد
app.post('/add-student', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        attendance: [false, false, false, false],
        paid: false,
        createdAt: new Date().toISOString()
    });
    res.redirect('/');
});

// حذف طالب (تم الإصلاح)
app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Maali System Started on Port 3000'));
