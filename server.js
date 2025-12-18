require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // حساب إحصائيات حقيقية من قاعدة البيانات
    const cycleCounts = { 'ابتدائي': 0, 'متوسط': 0, 'ثانوي': 0 };
    let unpaidTotal = 0;
    let totalSubjects = 0;

    students.forEach(s => {
        if (cycleCounts[s.cycle] !== undefined) cycleCounts[s.cycle]++;
        if (s.subjects) {
            s.subjects.forEach(sub => {
                totalSubjects++;
                if (!sub.paid) unpaidTotal++;
            });
        }
    });

    const stats = {
        total: students.length,
        cycleData: Object.values(cycleCounts),
        unpaid: unpaidTotal,
        activeSubjects: totalSubjects
    };
    res.render('index', { students, stats });
});

app.post('/add-student', async (req, res) => {
    try {
        const { name, cycle, year, subjects, sessionsCount } = req.body;
        const subArray = Array.isArray(subjects) ? subjects : [subjects];
        const subjectsData = subArray.filter(s => s).map(s => ({
            name: s,
            attendance: Array(parseInt(sessionsCount || 4)).fill(false),
            paid: false
        }));
        await db.collection('students').add({
            name, cycle, year, subjects: subjectsData,
            createdAt: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/update-sub-status/:id', async (req, res) => {
    const { subIndex, type, attIndex, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let { subjects } = doc.data();

    if (type === 'attendance') subjects[subIndex].attendance[attIndex] = (value === 'true');
    else if (type === 'paid') subjects[subIndex].paid = (value === 'true');

    await docRef.update({ subjects });
    res.json({ success: true });
});

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server Ready'));
