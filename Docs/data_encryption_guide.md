# คู่มืออธิบายแนวทาง Data Encryption สำหรับข้อมูลอ่อนไหว

> **สถานะ:** อธิบายแนวทางและตัวอย่างเท่านั้น — ยังไม่ลงมือทำ

---

## ปัญหาปัจจุบัน

ข้อมูลส่วนบุคคลของอาจารย์พิเศษ เช่น **ชื่อ, ที่อยู่, เบอร์โทร, อีเมล** ถูกเก็บเป็น **plain text** ใน Supabase ซึ่งหมายความว่า:

- หากมีคนเข้าถึงฐานข้อมูลได้ (เช่น API Key รั่วไหล) จะอ่านข้อมูลได้ทั้งหมดทันที
- ไม่สอดคล้องกับหลักการ "Data Protection at Rest" ตาม พ.ร.บ. PDPA มาตรา 37

---

## แนวทางแก้ไข: AES-256 Encryption

### หลักการทำงาน

```
[ข้อมูลจริง] → เข้ารหัส (Encrypt) → [ข้อมูลที่เข้ารหัสแล้ว] → บันทึกลง Database
[ข้อมูลที่เข้ารหัสแล้ว] → ถอดรหัส (Decrypt) → [ข้อมูลจริง] → แสดงให้ Admin ดู
```

### ตัวอย่างเปรียบเทียบ

| ฟิลด์ | ก่อนเข้ารหัส (plain text) | หลังเข้ารหัส (encrypted) |
|---|---|---|
| phone | `0812345678` | `U2FsdGVkX1+abc123...xyz789` |
| email | `somchai@gmail.com` | `U2FsdGVkX1+def456...uvw012` |
| address | `123 ถนนพหลโยธิน กรุงเทพฯ` | `U2FsdGVkX1+ghi789...rst345` |

> หากมีคนแฮกฐานข้อมูล จะเห็นแค่ข้อความที่เข้ารหัสแล้ว ไม่สามารถอ่านข้อมูลจริงได้

---

## ตัวอย่างโค้ด (Node.js)

### ติดตั้ง library
```bash
npm install crypto-js
```

### ฟังก์ชันเข้ารหัส/ถอดรหัส
```javascript
const CryptoJS = require('crypto-js');

// กุญแจเข้ารหัส — ต้องเก็บใน .env ห้ามเปิดเผย!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'my-secret-encryption-key-2568';

// เข้ารหัส (Encrypt)
function encrypt(text) {
  if (!text) return text;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

// ถอดรหัส (Decrypt)
function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### ตัวอย่างการใช้งานตอนบันทึก (Encrypt before INSERT)
```javascript
// ก่อนส่งข้อมูลเข้า Supabase
const payload = {
  first_name_th: form.firstNameTH,       // ชื่อ — ไม่เข้ารหัส (ใช้ค้นหา)
  last_name_th: form.lastNameTH,         // นามสกุล — ไม่เข้ารหัส (ใช้ค้นหา)
  phone: encrypt(form.phone),            // เบอร์โทร — ⬅️ เข้ารหัส!
  email: encrypt(form.email),            // อีเมล — ⬅️ เข้ารหัส!
  address: encrypt(form.address),        // ที่อยู่ — ⬅️ เข้ารหัส!
  // ... ฟิลด์อื่นๆ ตามปกติ
};
```

### ตัวอย่างการใช้งานตอนอ่าน (Decrypt after SELECT)
```javascript
// หลังดึงข้อมูลจาก Supabase
const decryptedData = {
  ...data,
  phone: decrypt(data.phone),        // ⬅️ ถอดรหัสกลับ
  email: decrypt(data.email),        // ⬅️ ถอดรหัสกลับ
  address: decrypt(data.address),    // ⬅️ ถอดรหัสกลับ
};
```

---

## ข้อควรระวัง

### ⚠️ สิ่งที่ต้องระวังหากใช้ Encryption

1. **กุญแจเข้ารหัส (ENCRYPTION_KEY) ห้ามหาย!**
   - ถ้าเสียกุญแจ → ข้อมูลทั้งหมดจะถอดรหัสไม่ได้อีกเลย
   - ต้อง backup กุญแจไว้ในที่ปลอดภัย (เช่น Password Manager)

2. **ฟิลด์ที่เข้ารหัสจะค้นหาไม่ได้**
   - ข้อมูลที่เข้ารหัสแล้วจะ `WHERE phone = '0812345678'` ไม่ได้
   - ต้องเลือกว่าฟิลด์ไหน "ต้องค้นหา" → ไม่เข้ารหัส
   - ฟิลด์ไหน "ไม่ต้องค้นหา" → เข้ารหัส

3. **Performance**
   - การเข้ารหัส/ถอดรหัสใช้เวลาเพิ่ม (แต่น้อยมากสำหรับข้อมูลข้อความ)

### 📋 สรุปฟิลด์ที่แนะนำ

| ฟิลด์ | เข้ารหัส? | เหตุผล |
|---|---|---|
| `first_name_th` | ❌ ไม่ | ต้องใช้ค้นหาและแสดงผลในรายการ |
| `last_name_th` | ❌ ไม่ | ต้องใช้ค้นหาและแสดงผลในรายการ |
| `phone` | ✅ เข้ารหัส | ข้อมูลอ่อนไหว ไม่จำเป็นต้องค้นหา |
| `email` | ✅ เข้ารหัส | ข้อมูลอ่อนไหว ไม่จำเป็นต้องค้นหา |
| `address` | ✅ เข้ารหัส | ข้อมูลอ่อนไหว ไม่จำเป็นต้องค้นหา |
| `semester` | ❌ ไม่ | ใช้กรองข้อมูล |
| `faculty` | ❌ ไม่ | ใช้กรองข้อมูล |

---

*เอกสารนี้เป็นแนวทาง — เมื่อพร้อมลงมือทำให้แจ้งได้เลย*

*อัปเดตล่าสุด: 13 กรกฎาคม 2568*
