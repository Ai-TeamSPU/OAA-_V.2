const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// ==========================================
// Environment Variables
// ==========================================
const PORT = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY_HOURS = parseInt(process.env.TOKEN_EXPIRY_HOURS) || 8;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500').split(',').map(s => s.trim());

// ==========================================
// Security Middleware
// ==========================================

// Helmet — ตั้งค่า HTTP Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false  // ปิดเพราะ Frontend ใช้ CDN
}));

// CORS — อนุญาต Localhost, Vercel (*.vercel.app), Netlify (*.netlify.app) และ ALLOWED_ORIGINS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // อนุญาตโดเมน Vercel, Netlify และ Localhost ทั้งหมดโดยอัตโนมัติ
    if (/\.vercel\.app$/.test(origin) || /\.netlify\.app$/.test(origin) || /^http:\/\/localhost/.test(origin) || /^http:\/\/127\.0\.0\.1/.test(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS Warning] Blocked origin: ${origin}`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// JSON Body Parser
app.use(express.json({ limit: '1mb' }));

// HTTPS Redirect (เฉพาะ Production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Rate Limiting — จำกัด POST /api/instructors (10 requests / 15 นาที)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    message: 'คุณส่งข้อมูลบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting — จำกัด Login (5 attempts / 15 นาที)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    status: 'error',
    message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// Supabase Client
// ==========================================
let supabase = null;
const isSupabaseConfigured = supabaseUrl && supabaseKey && supabaseUrl.indexOf('your-project') === -1;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✓ Supabase Client Initialized Successfully (Normalized Schema Support).');
} else {
  console.warn('⚠️ Supabase URL or Anon Key is placeholder. Database queries will return dummy mock data.');
}

// Mock Local Database in memory (for development fallback)
let localRecords = [];

// ==========================================
// Input Sanitization Helper
// ==========================================
const xssOptions = {
  whiteList: {},          // ไม่อนุญาต HTML tag ใดๆ เลย
  stripIgnoreTag: true,   // ลบ tag ที่ไม่อยู่ใน whitelist
  stripIgnoreTagBody: ['script', 'style'] // ลบทั้ง tag และเนื้อหาใน script/style
};

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value.trim(), xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, val] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(val);
  }
  return sanitized;
}

// ==========================================
// JWT Authentication Middleware
// ==========================================
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. กรุณาเข้าสู่ระบบ Admin ก่อน' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminUser = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ status: 'error', message: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
};

// ==========================================
// Audit Logger
// ==========================================
async function logAudit(action, details, req) {
  const logEntry = {
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    admin_user: req.adminUser?.role || 'anonymous',
    created_at: new Date().toISOString()
  };

  console.log(`[AUDIT] ${logEntry.action} | IP: ${logEntry.ip_address} | ${logEntry.details}`);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('audit_logs').insert([logEntry]);
    } catch (err) {
      console.error('[AUDIT DB ERROR]', err.message);
    }
  }
}

// Helper: แปลงข้อมูลจาก Supabase ที่ Join ตารางย่อยกลับเป็นโครงสร้างของ Frontend
function formatInstructorRow(row) {
  const educations = (row.instructor_educations || [])
    .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0))
    .map(e => ({ id: e.id, level: e.level, curriculum: e.curriculum, major: e.major, institution: e.institution, year: e.graduation_year }));

  const experiences = (row.instructor_experiences || [])
    .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0))
    .map(w => ({ id: w.id, position: w.position, company: w.company, startDate: w.start_date, endDate: w.end_date, isCurrent: w.is_current, isDirect: w.is_direct }));

  const awards = (row.instructor_awards || [])
    .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0))
    .map(a => ({ id: a.id, title: a.title, link: a.link }));

  const courses = (row.instructor_courses || [])
    .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0))
    .map(c => ({ id: c.id, subject: c.subject, credits: c.credits, teachCount: c.teach_count, proportion: c.proportion, degreeLevel: c.degree_level }));

  return {
    id: row.id,
    savedAt: row.created_at,
    data: {
      id: row.id,
      semester: row.semester,
      faculty: row.faculty,
      branch: row.branch,
      titlePrefix: row.title_prefix || '',
      titleCustom: row.title_custom || '',
      firstNameTH: row.first_name_th || '',
      lastNameTH: row.last_name_th || '',
      firstNameEN: row.first_name_en || '',
      lastNameEN: row.last_name_en || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      teachingProportion: row.teaching_proportion || '',
      teachingHours: row.teaching_hours || '',
      teachingNote: row.teaching_note || '',
      expertise: row.expertise || '',
      note: row.note || '',
      qualSubs: row.qual_subs || {},
      qualFields: row.qual_fields || {},
      pdpaConsent: row.pdpa_consent,
      educations,
      experiences,
      awards,
      courses
    }
  };
}

// ==========================================
// API Endpoints
// ==========================================

// 0. GET /api/health — Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: isSupabaseConfigured ? 'connected' : 'mock-mode',
    schema: 'normalized-v2',
    version: '2.0.0'
  });
});

// 1. POST /api/admin/login — เข้าสู่ระบบ Admin (JWT จริง)
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { role: 'admin', loginAt: new Date().toISOString() },
      JWT_SECRET,
      { expiresIn: `${TOKEN_EXPIRY_HOURS}h` }
    );

    logAudit('ADMIN_LOGIN', 'Admin login successful', req);

    res.json({
      status: 'success',
      token,
      expiresIn: `${TOKEN_EXPIRY_HOURS} ชั่วโมง`
    });
  } else {
    logAudit('ADMIN_LOGIN_FAILED', 'Invalid password attempt', req);
    res.status(400).json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง!' });
  }
});

// 2. POST /api/instructors — บันทึกข้อมูล ( Public, Rate Limited, Sanitized ) -> แตกใส่ 5 ตารางย่อย
app.post('/api/instructors', submitLimiter, async (req, res) => {
  try {
    const form = sanitizeObject(req.body);

    // Server-side Validation
    if (!form.semester || !form.faculty || !form.branch) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลภาคการศึกษา คณะ และสาขาวิชา' });
    }
    if (!form.firstNameTH || !form.lastNameTH) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อ-นามสกุล (ภาษาไทย)' });
    }
    if (!form.phone) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกหมายเลขโทรศัพท์' });
    }
    if (!form.address) {
      return res.status(400).json({ status: 'error', message: 'กรุณากรอกที่อยู่ที่สามารถติดต่อได้' });
    }
    if (!form.pdpaConsent) {
      return res.status(400).json({ status: 'error', message: 'กรุณากดยอมรับการเก็บรวบรวมข้อมูลส่วนบุคคล (PDPA)' });
    }

    if (isSupabaseConfigured) {
      // 1. Insert ตารางหลัก `instructors`
      const mainPayload = {
        semester: form.semester,
        faculty: form.faculty,
        branch: form.branch,
        title_prefix: form.titlePrefix || '',
        title_custom: form.titleCustom || '',
        first_name_th: form.firstNameTH,
        last_name_th: form.lastNameTH,
        first_name_en: form.firstNameEN || '',
        last_name_en: form.lastNameEN || '',
        phone: form.phone,
        email: form.email || '',
        address: form.address,
        teaching_proportion: form.teachingProportion || '',
        teaching_hours: form.teachingHours || '',
        teaching_note: form.teachingNote || '',
        expertise: form.expertise || '',
        note: form.note || '',
        qual_subs: form.qualSubs || {},
        qual_fields: form.qualFields || {},
        pdpa_consent: form.pdpaConsent,
        pdpa_consent_at: new Date().toISOString()
      };

      const { data: mainData, error: mainError } = await supabase
        .from('instructors')
        .insert([mainPayload])
        .select();

      if (mainError) throw mainError;

      const newInstructorId = mainData[0].id; // ได้ ID เป็นตัวเลข (BIGINT)!

      // 2. Insert ตารางย่อย: `instructor_educations`
      const eduRows = (form.educations || []).map((e, idx) => ({
        instructor_id: newInstructorId,
        level: e.level || '',
        curriculum: e.curriculum || '',
        major: e.major || '',
        institution: e.institution || '',
        graduation_year: e.year || '',
        sequence_no: idx + 1
      }));
      if (eduRows.length > 0) {
        const { error: eduError } = await supabase.from('instructor_educations').insert(eduRows);
        if (eduError) console.error('Edu insert error:', eduError.message);
      }

      // 3. Insert ตารางย่อย: `instructor_experiences`
      const expRows = (form.experiences || []).map((w, idx) => ({
        instructor_id: newInstructorId,
        position: w.position || '',
        company: w.company || '',
        start_date: w.startDate || '',
        end_date: w.endDate || '',
        is_current: !!w.isCurrent,
        is_direct: !!w.isDirect,
        sequence_no: idx + 1
      }));
      if (expRows.length > 0) {
        const { error: expError } = await supabase.from('instructor_experiences').insert(expRows);
        if (expError) console.error('Exp insert error:', expError.message);
      }

      // 4. Insert ตารางย่อย: `instructor_awards`
      const awardRows = (form.awards || []).map((a, idx) => ({
        instructor_id: newInstructorId,
        title: a.title || '',
        link: a.link || '',
        sequence_no: idx + 1
      }));
      if (awardRows.length > 0) {
        const { error: awardError } = await supabase.from('instructor_awards').insert(awardRows);
        if (awardError) console.error('Award insert error:', awardError.message);
      }

      // 5. Insert ตารางย่อย: `instructor_courses`
      const courseRows = (form.courses || []).map((c, idx) => ({
        instructor_id: newInstructorId,
        subject: c.subject || '',
        credits: String(c.credits || ''),
        teach_count: String(c.teachCount || ''),
        proportion: String(c.proportion || ''),
        degree_level: c.degreeLevel || '',
        sequence_no: idx + 1
      }));
      if (courseRows.length > 0) {
        const { error: courseError } = await supabase.from('instructor_courses').insert(courseRows);
        if (courseError) console.error('Course insert error:', courseError.message);
      }

      logAudit('INSERT_INSTRUCTOR', `Saved ID #${newInstructorId}: ${form.firstNameTH} ${form.lastNameTH} (${form.faculty})`, req);

      res.status(201).json({
        status: 'success',
        message: `บันทึกข้อมูลเข้าฐานข้อมูลเรียบร้อยแล้ว (ID: ${newInstructorId})`,
        data: { id: newInstructorId, ...form }
      });
    } else {
      const mockRecord = {
        id: localRecords.length + 1,
        created_at: new Date().toISOString(),
        ...form
      };
      localRecords.unshift(mockRecord);
      logAudit('INSERT_INSTRUCTOR', `Mock saved: ${form.firstNameTH} ${form.lastNameTH}`, req);
      res.status(201).json({ status: 'success', message: 'บันทึกข้อมูลสำเร็จ (โหมดจำลองออฟไลน์)', data: mockRecord });
    }
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์: ' + error.message });
  }
});

