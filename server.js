require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// المسار الرئيسي الشامل
app.get('/', async (req, res) => {
    const studentsSnap = await db.collection('students').orderBy('createdAt', 'desc').get();
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // حساب الإحصائيات للدائرة
    const stats = { primary: 0, middle: 0, secondary: 0 };
    students.forEach(s => {
        if (s.cycle === 'ابتدائي') stats.primary++;
        else if (s.cycle === 'متوسط') stats.middle++;
        else stats.secondary++;
    });

    res.render('index', { students, stats, count: students.length });
});

// إضافة طالب جديد
app.post('/add-student', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        attendance: [false, false, false, false], // 4 حصص شهرياً
        paid: false,
        createdAt: new Date().toISOString()
    });
    res.redirect('/');
});

// حذف طالب
app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

// تحديث الحضور أو الدفع عبر AJAX لسرعة الاستجابة
app.post('/update/:id', async (req, res) => {
    const { type, index, value } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const doc = await docRef.get();
    
    if (type === 'attendance') {
        let att = doc.data().attendance || [false, false, false, false];
        att[index] = (value === 'true');
        await docRef.update({ attendance: att });
    } else if (type === 'paid') {
        await docRef.update({ paid: (value === 'true') });
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
