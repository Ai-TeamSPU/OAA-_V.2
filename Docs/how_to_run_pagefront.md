# คู่มือการรันหน้า Pagefront (Frontend)

> คู่มือนี้อธิบายวิธีการเปิดใช้งานหน้าเว็บฝั่ง Frontend สำหรับระบบบันทึกข้อมูลอาจารย์พิเศษ

---

## 📁 โครงสร้างไฟล์ใน pagefront/

```
pagefront/
├── index.html          ← ไฟล์หลักที่ใช้เปิดรัน (Entry Point)
├── app.jsx             ← Logic หลักของ React App
├── components.jsx      ← UI Components
├── data.js             ← ค่าคงที่ / ข้อมูล Dropdown
└── index-print.html    ← หน้าพิมพ์เอกสาร (เปิดผ่านระบบ)
```

---

## วิธีที่ 1: ใช้ Live Server Extension ใน VS Code (แนะนำ ⭐)

### ขั้นตอน:

1. **ติดตั้ง Extension "Live Server"** ใน VS Code
   - กด `Ctrl + Shift + X` → ค้นหา **Live Server** → กด **Install**

2. **เปิดไฟล์ `index.html`**
   - ไปที่ `pagefront/index.html` แล้วคลิกเปิดไฟล์

3. **คลิกขวาที่ไฟล์ → เลือก "Open with Live Server"**
   - หรือกดปุ่ม **"Go Live"** ที่มุมล่างขวาของ VS Code

4. **เบราว์เซอร์จะเปิดอัตโนมัติ** ที่ URL:
   ```
   http://127.0.0.1:5500/pagefront/index.html
   ```

### ข้อดี:
- ✅ รีเฟรชหน้าเว็บอัตโนมัติเมื่อบันทึกไฟล์ (Hot Reload)
- ✅ ไม่มีปัญหา CORS เพราะรันผ่าน HTTP Server
- ✅ ไม่ต้องติดตั้ง Node.js สำหรับฝั่ง Frontend

---

## วิธีที่ 2: ใช้ npx serve (ผ่าน Terminal)

### ขั้นตอน:

1. **เปิด Terminal** ใน VS Code (`Ctrl + `` `)

2. **รันคำสั่ง:**
   ```bash
   npx serve "d:\OAA โปรแกรมบันทึกอาจารย์พิเศษ\pagefront"
   ```

3. **เปิดเบราว์เซอร์** ไปที่ URL ที่แสดง (ปกติคือ):
   ```
   http://localhost:3000
   ```

### ข้อดี:
- ✅ ไม่ต้องติดตั้ง Extension
- ✅ ใช้ได้ทุก Editor ไม่จำกัดแค่ VS Code

---

## วิธีที่ 3: ใช้ Python HTTP Server (สำหรับคนที่มี Python)

### ขั้นตอน:

1. **เปิด Terminal** แล้วรัน:
   ```bash
   cd "d:\OAA โปรแกรมบันทึกอาจารย์พิเศษ\pagefront"
   python -m http.server 8080
   ```

2. **เปิดเบราว์เซอร์** ไปที่:
   ```
   http://localhost:8080
   ```

---

## ⚠️ ข้อควรระวังสำคัญ

### ❌ ห้ามเปิด index.html โดยดับเบิลคลิกโดยตรง
การเปิดไฟล์ HTML ด้วยการดับเบิลคลิก (URL จะขึ้นว่า `file:///...`) จะทำให้:
- ❌ ไฟล์ `.jsx` โหลดไม่ได้ (ถูกบล็อกโดย CORS Policy)
- ❌ Babel Standalone ไม่สามารถ compile JSX ได้
- ❌ หน้าเว็บจะแสดงหน้าว่างเปล่าหรือ Error

> **ต้องเปิดผ่าน HTTP Server เสมอ** (Live Server, npx serve, หรือ Python HTTP Server)

---

## 🔗 การเชื่อมต่อกับ Backend (pageback)

หน้า Frontend จะทำงานร่วมกับ Backend ได้ ต้อง**เปิดทั้ง 2 ฝั่งพร้อมกัน**:

| ฝั่ง | คำสั่งรัน | Port |
|---|---|---|
| **Backend** | `cd pageback && npm start` | `http://localhost:3000` |
| **Frontend** | Live Server หรือ npx serve | `http://localhost:5500` (หรือ 3001) |

### ลำดับการเปิด:
```
1. เปิด Backend ก่อน     →  npm start (ใน pageback/)
2. เปิด Frontend ทีหลัง  →  Live Server (ใน pagefront/)
```

> ⚡ Backend ต้องรันก่อน เพื่อให้ Frontend สามารถเรียก API ได้

---

## 🧪 ทดสอบว่าหน้าเว็บทำงานปกติ

เมื่อเปิดหน้าเว็บสำเร็จ ควรเห็น:
1. ✅ หน้าจอ Loading (Progress Bar สีน้ำเงิน) แสดงผลชั่วครู่
2. ✅ ฟอร์มบันทึกข้อมูลอาจารย์พิเศษปรากฏขึ้น
3. ✅ Dropdown ต่างๆ มีข้อมูลให้เลือก (ปีการศึกษา, คณะ, สาขา ฯลฯ)
4. ✅ กดปุ่มบันทึก → ข้อมูลถูกส่งไปยัง Backend API → บันทึกลง Supabase

### ถ้าเกิด Error:
- เปิด **Developer Tools** (`F12`) → ดูแท็บ **Console** เพื่อตรวจสอบ
- ตรวจสอบว่า Backend กำลังรันอยู่หรือไม่ (ดูที่ Terminal ของ pageback)

---

*อัปเดตล่าสุด: 7 กรกฎาคม 2568*