// 3. GET /api/instructors — ดึงรายการทั้งหมดพร้อม Join ตารางย่อย (Admin only)
app.get('/api/instructors', adminAuth, async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          *,
          instructor_educations (*),
          instructor_experiences (*),
          instructor_awards (*),
          instructor_courses (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data.map(formatInstructorRow);

      logAudit('VIEW_ALL_INSTRUCTORS', `Admin viewed ${formatted.length} records`, req);
      res.json({ status: 'success', data: formatted });
    } else {
      const formatted = localRecords.map(rec => ({
        id: rec.id,
        savedAt: rec.created_at,
        data: rec
      }));
      res.json({ status: 'success', data: formatted });
    }
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ status: 'error', message: 'ไม่สามารถโหลดประวัติได้: ' + error.message });
  }
});

// 4. GET /api/instructors/:id — ดึงรายการเดี่ยวพร้อมข้อมูลย่อย
app.get('/api/instructors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          *,
          instructor_educations (*),
          instructor_experiences (*),
          instructor_awards (*),
          instructor_courses (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ status: 'error', message: 'ไม่พบประวัติอาจารย์พิเศษ' });

      const formatted = formatInstructorRow(data);
      res.json({ status: 'success', data: formatted.data });
    } else {
      const rec = localRecords.find(r => String(r.id) === String(id));
      if (!rec) return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูล' });
      res.json({ status: 'success', data: rec });
    }
  } catch (error) {
    console.error('Fetch single error:', error);
    res.status(500).json({ status: 'error', message: 'ไม่สามารถโหลดประวัติรายนี้ได้: ' + error.message });
  }
});

