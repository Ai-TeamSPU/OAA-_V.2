# แผนการพัฒนา: การแยกโค้ดเป็น Frontend (pagefront) และ Backend (pageback)

แผนงานนี้กำหนดการแยกส่วนสถาปัตยกรรมโปรเจกต์อาจารย์พิเศษ (OAA) ออกเป็น 2 ฝั่งอย่างเป็นทางการ เพื่อความปลอดภัยของข้อมูลส่วนบุคคล (PDPA) และความโปร่งใสในโครงสร้างสิทธิ์การเข้าถึงข้อมูล:

1.  **Frontend (หน้าบ้าน):** `pagefront.html` และ `pagefront.jsx` ทำหน้าที่ติดต่อผู้ใช้งานและสั่งการแสดงผล
2.  **Backend (หลังบ้าน):** `pageback.js` เป็นเซิร์ฟเวอร์ Node.js (Express) คอยรับคำสั่งและเชื่อมต่อกับ Supabase

---

## 1. รายการไฟล์ที่จะเปลี่ยนแปลง (Proposed Changes)

### 1.1 ไฟล์ฝั่งหลังบ้าน (Backend - pageback.js)

*   #### [NEW] [pageback.js](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/pageback.js)
    *   สร้างระบบ API ด้วย Node.js (Express)
    *   รับส่งข้อมูลผ่าน JSON และเปิดใช้งานระบบ CORS เพื่อให้ฝั่งหน้าบ้านสามารถเรียกใช้ข้ามโดเมนได้
    *   เชื่อมต่อฐานข้อมูล Supabase ผ่าน `@supabase/supabase-js` ของหลังบ้าน (ไม่เผยแพร่คีย์ออกไปหน้าบ้าน)
    *   **Endpoints ที่ต้องมี:**
        *   `POST /api/instructors` : บันทึกข้อมูลใบสมัครอาจารย์พิเศษ (Write-only)
        *   `GET /api/instructors` : ดึงรายการอาจารย์ทั้งหมดสำหรับ Admin (ต้องใช้รหัสผ่าน / Token ยืนยัน)
        *   `DELETE /api/instructors/:id` : ลบรายการประวัติข้อมูล
        *   `POST /api/admin/login` : ตรวจสอบสิทธิ์การเข้าสู่ระบบแอดมิน
*   #### [NEW] [package.json](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/package.json)
    *   ไฟล์ระบุโมดูล Dependencies ที่จำต้องลงสำหรับเซิร์ฟเวอร์ ได้แก่: `express`, `@supabase/supabase-js`, `cors`, `dotenv`
*   #### [NEW] [.env](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/.env)
    *   ไฟล์เก็บค่าคอนฟิกและคีย์ความปลอดภัยที่เป็นความลับระดับเซิร์ฟเวอร์ ได้แก่: `PORT`, `SUPABASE_URL`, `SUPABASE_KEY`

---

### 1.2 ไฟล์ฝั่งหน้าบ้าน (Frontend - pagefront.html / pagefront.jsx)

*   #### [NEW] [pagefront.html](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/pagefront.html)
    *   หน้าโฮสต์ HTML ดั้งเดิมที่โคลนมาจาก `index.html` แต่เปลี่ยนมาโหลดสคริปต์หน้าบ้านหลักชื่อ `pagefront.jsx` และลบสคริปต์ Supabase Client CDN ออก (เนื่องจากหน้าบ้านจะติดต่อผ่าน Express API แทนแล้ว)
*   #### [NEW] [pagefront.jsx](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/pagefront.jsx)
    *   ย้ายส่วนการแสดงผลฟอร์มและ Logic ตรวจสอบคุณสมบัติทั้งหมดมาจาก `app.jsx`
    *   ปรับปรุงส่วนจัดเก็บข้อมูล (`ApiService`) ให้ส่งคำขอและดึงข้อมูลไปที่ Express Backend API แทนการส่งไปที่ Supabase หรือ LocalStorage โดยตรง
    *   ปรับปรุง SettingsModal ให้เก็บเฉพาะค่า **"Backend API URL"** (เช่น `http://localhost:3000`)
*   #### [DELETE] [index.html](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/index.html)
    *   ลบออกเนื่องจากเปลี่ยนไปใช้งาน `pagefront.html` แทน
*   #### [DELETE] [app.jsx](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/app.jsx)
    *   ลบออกเนื่องจากย้ายไปเป็น `pagefront.jsx` แล้ว

---

### 1.3 ไฟล์รายงานการพิมพ์ (index-print.html)

*   #### [MODIFY] [index-print.html](file:///d:/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/index-print.html)
    *   ปรับปรุงโค้ดดึงรายละเอียดรายงาน PDF ให้ยิง HTTP GET Request ไปเรียกข้อมูลจาก Express Backend ตามหมายเลข ID เพื่อความปลอดภัยและทันสมัย

---

## 2. ขั้นตอนการเตรียมตัวของนักพัฒนา

1.  **ติดตั้ง Node.js:** ตรวจเช็กเครื่องคอมพิวเตอร์ของคุณว่าลง Node.js ไว้เรียบร้อยแล้ว
2.  **รันคำสั่งดาวน์โหลดโมดูลหลังบ้าน:**
    `npm install`
3.  **กรอกรายละเอียดคีย์ลับในไฟล์ `.env`:** กรอก Supabase URL และ API key ของคุณลงในไฟล์สำหรับหลังบ้าน
4.  **เริ่มต้นระบบ Backend:**
    `npm start` หรือ `node pageback.js` (รันบนพอร์ต 3000)

---

## 3. แผนการทดสอบทวนสอบ (Verification Plan)

1.  **ทดสอบหลังบ้าน (Express API):**
    *   ทดสอบยิง `POST /api/instructors` เพื่อบันทึกข้อมูล และตรวจดูความถูกต้องใน Supabase
    *   ทดสอบยิง Login แอดมินผ่านหลังบ้าน
2.  **ทดสอบหน้าบ้าน (pagefront.html):**
    *   เปิดหน้า `pagefront.html` และลองกรอกประวัติอาจารย์พิเศษและกดยอมรับ PDPA
    *   กดปุ่ม "บันทึกข้อมูล" สังเกตหน้าเครือข่าย (Network) ข้อมูลต้องยิงไปที่เซิร์ฟเวอร์หลังบ้าน Express
    *   เข้าโหมด Admin ดึงข้อมูลมาแสดงผล และทดสอบพิมพ์รายงาน PDF ออกมาได้สมบูรณ์
