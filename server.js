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

    const stats = {
        total: students.length,
        secondary: students.filter(s => s.cycle === 'ثانوي').length,
        unpaid: students.filter(s => !s.paid).length,
        incomeData: [12000, 19000, 15000, 25000, 32000] // بيانات تجريبية للمنحنى المالي
    };
    res.render('index', { students, stats, moment });
});

// تحديث ذكي: الحصص تقود النظام المالي
app.post('/update/:id', async (req, res) => {
    const { type, index, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let data = doc.data();

    if (type === 'attendance') {
        let att = data.attendance || [false, false, false, false];
        att[index] = (value === 'true');
        
        // إذا اكتملت 4 حصص -> تصفير آلي لشهر جديد + مطالبة بالدفع
        if (att.every(v => v === true)) {
            await docRef.update({ attendance: [false, false, false, false], paid: false });
            return res.json({ success: true, cycleReset: true });
        }
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

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Maali Academy Pro Active'));