// 5. PUT /api/instructors/:id — แก้ไขข้อมูลและตารางย่อย (Admin only)
app.put('/api/instructors/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const form = sanitizeObject(req.body);

    if (isSupabaseConfigured) {
      // 1. อัปเดตตารางหลัก
      const mainPayload = {
        semester: form.semester,
        faculty: form.faculty,
        branch: form.branch,
        title_prefix: form.titlePrefix || '',
        title_custom: form.titleCustom || '',
        first_name_th: form.firstNameTH,
        last_name_th: form.lastNameTH,
        first_name_en: form.firstNameEN || '',
        last_name_en: form.lastNameEN || '',
        phone: form.phone,
        email: form.email || '',
        address: form.address,
        teaching_proportion: form.teachingProportion || '',
        teaching_hours: form.teachingHours || '',
        teaching_note: form.teachingNote || '',
        expertise: form.expertise || '',
        note: form.note || '',
        qual_subs: form.qualSubs || {},
        qual_fields: form.qualFields || {},
        pdpa_consent: form.pdpaConsent,
        updated_at: new Date().toISOString()
      };

      const { data: updatedData, error: updateError } = await supabase
        .from('instructors')
        .update(mainPayload)
        .eq('id', id)
        .select();

      if (updateError) throw updateError;
      if (!updatedData || updatedData.length === 0) {
        return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      }

      // 2. ลบตารางย่อยเก่าและใส่ชุดใหม่เข้าไปแทนที่
      await supabase.from('instructor_educations').delete().eq('instructor_id', id);
      await supabase.from('instructor_experiences').delete().eq('instructor_id', id);
      await supabase.from('instructor_awards').delete().eq('instructor_id', id);
      await supabase.from('instructor_courses').delete().eq('instructor_id', id);

      const eduRows = (form.educations || []).map((e, idx) => ({ instructor_id: id, level: e.level || '', curriculum: e.curriculum || '', major: e.major || '', institution: e.institution || '', graduation_year: e.year || '', sequence_no: idx + 1 }));
      const expRows = (form.experiences || []).map((w, idx) => ({ instructor_id: id, position: w.position || '', company: w.company || '', start_date: w.startDate || '', end_date: w.endDate || '', is_current: !!w.isCurrent, is_direct: !!w.isDirect, sequence_no: idx + 1 }));
      const awardRows = (form.awards || []).map((a, idx) => ({ instructor_id: id, title: a.title || '', link: a.link || '', sequence_no: idx + 1 }));
      const courseRows = (form.courses || []).map((c, idx) => ({ instructor_id: id, subject: c.subject || '', credits: String(c.credits || ''), teach_count: String(c.teachCount || ''), proportion: String(c.proportion || ''), degree_level: c.degreeLevel || '', sequence_no: idx + 1 }));

      if (eduRows.length) await supabase.from('instructor_educations').insert(eduRows);
      if (expRows.length) await supabase.from('instructor_experiences').insert(expRows);
      if (awardRows.length) await supabase.from('instructor_awards').insert(awardRows);
      if (courseRows.length) await supabase.from('instructor_courses').insert(courseRows);

      logAudit('UPDATE_INSTRUCTOR', `Updated ID #${id}: (${form.firstNameTH} ${form.lastNameTH})`, req);
      res.json({ status: 'success', message: 'แก้ไขข้อมูลเรียบร้อยแล้ว', data: { id, ...form } });
    } else {
      const index = localRecords.findIndex(r => String(r.id) === String(id));
      if (index === -1) return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      localRecords[index] = { ...localRecords[index], ...form };
      logAudit('UPDATE_INSTRUCTOR', `Mock updated ID: ${id}`, req);
      res.json({ status: 'success', message: 'แก้ไขข้อมูลจำลองเรียบร้อยแล้ว', data: localRecords[index] });
    }
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ status: 'error', message: 'ไม่สามารถแก้ไขข้อมูลได้: ' + error.message });
  }
});

