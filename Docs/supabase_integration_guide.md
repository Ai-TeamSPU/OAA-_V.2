# คู่มือการติดตั้งระบบจัดเก็บข้อมูล Supabase & แผนรองรับ API จากหน่วยงาน IT

คู่มือนี้อธิบายวิธีการนำสคริปต์ SQL ไปรันบนฐานข้อมูล Supabase รวมถึงหลักการทำงานและการเตรียมพร้อมเพื่อเปลี่ยนเข้าสู่ API จริงของฝ่าย IT ในอนาคต

---

## 1. วิธีการนำ SQL ไปติดตั้งบน Supabase

เมื่อเปิดสร้างโครงการ (Project) บน Supabase เรียบร้อยแล้ว ให้ทำตามขั้นตอนดังนี้เพื่อสร้างตารางข้อมูล:

1.  ลงชื่อเข้าใช้งานหน้าแดชบอร์ด **[Supabase Console](https://supabase.com/dashboard)**
2.  เลือกโปรเจกต์ของคุณที่ต้องการติดตั้ง
3.  ที่แถบเมนูด้านซ้าย (Left Sidebar) ให้หาไอคอน **"SQL Editor"** (รูปโลโก้ `SQL` หรือแผ่นสคริปต์)
4.  คลิกปุ่ม **"New Query"** (หรือสร้างสเปรดชีตว่างเปล่าขึ้นมาใหม่)
5.  คัดลอก (Copy) สคริปต์ SQL ด้านล่างนี้ไปวางในหน้าต่างแก้ไขข้อความ:

```sql
-- ========================================================
-- 1. สร้างตารางสำหรับเก็บข้อมูลผู้กรอกข้อมูลอาจารย์พิเศษ
-- ========================================================
CREATE TABLE IF NOT EXISTS public.instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester TEXT NOT NULL,
    faculty TEXT NOT NULL,
    branch TEXT NOT NULL,
    first_name_th TEXT NOT NULL,
    last_name_th TEXT NOT NULL,
    phone TEXT NOT NULL,
    pdpa_consent BOOLEAN DEFAULT false NOT NULL,
    pdpa_consent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- ข้อมูลชุดประวัติ (เก็บเป็น JSONB เพื่อรองรับ Array อเนกประสงค์)
    educations JSONB DEFAULT '[]'::jsonb NOT NULL,
    experiences JSONB DEFAULT '[]'::jsonb NOT NULL,
    awards JSONB DEFAULT '[]'::jsonb NOT NULL,
    courses JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- ข้อมูลข้อกำหนดและสาขาวิชาเสริม
    qual_subs JSONB DEFAULT '{}'::jsonb NOT NULL,
    qual_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- ข้อมูลดิบทั้งหมดของฟอร์ม
    raw_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- 2. สร้าง Indexes สำหรับเพิ่มความเร็วในการกรองข้อมูลและการค้นหา
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_instructors_semester ON public.instructors (semester);
CREATE INDEX IF NOT EXISTS idx_instructors_faculty ON public.instructors (faculty);
CREATE INDEX IF NOT EXISTS idx_instructors_names ON public.instructors (first_name_th, last_name_th);

-- ========================================================
-- 3. เปิดใช้งาน RLS (Row Level Security) เพื่อความปลอดภัยของข้อมูล
-- ========================================================
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 4. ตั้งค่านโยบายการเข้าถึงข้อมูล (Policies)
-- ========================================================
-- อนุญาตให้ฝั่งหน้าบ้านของทุกคนสามารถยิง INSERT ข้อมูลเข้ามาได้
CREATE POLICY "Allow anonymous inserts" ON public.instructors
    FOR INSERT WITH CHECK (true);

-- อนุญาตให้อ่านและทำรายการได้ชั่วคราวในช่วงพัฒนา (Development)
CREATE POLICY "Allow all access during development" ON public.instructors
    USING (true)
    WITH CHECK (true);
```

6.  คลิกปุ่ม **"Run"** (หรือกดปุ่ม `Cmd + Enter` / `Ctrl + Enter` บนคีย์บอร์ด) ที่มุมขวาบนของหน้าต่าง
7.  เมื่อทำงานสำเร็จ จะแสดงผลข้อความสีเขียวว่า **"Success. No rows returned."** ด้านล่างหน้าต่าง
8.  คุณสามารถตรวจดูตารางข้อมูลจริงได้โดยคลิกไปที่เมนู **"Table Editor"** (รูปตารางสเปรดชีต) ด้านซ้าย แล้วเลือกตาราง `instructors`

---

## 2. วิธีการกรอกข้อมูลการตั้งค่าเชื่อมโยงจากฝั่งหน้าบ้าน

เมื่อเปิดใช้งานฟอร์มหลังการอัปเดตโค้ด:
1.  กดปุ่ม 🔐 **Admin** ที่มุมขวาบนของฟอร์มหลัก และกรอกรหัสผ่าน `123456`
2.  ระบบจะปลดล็อกไอคอนฟันเฟือง ⚙️ **ตั้งค่า API** ให้แสดงขึ้นมา
3.  เมื่อกดเข้าไป จะพบฟิลด์สำหรับตั้งค่าการเชื่อมต่อดังนี้:
    *   **Supabase URL:** นำค่ามาจากโปรเจกต์ Supabase ของคุณ (เมนู Settings > API > Project URL)
    *   **Supabase Anon Key:** คีย์ความปลอดภัยทั่วไป (เมนู Settings > API > Project API keys > anon/public)
4.  กด **บันทึกการเชื่อมต่อ** ระบบจะสลับไปดึงและจัดเก็บข้อมูลออนไลน์บนระบบคลาวด์ของ Supabase ทันที! (หากฟิลด์เหล่านี้ว่างเปล่า ระบบจะเซฟเก็บใน LocalStorage บนเบราว์เซอร์แทนโดยอัตโนมัติ)

---

## 3. วิธีการเตรียมตัวเพื่อรับมือกับ API ของฝ่าย IT ในอนาคต

เมื่อหน่วยงาน IT ส่งรายละเอียด API มาให้ (เช่น อาจจะอยู่ในรูปแบบ API URL เช่น `https://api-it.spu.ac.th/v1/instructors` และการยืนยันสิทธิ์ Token) คุณจะสามารถสลับไปใช้ API ของ IT ได้อย่างง่ายดายโดยการแก้ไขโค้ดที่ **[app.jsx](file:///c:/Users/mmath/.gemini/antigravity-ide/scratch/OAA%20โปรแกรมบันทึกอาจารย์พิเศษ/app.jsx)** ในจุดที่กำหนดไว้ของ `ApiService` ดังนี้ครับ:

### ตัวอย่างการเขียนแก้ไขโค้ดเมื่อเปลี่ยนไปใช้ API จริงของ IT:

```javascript
// ค้นหาตำแหน่งของออบเจกต์ ApiService ในไฟล์ app.jsx
const ApiService = {
  // ...

  // 1. ฟังก์ชันสำหรับการบันทึกประวัติอาจารย์พิเศษ
  saveRecord: async (form) => {
    // ปิดการเซฟเดิม แล้วเปิดใช้ยิงเข้า API ของ IT แทน:
    const response = await fetch("https://api-it.spu.ac.th/v1/instructors", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_IT_TOKEN_HERE" // ตัวอย่างคีย์ตรวจสอบสิทธิ์ของ IT
      },
      body: JSON.stringify(form)
    });
    
    if (!response.ok) {
      throw new Error("ล้มเหลวในการบันทึกข้อมูลเข้า API ของสถาบัน");
    }
    return await response.json();
  },

  // 2. ฟังก์ชันสำหรับการดึงรายการประวัติอาจารย์ทั้งหมดสำหรับหน้าแอดมิน
  fetchRecords: async () => {
    const response = await fetch("https://api-it.spu.ac.th/v1/instructors", {
      method: "GET",
      headers: {
        "Authorization": "Bearer YOUR_IT_TOKEN_HERE"
      }
    });
    
    if (!response.ok) {
      throw new Error("ล้มเหลวในการดึงรายการข้อมูลจาก API ของสถาบัน");
    }
    
    const rawList = await response.json();
    
    // แปลงรูปแบบที่รับกลับมาจาก API ของ IT (ถ้าชื่อฟิลด์แตกต่างไปจากหน้าบ้าน)
    return rawList.map(item => ({
      id: item.id,
      savedAt: item.created_at,
      data: item.data // อิงตามชื่อคีย์ฝั่งหลังบ้านของ IT
    }));
  },

  // 3. ฟังก์ชันการลบรายการประวัติ
  deleteRecord: async (id) => {
    const response = await fetch(`https://api-it.spu.ac.th/v1/instructors/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer YOUR_IT_TOKEN_HERE"
      }
    });
    if (!response.ok) {
      throw new Error("ไม่สามารถสั่งลบประวัติผ่าน API ได้");
    }
    return true;
  }
};
```

ด้วยแนวทางการเขียนโค้ดลักษณะนี้ คุณและทีมงาน IT จะสามารถจัดการแก้ไขระบบหลังบ้านแยกจากตัวแสดงผลหน้าบ้านได้อย่างอิสระและมีความสุขในการพัฒนามากยิ่งขึ้นครับ!
