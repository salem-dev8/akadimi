require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.static('public'));

// الصفحة الرئيسية مع معالجة إحصائيات متقدمة
app.get('/', async (req, res) => {
    try {
        const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
        const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const stats = {
            total: students.length,
            primary: students.filter(s => s.cycle === 'ابتدائي').length,
            middle: students.filter(s => s.cycle === 'متوسط').length,
            high: students.filter(s => s.cycle === 'ثانوي').length,
            unpaid: 0,
            totalIncome: 0 // يمكن توسيعه لضرب عدد المواد في سعر افتراضي
        };

        students.forEach(s => {
            if (s.subjects) {
                s.subjects.forEach(sub => {
                    if (!sub.paid) stats.unpaid++;
                });
            }
        });

        res.render('index', { students, stats });
    } catch (e) { res.status(500).send("خطأ في الخادم"); }
});

// إضافة طالب مع دعم المنهاج الجزائري وعدد الحصص
app.post('/add-student', async (req, res) => {
    try {
        const { name, cycle, year, subjects, sessions } = req.body;
        const subArray = Array.isArray(subjects) ? subjects : [subjects];
        
        const subjectsData = subArray.map(s => ({
            name: s,
            attendance: Array(parseInt(sessions)).fill(false),
            paid: false,
            addedAt: new Date().toISOString()
        }));

        await db.collection('students').add({
            name, cycle, year, 
            subjects: subjectsData,
            createdAt: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// تحديث الحالة (حضور/دفع) - استجابة JSON سريعة
app.post('/update-status/:id', async (req, res) => {
    const { subIndex, type, attIndex, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let { subjects } = doc.data();

    if (type === 'attendance') subjects[subIndex].attendance[attIndex] = (value === 'true');
    if (type === 'paid') subjects[subIndex].paid = (value === 'true');

    await docRef.update({ subjects });
    res.json({ success: true });
});

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.json({ success: true });
});

app.listen(3000, () => console.log('Maali Pro System Active'));
