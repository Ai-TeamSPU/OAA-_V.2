# 📋 รายงานการตรวจสอบโปรเจกต์ OAA — สิ่งที่ยังขาดหายไป

> **โปรเจกต์:** OAA โปรแกรมบันทึกอาจารย์พิเศษ — มหาวิทยาลัยศรีปทุม  
> **วันที่ตรวจสอบ:** 13 กรกฎาคม 2568  
> **ตรวจสอบโดย:** AI Assistant (Antigravity)

---

## 📊 สรุปภาพรวมความสมบูรณ์

```
ความสมบูรณ์โดยรวม: ██████████░░░░░░ 65%
```

| หมวดหมู่ | สถานะ |
|---|---|
| Frontend — ฟอร์มกรอกข้อมูล 7 ส่วน | ✅ ครบ |
| Frontend — PDPA Consent Modal | ✅ ครบ (เนื้อหา 6 หัวข้อตาม พ.ร.บ. 2562) |
| Frontend — หน้าพิมพ์เอกสาร (Print Preview) | ✅ มี |
| Backend — API CRUD | ⚠️ มี Create, Read, Delete แต่ขาด **Update (PUT)** |
| Backend — ระบบ Authentication | ⚠️ ยังเป็น Mock (hardcode password + token) |
| Database — Supabase Schema + RLS | ✅ มี SQL พร้อมรัน |
| Security — PDPA Compliance | ⚠️ ขาดหลายจุดสำคัญ |
| เอกสารประกอบ (Docs) | ⚠️ มีบางส่วน แต่ขาด README.md |

---

## 🔴 ระดับวิกฤต — ต้องแก้ก่อน Deploy จริง

### 1. ระบบ Authentication เป็น Mock

**ไฟล์:** `pageback/server.js` บรรทัด 47-54

**ปัญหา:**
- รหัสผ่าน Admin ถูก hardcode เป็น `'123456'` ในโค้ดโดยตรง
- Token เป็นค่าคงที่ `'mock-admin-token-123456'` ไม่มีการเข้ารหัสหรือหมดอายุ
- ใครก็ตามที่อ่านโค้ดได้จะเข้าถึงโหมด Admin ได้ทันที

**แนวทางแก้ไข:**
- เปลี่ยนไปใช้ **Supabase Auth** สำหรับระบบล็อกอิน
- หรือใช้ **JWT (jsonwebtoken)** จริงพร้อม Secret Key ที่เก็บใน `.env`
- เพิ่มระบบหมดอายุของ Token (Token Expiration)

---

### 2. ไฟล์ `.env` ไม่ถูกกันใน `.gitignore`

**ไฟล์:** `.gitignore`

**ปัญหา:**
- `.gitignore` ปัจจุบันไม่ได้ระบุ `.env` ไว้
- หมายความว่าไฟล์ `.env` ที่มี `SUPABASE_URL` และ `SUPABASE_KEY` อาจถูกอัปโหลดขึ้น Git
- ส่งผลให้ API Key ของ Supabase รั่วไหลสู่สาธารณะ

**แนวทางแก้ไข:**
เพิ่มบรรทัดเหล่านี้ใน `.gitignore`:
```
.env
node_modules/
```

---

### 3. ไม่มี Rate Limiting

**ไฟล์:** `pageback/server.js`

**ปัญหา:**
- API endpoint `POST /api/instructors` เปิดให้ทุกคนเข้าถึงได้โดยไม่มีการจำกัดจำนวน request
- เสี่ยงถูกโจมตีแบบ Spam หรือ DDoS ทำให้ฐานข้อมูลเต็มได้

