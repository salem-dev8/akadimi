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

// جلب البيانات الأولية
app.get('/', async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('index', { students });
});

// إضافة طالب جديد وإرسال بياناته لتضاف فوراً للواجهة
app.post('/add-student', async (req, res) => {
    try {
        const { name, cycle, year, subjects, sessions } = req.body;
        const subArray = Array.isArray(subjects) ? subjects : [subjects];
        const subjectsData = subArray.map(s => ({
            name: s,
            attendance: Array(parseInt(sessions)).fill(false),
            paid: false
        }));
        const newDoc = { name, cycle, year, subjects: subjectsData, createdAt: new Date().toISOString() };
        const ref = await db.collection('students').add(newDoc);
        res.json({ id: ref.id, ...newDoc });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// إضافة مادة لطالب موجود
app.post('/add-subject/:id', async (req, res) => {
    try {
        const { subName, sessions } = req.body;
        const docRef = db.collection('students').doc(req.params.id);
        const newSub = { name: subName, attendance: Array(parseInt(sessions)).fill(false), paid: false };
        await docRef.update({ subjects: admin.firestore.FieldValue.arrayUnion(newSub) });
        res.json(newSub);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// تحديث الحالة
app.post('/update-status/:id', async (req, res) => {
    const { subIndex, type, attIndex, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    let subjects = doc.data().subjects;
    if (type === 'attendance') subjects[subIndex].attendance[attIndex] = (value === 'true');
    if (type === 'paid') subjects[subIndex].paid = (value === 'true');
    await docRef.update({ subjects });
    res.json({ success: true });
});

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.json({ success: true });
});

app.listen(3000, () => console.log('Maali App Active'));