// 6. DELETE /api/instructors/:id — ลบข้อมูล (Admin only) ( ON DELETE CASCADE จะลบตารางย่อยให้อัตโนมัติ )
app.delete('/api/instructors/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('instructors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      logAudit('DELETE_INSTRUCTOR', `Deleted ID #${id}`, req);
      res.json({ status: 'success', message: 'ลบประวัติอาจารย์พิเศษเรียบร้อยแล้ว' });
    } else {
      const index = localRecords.findIndex(r => String(r.id) === String(id));
      if (index === -1) return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลที่ต้องการลบ' });
      localRecords.splice(index, 1);
      logAudit('DELETE_INSTRUCTOR', `Mock deleted ID: ${id}`, req);
      res.json({ status: 'success', message: 'ลบข้อมูลจำลองเรียบร้อยแล้ว' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ status: 'error', message: 'ไม่สามารถสั่งลบประวัติได้: ' + error.message });
  }
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 OAA API Backend v2.1 running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`🗄️  Schema Model: Normalized Relational Tables (5 Tables)`);
  console.log(`🔑 ID Format: Auto-Increment Number (1, 2, 3...)`);
  console.log(`🔐 JWT Auth: Enabled (${TOKEN_EXPIRY_HOURS}h expiry)`);
  console.log(`🛡️  Rate Limit: 10 req/15min (submit), 5 req/15min (login)`);
  console.log(`🧹 Input Sanitization: Enabled (XSS filter)`);
  console.log(`📝 Audit Trail: Enabled`);
  console.log(`🌐 CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`📦 Supabase: ${isSupabaseConfigured ? 'Connected' : 'Mock Mode'}`);
  console.log(`==================================================`);
});