**แนวทางแก้ไข:**
- ติดตั้ง `express-rate-limit` เพื่อจำกัดจำนวน request ต่อ IP
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use('/api/instructors', limiter);
```

---

### 4. ไม่มี Input Sanitization

**ไฟล์:** `pageback/server.js` บรรทัด 57-118

**ปัญหา:**
- ข้อมูลจาก form ถูกส่งเข้า Supabase โดยไม่มีการตรวจสอบ XSS, SQL Injection หรือ sanitize ข้อมูล
- ผู้ไม่ประสงค์ดีอาจแทรกโค้ด `<script>` ในช่องชื่อหรือที่อยู่

**แนวทางแก้ไข:**
- ติดตั้ง `express-validator` หรือ `xss` library
- เพิ่ม middleware สำหรับ sanitize ทุก field ก่อนบันทึก

---

## 🟡 ระดับสำคัญ — ควรทำก่อน Production

### 5. ขาด API สำหรับแก้ไขข้อมูล (PUT/PATCH)

**ปัญหา:**
- Backend มีแค่ 4 endpoints:
  - `POST /api/admin/login` — เข้าสู่ระบบ
  - `POST /api/instructors` — สร้างข้อมูลใหม่
  - `GET /api/instructors` — ดึงรายการทั้งหมด (Admin)
  - `GET /api/instructors/:id` — ดึงรายการเดี่ยว
  - `DELETE /api/instructors/:id` — ลบข้อมูล (Admin)
- **ไม่มี `PUT /api/instructors/:id`** สำหรับแก้ไขข้อมูลที่บันทึกแล้ว

**แนวทางแก้ไข:**
- เพิ่ม endpoint `PUT /api/instructors/:id` พร้อม `adminAuth` middleware

---

### 6. Error Handling ฝั่ง Frontend ไม่ครบ

**ไฟล์:** `pagefront/app.jsx`

**ปัญหา:**
- ถ้า Backend ไม่ได้รัน หรือ URL ผิด → หน้าเว็บจะค้างอยู่เฉยๆ ไม่มีข้อความแจ้งเตือนชัดเจน
- ไม่มีการตรวจสอบว่า Backend พร้อมใช้งานหรือไม่ (Health Check)

**แนวทางแก้ไข:**
- เพิ่ม `GET /api/health` endpoint บน Backend
- Frontend เรียก health check ตอนเปิดหน้าเว็บ หากล้มเหลวให้แจ้ง "ไม่สามารถเชื่อมต่อ Server ได้"

---

### 7. ไม่มี Logging / Audit Trail

**ปัญหา:**
- ไม่มีระบบบันทึก log ว่าใครเข้ามาดู/แก้ไข/ลบข้อมูลอาจารย์พิเศษบ้าง
- ตาม พ.ร.บ. PDPA ข้อมูลส่วนบุคคลต้องมี **Access Log** เพื่อตรวจสอบย้อนหลัง

**แนวทางแก้ไข:**
- สร้างตาราง `audit_logs` ใน Supabase เก็บ action, user, timestamp, ip_address
- เพิ่ม middleware บันทึก log ทุกครั้งที่มี API request สำคัญ

---

### 8. ไม่มี Data Encryption สำหรับข้อมูลอ่อนไหว

**ปัญหา:**
- ข้อมูลส่วนบุคคล (ชื่อ, ที่อยู่, เบอร์โทร, อีเมล) ถูกเก็บเป็น **plain text** ใน Supabase
- หากฐานข้อมูลถูกแฮก ข้อมูลจะถูกอ่านได้ทันที

**แนวทางแก้ไข:**
- เข้ารหัสฟิลด์อ่อนไหว (phone, email, address) ด้วย AES-256 ก่อนบันทึก
- ถอดรหัสเฉพาะเมื่อ Admin ร้องขอดูข้อมูล

---

### 9. ไม่มี HTTPS Enforcement

**ปัญหา:**
- Backend รันบน `http://localhost:3000` (HTTP) ไม่มีการเข้ารหัสข้อมูลระหว่างทาง
- เมื่อ deploy จริง ข้อมูลส่วนบุคคลจะถูกส่งผ่านเครือข่ายแบบไม่เข้ารหัส

**แนวทางแก้ไข:**
- เมื่อ deploy ใช้ Reverse Proxy (Nginx) หรือบริการ Cloud ที่บังคับ HTTPS
- เพิ่ม middleware เปลี่ยนเส้นทาง HTTP → HTTPS ใน production

---

### 10. CORS เปิดกว้างเกินไป

**ไฟล์:** `pageback/server.js` บรรทัด 7

**ปัญหา:**
- `app.use(cors())` เปิดให้ **ทุก origin** เข้าถึง API ได้
- เว็บไซต์อื่นสามารถยิง request มาที่ API ของเราได้

**แนวทางแก้ไข:**
```javascript
app.use(cors({
  origin: ['http://localhost:5500', 'https://your-production-domain.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
```

---

## 🟢 ระดับปรับปรุง — Nice-to-have

### 11. ระบบค้นหา/กรองข้อมูล (Search & Filter)

**ปัญหา:**
- หน้า Admin ไม่สามารถค้นหาอาจารย์ตามชื่อ, คณะ, หรือภาคเรียนได้
- ต้องไล่ดูทีละรายการ

**แนวทางแก้ไข:**
- เพิ่ม Query Parameters บน API: `GET /api/instructors?semester=1/2568&faculty=ICT`
- เพิ่มช่องค้นหาบนหน้า Frontend

---

### 12. ระบบ Export เป็น Excel/CSV

