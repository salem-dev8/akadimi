require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const app = express();

// إعداد Firebase - تأكد أن المتغير FIREBASE_SERVICE_ACCOUNT موجود في ملف .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // مهم جداً لاستقبال تحديثات AJAX
app.use(express.static('public'));

// الصفحة الرئيسية: تعرض كل شيء (الطلاب، الحضور، الإحصائيات)
app.get('/', async (req, res) => {
    try {
        const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
        const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const stats = { primary: 0, middle: 0, secondary: 0 };
        students.forEach(s => {
            if (s.cycle === 'ابتدائي') stats.primary++;
            else if (s.cycle === 'متوسط') stats.middle++;
            else stats.secondary++;
        });

        res.render('index', { students, stats, count: students.length });
    } catch (err) {
        res.send("خطأ في الاتصال بقاعدة البيانات: " + err.message);
    }
});

// إضافة طالب
app.post('/add-student', async (req, res) => {
    await db.collection('students').add({
        ...req.body,
        attendance: [false, false, false, false],
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

// تحديث فوري (AJAX) للحضور والدفع
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
