# SQL สำหรับสร้างตาราง audit_logs — ระบบบันทึก Log ตาม PDPA

> **วิธีใช้:** คัดลอก SQL ด้านล่างนี้ไปรันใน Supabase Dashboard → SQL Editor → New Query → Run

```sql
-- ========================================================
-- 1. สร้างตาราง audit_logs สำหรับบันทึก Log การเข้าถึงข้อมูล
-- ========================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ประเภทของ action ที่เกิดขึ้น
    action TEXT NOT NULL,
    -- เช่น: ADMIN_LOGIN, ADMIN_LOGIN_FAILED, INSERT_INSTRUCTOR,
    --       VIEW_ALL_INSTRUCTORS, UPDATE_INSTRUCTOR, DELETE_INSTRUCTOR
    
    -- รายละเอียดเพิ่มเติม
    details TEXT,
    
    -- IP Address ของผู้เรียก API
    ip_address TEXT,
    
    -- User Agent (Browser/Device ที่ใช้)
    user_agent TEXT,
    
    -- ผู้ใช้ที่ทำ action (admin หรือ anonymous)
    admin_user TEXT DEFAULT 'anonymous',
    
    -- เวลาที่เกิด action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- 2. สร้าง Indexes สำหรับเพิ่มความเร็วในการค้นหา Log
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON public.audit_logs (ip_address);

-- ========================================================
-- 3. เปิดใช้งาน RLS (Row Level Security)
-- ========================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 4. ตั้งค่า Policies
-- ========================================================
-- อนุญาตให้ Backend เขียน Log ได้ (ผ่าน anon key)
CREATE POLICY "Allow inserts for audit logging" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- อนุญาตให้อ่าน Log ได้ (สำหรับ Admin ดูย้อนหลัง)
CREATE POLICY "Allow read access for audit logs" ON public.audit_logs
    USING (true);
```

---

## ตัวอย่างข้อมูลที่จะถูกบันทึก

| action | details | ip_address | admin_user |
|---|---|---|---|
| `ADMIN_LOGIN` | Admin login successful | 127.0.0.1 | admin |
| `ADMIN_LOGIN_FAILED` | Invalid password attempt | 192.168.1.5 | anonymous |
| `INSERT_INSTRUCTOR` | Saved: สมชาย ดีมาก (คณะ ICT) | 127.0.0.1 | anonymous |
| `VIEW_ALL_INSTRUCTORS` | Admin viewed 15 records | 127.0.0.1 | admin |
| `UPDATE_INSTRUCTOR` | Updated ID: abc-123 (สมชาย ดีมาก) | 127.0.0.1 | admin |
| `DELETE_INSTRUCTOR` | Deleted ID: abc-123 | 127.0.0.1 | admin |

---

*อัปเดตล่าสุด: 13 กรกฎาคม 2568*