**ปัญหา:**
- Admin ไม่สามารถดาวน์โหลดข้อมูลออกมาเป็นไฟล์ Excel/CSV ได้
- ต้องเข้าไปดูใน Supabase Dashboard โดยตรง

**แนวทางแก้ไข:**
- เพิ่ม endpoint `GET /api/instructors/export?format=csv`
- ใช้ library เช่น `xlsx` หรือ `csv-writer`

---

### 13. ระบบ Pagination (แบ่งหน้า)

**ปัญหา:**
- `GET /api/instructors` ดึงข้อมูล **ทั้งหมด** ในครั้งเดียว
- ถ้ามีข้อมูลมากเป็นพันรายการ จะทำให้ระบบช้ามาก

**แนวทางแก้ไข:**
- เพิ่ม `limit` และ `offset` parameter: `GET /api/instructors?page=1&limit=20`
- ใช้ `.range(start, end)` ของ Supabase SDK

---

### 14. ไม่มี README.md

**ปัญหา:**
- ไม่มีไฟล์ README.md ที่ root ของโปรเจกต์
- ผู้พัฒนาใหม่หรือทีม IT จะไม่รู้วิธีติดตั้งและรัน

**แนวทางแก้ไข:**
- สร้าง `README.md` อธิบาย:
  - วิธีติดตั้ง (npm install)
  - วิธีตั้งค่า .env
  - วิธีรัน SQL สร้างตาราง
  - วิธีรัน Backend + Frontend

---

### 15. หน้า Dashboard สำหรับ Admin

**ปัญหา:**
- Admin เห็นแค่รายการข้อมูลดิบ
- ไม่มีหน้า dashboard สรุปสถิติ เช่น จำนวนอาจารย์ต่อคณะ, กราฟแนวโน้ม

**แนวทางแก้ไข:**
- เพิ่มหน้า dashboard ด้วย Chart.js หรือ Recharts
- แสดงข้อมูลสรุป: จำนวนรวม, จำนวนต่อคณะ, จำนวนต่อภาคเรียน

---

### 16. Data Retention — ลบข้อมูลอัตโนมัติ

**ปัญหา:**
- ข้อกำหนดใน PDPA Modal ระบุว่า "เก็บข้อมูลไม่เกิน 1 ปี"
- แต่ยังไม่มีระบบลบข้อมูลอัตโนมัติเมื่อครบกำหนด

**แนวทางแก้ไข:**
- ใช้ Supabase Edge Function หรือ Cron Job
- ตั้งเวลาลบข้อมูลที่ `created_at` เกิน 1 ปี
```sql
DELETE FROM instructors WHERE created_at < NOW() - INTERVAL '1 year';
```

---

### 17. ไม่มี Backup Strategy

**ปัญหา:**
- ไม่มีระบบ backup ข้อมูลจาก Supabase
- หากข้อมูลสูญหายจะไม่สามารถกู้คืนได้

**แนวทางแก้ไข:**
- ใช้ Supabase Dashboard > Database > Backups (มีให้อัตโนมัติในแผน Pro)
- หรือเขียน script pg_dump สำรองข้อมูลรายสัปดาห์

---

## 📌 สรุปลำดับความสำคัญที่แนะนำให้ทำก่อน

| ลำดับ | รายการ | ระดับ | ระยะเวลาประมาณ |
|---|---|---|---|
| 1 | แก้ `.gitignore` เพิ่ม `.env` + `node_modules/` | 🔴 วิกฤต | 1 นาที |
| 2 | เพิ่ม Rate Limiting | 🔴 วิกฤต | 15 นาที |
| 3 | เพิ่ม Input Sanitization | 🔴 วิกฤต | 30 นาที |
| 4 | เปลี่ยนระบบ Auth เป็น JWT จริง | 🔴 วิกฤต | 1-2 ชั่วโมง |
| 5 | จำกัด CORS | 🟡 สำคัญ | 5 นาที |
| 6 | เพิ่ม PUT API สำหรับแก้ไขข้อมูล | 🟡 สำคัญ | 30 นาที |
| 7 | เพิ่ม Health Check + Error UI | 🟡 สำคัญ | 30 นาที |
| 8 | สร้าง README.md | 🟢 ปรับปรุง | 15 นาที |
| 9 | เพิ่ม Audit Log | 🟡 สำคัญ | 1-2 ชั่วโมง |
| 10 | เพิ่ม Pagination + Search | 🟢 ปรับปรุง | 1-2 ชั่วโมง |

---

*อัปเดตล่าสุด: 13 กรกฎาคม 2568*
