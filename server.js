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

// مسار الصفحة الرئيسية مع معالجة الأخطاء
app.get('/', async (req, res) => {
    try {
        const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
        const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const cycleCounts = { 'ابتدائي': 0, 'متوسط': 0, 'ثانوي': 0 };
        let unpaidCount = 0;

        students.forEach(s => {
            // فحص أمان للأطوار
            if (s.cycle && cycleCounts[s.cycle] !== undefined) cycleCounts[s.cycle]++;
            
            // فحص أمان للمواد
            if (s.subjects && Array.isArray(s.subjects)) {
                s.subjects.forEach(sub => { if (!sub.paid) unpaidCount++; });
            }
        });

        const stats = {
            total: students.length,
            cycleData: Object.values(cycleCounts),
            unpaid: unpaidCount,
            incomeData: [15000, 22000, 18000, 28000, 35000]
        };
        res.render('index', { students, stats, moment });
    } catch (error) {
        console.error("GET Error:", error);
        res.status(500).send("خطأ في جلب البيانات: " + error.message);
    }
});

// إضافة طالب بمواد متعددة
app.post('/add-student', async (req, res) => {
    try {
        const { name, cycle, year, stream, subjects } = req.body;
        // تحويل المادة الواحدة لمصفوفة إذا اختار المستخدم مادة واحدة فقط
        const subjectsList = Array.isArray(subjects) ? subjects : (subjects ? [subjects] : []);
        
        const subjectsData = subjectsList.map(subName => ({
            name: subName,
            sessionsCount: 4,
            attendance: [false, false, false, false],
            paid: false
        }));

        await db.collection('students').add({
            name, cycle, year,
            stream: stream || 'عام',
            subjects: subjectsData,
            createdAt: new Date().toISOString()
        });
        res.redirect('/');
    } catch (error) {
        res.status(500).send("خطأ في الإضافة: " + error.message);
    }
});

// إضافة مادة جديدة لطالب موجود مع تحديد عدد الحصص
app.post('/add-subject/:id', async (req, res) => {
    try {
        const { subName, sessions } = req.body;
        const studentRef = db.collection('students').doc(req.params.id);
        const count = parseInt(sessions) || 4;
        
        const newSub = {
            name: subName,
            sessionsCount: count,
            attendance: Array(count).fill(false),
            paid: false
        };
        
        await studentRef.update({
            subjects: admin.firestore.FieldValue.arrayUnion(newSub)
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تحديث الحصة أو الدفع
app.post('/update-sub-status/:id', async (req, res) => {
    try {
        const { subIndex, type, attIndex, value } = req.body;
        const docRef = db.collection('students').doc(req.params.id);
        const doc = await docRef.get();
        let { subjects } = doc.data();

        if (type === 'attendance') {
            subjects[subIndex].attendance[attIndex] = (value === 'true');
            // تصفير آلي عند اكتمال النصاب
            if (subjects[subIndex].attendance.every(v => v === true)) {
                subjects[subIndex].attendance = subjects[subIndex].attendance.fill(false);
                subjects[subIndex].paid = false;
            }
        } else if (type === 'paid') {
            subjects[subIndex].paid = (value === 'true');
        }

        await docRef.update({ subjects });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/delete/:id', async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    res.redirect('/');
});

app.listen(3000, () => console.log('Maali Pro v2 Running...'));
