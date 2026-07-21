const { useState, useEffect, useCallback } = React;

const SETTINGS_KEY = "oaa_settings_v3";

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (!saved.apiUrl) saved.apiUrl = "https://oaa-backend-api.onrender.com";
    return saved;
  } catch (e) {
    return { apiUrl: "https://oaa-backend-api.onrender.com" };
  }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
function makeId() { return Math.random().toString(36).slice(2, 9); }

const defaultEdu = () => ({ id: makeId(), level: "", curriculum: "", major: "", institution: "", year: "" });
const defaultWork = () => ({ id: makeId(), position: "", company: "", startDate: "", endDate: "", isCurrent: false, isDirect: false });
const defaultAward = () => ({ id: makeId(), title: "", link: "" });
const defaultCourse = () => ({ id: makeId(), subject: "", credits: "", teachCount: "", proportion: "", degreeLevel: "" });

const defaultForm = () => ({
  semester: "", faculty: "", branch: "",
  titlePrefix: "", titleCustom: "",
  firstNameTH: "", lastNameTH: "", firstNameEN: "", lastNameEN: "",
  phone: "", email: "", address: "",
  educations: [defaultEdu()],
  experiences: [defaultWork()],
  awards: [],
  courses: [defaultCourse()],
  qualSubs: {}, qualFields: {},
  teachingProportion: "",
  teachingHours: "", teachingNote: "",
  expertise: "", note: "",
  pdpaConsent: false
});

// ===== API Service Layer =====
const ApiService = {
  getApiUrl: () => {
    const settings = loadSettings();
    return settings.apiUrl || "http://localhost:3000";
  },

  getHeaders: () => {
    const token = localStorage.getItem("oaa_admin_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  },

  // Health Check — ตรวจสอบว่า Backend พร้อมใช้งานหรือไม่
  healthCheck: async () => {
    try {
      const url = ApiService.getApiUrl() + "/api/health";
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return { ok: false, message: "Server responded with error" };
      const json = await res.json();
      return { ok: true, ...json };
    } catch (e) {
      return { ok: false, message: "ไม่สามารถเชื่อมต่อ Backend Server ได้" };
    }
  },

  // ตรวจจับ Token หมดอายุ
  handleAuthError: async (res) => {
    if (res.status === 401) {
      const json = await res.json().catch(() => ({}));
      if (json.code === 'TOKEN_EXPIRED') {
        localStorage.removeItem("oaa_admin_token");
        Swal.fire({
          icon: 'warning',
          title: 'Session หมดอายุ',
          text: 'Token เข้าสู่ระบบหมดอายุแล้ว กรุณาเข้าสู่ระบบ Admin ใหม่อีกครั้ง',
          confirmButtonColor: '#1a56db'
        }).then(() => window.location.reload());
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error(json.message || 'Unauthorized');
    }
  },

  login: async (password) => {
    const url = ApiService.getApiUrl() + "/api/admin/login";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const json = await res.json();
    if (res.ok && json.status === "success") {
      localStorage.setItem("oaa_admin_token", json.token);
      return true;
    }
    throw new Error(json.message || "รหัสผ่านไม่ถูกต้อง");
  },

  logout: () => {
    localStorage.removeItem("oaa_admin_token");
  },

  fetchRecords: async () => {
    const url = ApiService.getApiUrl() + "/api/instructors";
    const res = await fetch(url, {
      method: "GET",
      headers: ApiService.getHeaders()
    });
    if (!res.ok) {
      await ApiService.handleAuthError(res);
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || "ไม่สามารถดึงข้อมูลได้");
    }
    const json = await res.json();
    return json.data || [];
  },

  saveRecord: async (form) => {
    const url = ApiService.getApiUrl() + "/api/instructors";
    const res = await fetch(url, {
      method: "POST",
      headers: ApiService.getHeaders(),
      body: JSON.stringify(form)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || "ล้มเหลวในการบันทึกข้อมูล");
    }
    return json.data;
  },

  deleteRecord: async (id) => {
    const url = ApiService.getApiUrl() + `/api/instructors/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: ApiService.getHeaders()
    });
    if (!res.ok) {
      await ApiService.handleAuthError(res);
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || "ไม่สามารถลบประวัติได้");
    }
    return true;
  }
};

// ===== Section 1 =====
function Section1({ form, set }) {
  const branches = form.faculty ? getBranchesByFaculty(form.faculty) : [];
  function handleFaculty(v) {
    const nb = getBranchesByFaculty(v);
    set({ faculty: v, branch: nb.length === 1 ? nb[0] : "" });
  }
  function handleBranch(v) {
    set({ branch: v, faculty: getFacultyByBranch(v) || form.faculty });
  }
  return (
    <Card>
      <SectionHeader number="1" title="ข้อมูลภาคการศึกษาและคณะ/สาขาวิชา" color="#1a56db" />
      <FormRow cols={1}>
        <FormField label="ประจำภาคการศึกษา" required>
          <SelectInput value={form.semester} onChange={v => set({ semester: v })} options={SEMESTERS} placeholder="-- เลือกภาคการศึกษา --" />
        </FormField>
      </FormRow>
      <FormRow cols={2}>
        <FormField label="คณะ / School" required>
          <SelectInput value={form.faculty} onChange={handleFaculty} options={FACULTIES} placeholder="-- เลือกคณะ --" />
        </FormField>
        <FormField label="สาขาวิชา / Program" required>
          <SelectInput value={form.branch} onChange={handleBranch} options={branches} placeholder="-- เลือกสาขาวิชา --" />
        </FormField>
      </FormRow>
    </Card>
  );
}

// ===== Section 2 =====
function Section2({ form, set }) {
  const isOther = form.titlePrefix === "อื่นๆ / Other";
  return (
    <Card>
      <SectionHeader number="2" title="ข้อมูลส่วนตัว" color="#0891b2" />
      <FormRow cols={1}>
        <FormField label="คำนำหน้าชื่อ (ภาษาไทย/English)" required>
          <SelectInput value={form.titlePrefix} onChange={v => set({ titlePrefix: v, titleCustom: "" })} options={TITLES} placeholder="-- เลือกคำนำหน้า --" />
        </FormField>
      </FormRow>
      {isOther && (
        <FormRow cols={1}>
          <FormField label="ระบุคำนำหน้า" required>
            <TextInput value={form.titleCustom} onChange={v => set({ titleCustom: v })} placeholder="ระบุคำนำหน้าชื่อ" />
          </FormField>
        </FormRow>
      )}
      <div style={{ marginBottom: 8, marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.05em" }}>ชื่อ-นามสกุล ภาษาไทย</label>
      </div>
      <FormRow cols={1}>
        <FormField label="ชื่อ (ไทย)" required>
          <TextInput value={form.firstNameTH} onChange={v => set({ firstNameTH: v })} placeholder="ชื่อภาษาไทย" />
        </FormField>
      </FormRow>
      <FormRow cols={1}>
        <FormField label="นามสกุล (ไทย)" required>
          <TextInput value={form.lastNameTH} onChange={v => set({ lastNameTH: v })} placeholder="นามสกุลภาษาไทย" />
        </FormField>
      </FormRow>
      <div style={{ marginBottom: 8, marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.05em" }}>First-Last Name (English) (ไม่บังคับกรอก)</label>
      </div>
      <FormRow cols={1}>
        <FormField label="First Name (EN)">
          <TextInput value={form.firstNameEN} onChange={v => set({ firstNameEN: v })} placeholder="First name in English" />
        </FormField>
      </FormRow>
      <FormRow cols={1}>
        <FormField label="Last Name (EN)">
          <TextInput value={form.lastNameEN} onChange={v => set({ lastNameEN: v })} placeholder="Last name in English" />
        </FormField>
      </FormRow>
      <div style={{ marginBottom: 8, marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.05em" }}>ข้อมูลการติดต่อ / Contact Information</label>
      </div>
      <FormRow cols={1}>
        <FormField label="หมายเลขโทรศัพท์" required>
          <TextInput value={form.phone} onChange={v => set({ phone: v })} placeholder="ระบุหมายเลขโทรศัพท์" />
        </FormField>
      </FormRow>
      <FormRow cols={1}>
        <FormField label="ที่อยู่ที่สามารถติดต่อได้" required fullWidth>
          <textarea value={form.address || ""} onChange={e => set({ address: e.target.value })}
            placeholder="ระบุที่อยู่ปัจจุบัน/ที่อยู่ที่สามารถติดต่อได้" rows={2}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
        </FormField>
      </FormRow>
    </Card>
  );
}

// ===== Section 3 =====
function Section3({ form, set }) {
  function updateEdu(id, fields) {
    let newEducations = form.educations.map(e => e.id === id ? { ...e, ...fields } : e);
    let newState = { educations: newEducations };

    if (newEducations[0].id === id && fields.level !== undefined) {
      const newLevel = fields.level;
      if (newLevel === "ปริญญาตรี" || newLevel === "ต่ำกว่าปริญญาตรี") {
        newEducations = [newEducations[0]];
      } else if (newLevel === "ปริญญาโท") {
        if (newEducations.length < 2) {
          newEducations.push({ ...defaultEdu(), level: "ปริญญาตรี" });
        } else if (newEducations.length > 2) {
          newEducations = newEducations.slice(0, 2);
        }
        newState.qualSubs = { ...(form.qualSubs || {}), qual1_a: true };
      } else if (newLevel === "ปริญญาเอก") {
        if (newEducations.length === 1) {
          newEducations.push({ ...defaultEdu(), level: "ปริญญาโท" });
          newEducations.push({ ...defaultEdu(), level: "ปริญญาตรี" });
        } else if (newEducations.length === 2) {
          newEducations.push({ ...defaultEdu(), level: "ปริญญาตรี" });
        } else if (newEducations.length > 3) {
          newEducations = newEducations.slice(0, 3);
        }
      }
    }
    set(newState);
  }
  function addEdu() { set({ educations: [...form.educations, defaultEdu()] }); }
  function removeEdu(id) { set({ educations: form.educations.filter(e => e.id !== id) }); }

  const firstLevel = form.educations[0]?.level;
  let showAddButton = true;
  if (firstLevel === "ปริญญาตรี" || firstLevel === "ต่ำกว่าปริญญาตรี") showAddButton = false;
  else if (firstLevel === "ปริญญาโท") showAddButton = false;
  else if (firstLevel === "ปริญญาเอก") showAddButton = form.educations.length < 3;

  return (
    <Card>
      <SectionHeader number="3" title="วุฒิการศึกษา" subtitle="(วุฒิสัมพันธ์)" color="#7c3aed" />
      <div style={{ fontSize: 12.5, color: "#7c3aed", fontWeight: 600, marginBottom: 14, padding: "6px 12px", background: "#faf5ff", borderRadius: 6, border: "1px solid #e9d5ff" }}>
        📌 โปรดระบุวุฒิการศึกษาสูงสุดก่อน
      </div>
      {form.educations.map((edu, idx) => {
        const isGrad = edu.level === "ปริญญาโท" || edu.level === "ปริญญาเอก";
        const curricula = edu.level ? getCurriculaByLevel(edu.level) : [];
        return (
          <SubCard key={edu.id} onRemove={form.educations.length > 1 ? () => removeEdu(edu.id) : undefined}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 10 }}>วุฒิการศึกษาที่ {idx + 1}</div>
            <FormRow cols={2}>
              <FormField label="ระดับการศึกษา" required>
                <SelectInput value={edu.level} onChange={v => updateEdu(edu.id, { level: v, curriculum: "", major: "" })} options={DEGREE_LEVELS} placeholder="-- เลือกระดับ --" />
              </FormField>
              <FormField label="ปีที่สำเร็จการศึกษา (พ.ศ.)" required>
                <SelectInput value={edu.year} onChange={v => updateEdu(edu.id, { year: v })} options={YEARS} placeholder="-- เลือกปี --" />
              </FormField>
            </FormRow>
            <FormRow cols={1}>
              <FormField label="หลักสูตร" required>
                <SearchableDropdown value={edu.curriculum} onChange={v => updateEdu(edu.id, { curriculum: v })}
                  options={curricula} placeholder={curricula.length ? "-- ค้นหา/เลือกหลักสูตร --" : "-- เลือกระดับการศึกษาก่อน --"} />
              </FormField>
            </FormRow>
            <FormRow cols={1}>
              <FormField label="สถาบันที่สำเร็จการศึกษา" required>
                <SearchableDropdown value={edu.institution} onChange={v => updateEdu(edu.id, { institution: v })} options={INSTITUTIONS} placeholder="-- ค้นหาสถาบัน --" />
              </FormField>
            </FormRow>
          </SubCard>
        );
      })}
    </Card>
  );
}

// ===== Section 4 =====
function Section4({ form, set }) {
  function updateWork(id, fields) {
    set({ experiences: form.experiences.map(e => e.id === id ? { ...e, ...fields } : e) });
  }
  function addWork() { set({ experiences: [...form.experiences, defaultWork()] }); }
  function removeWork(id) { set({ experiences: form.experiences.filter(e => e.id !== id) }); }

  function updateAward(id, fields) {
    set({ awards: form.awards.map(a => a.id === id ? { ...a, ...fields } : a) });
  }
  function addAward() { set({ awards: [...form.awards, defaultAward()] }); }
  function removeAward(id) { set({ awards: form.awards.filter(a => a.id !== id) }); }

  const firstLevel = form.educations?.[0]?.level;
  const isBachelorOrBelow = !firstLevel || firstLevel === "ปริญญาตรี" || firstLevel === "ต่ำกว่าปริญญาตรี";

  return (
    <Card>
      <SectionHeader number="4" title="ประสบการณ์ทำงานและผลงาน" color="#059669" />

      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 12, borderBottom: "1.5px solid #cbd5e1", paddingBottom: 6 }}>
        4.1 ประสบการณ์การทำงาน
      </div>
      {form.experiences.map((work, idx) => {
        const duration = calcDuration(work.startDate, work.isCurrent ? null : work.endDate);
        return (
          <SubCard key={work.id} onRemove={form.experiences.length > 1 ? () => removeWork(work.id) : undefined}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>ประสบการณ์ที่ {idx + 1}</div>
            <FormRow cols={2}>
              <FormField label="ตำแหน่ง / Position" required>
                <TextInput value={work.position} onChange={v => updateWork(work.id, { position: v })} placeholder="ระบุตำแหน่ง" />
              </FormField>
              <FormField label="ชื่อสถานประกอบการ / Company" required>
                <TextInput value={work.company} onChange={v => updateWork(work.id, { company: v })} placeholder="ชื่อบริษัท/องค์กร" />
              </FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="วันที่เริ่มงาน" required>
                <DateInput value={work.startDate} onChange={v => updateWork(work.id, { startDate: v })} />
              </FormField>
              {!work.isCurrent && (
                <FormField label="วันที่สิ้นสุด">
                  <DateInput value={work.endDate} onChange={v => updateWork(work.id, { endDate: v })} />
                </FormField>
              )}
              <FormField label="สถานะและประเภท">
                <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" id={`cur_${work.id}`} checked={work.isCurrent || false}
                      onChange={e => updateWork(work.id, { isCurrent: e.target.checked, endDate: "" })}
                      style={{ width: 16, height: 16, accentColor: "#059669", cursor: "pointer" }} />
                    <label htmlFor={`cur_${work.id}`} style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>ปัจจุบัน</label>
                  </div>
                  {isBachelorOrBelow && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" id={`dir_${work.id}`} checked={work.isDirect || false}
                        onChange={e => updateWork(work.id, { isDirect: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: "#059669", cursor: "pointer" }} />
                      <label htmlFor={`dir_${work.id}`} style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>ประสบการณ์ตรงกับรายวิชาที่สอน</label>
                    </div>
                  )}
                </div>
              </FormField>
            </FormRow>
            {duration && (
              <div style={{ marginTop: 4, padding: "6px 12px", background: "#f0fdf4", borderRadius: 6, border: "1px solid #86efac", fontSize: 13, color: "#166534", fontWeight: 600 }}>
                ⏱ ระยะเวลา: <span style={{ color: "#059669" }}>{duration}</span>
              </div>
            )}
          </SubCard>
        );
      })}
      <div style={{ marginBottom: 24 }}>
        <AddButton onClick={addWork} label="เพิ่มประสบการณ์ทำงาน" />
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 12, borderBottom: "1.5px solid #cbd5e1", paddingBottom: 6 }}>
        4.2 รางวัลและผลงานที่เกี่ยวข้อง
      </div>
      {form.awards && form.awards.map((award, idx) => (
        <SubCard key={award.id} onRemove={() => removeAward(award.id)}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>ผลงาน/รางวัลที่ {idx + 1}</div>
          <FormRow cols={2}>
            <FormField label="ชื่อรางวัล / ผลงานที่เกี่ยวข้อง" required>
              <TextInput value={award.title} onChange={v => updateAward(award.id, { title: v })} placeholder="ระบุชื่อรางวัลหรือผลงาน" />
            </FormField>
            <FormField label="ลิงก์ผลงาน (Link)">
              <TextInput value={award.link} onChange={v => updateAward(award.id, { link: v })} placeholder="ระบุลิงก์ผลงาน เช่น https://example.com/your-work" />
            </FormField>
          </FormRow>
        </SubCard>
      ))}
      <AddButton onClick={addAward} label="เพิ่มรางวัล/ผลงาน" />
    </Card>
  );
}

// ===== Section 5 =====
function Section5({ form, set }) {
  function updateCourse(id, fields) {
    set({ courses: form.courses.map(c => c.id === id ? { ...c, ...fields } : c) });
  }
  function addCourse() { set({ courses: [...form.courses, defaultCourse()] }); }
  function removeCourse(id) { set({ courses: form.courses.filter(c => c.id !== id) }); }

  function handleSelectSubject(courseId, val) {
    const proportion = getProportionFromCode(val);
    updateCourse(courseId, { subject: val, proportion: proportion || "" });
  }

  return (
    <Card>
      <SectionHeader number="5" title="รายวิชาที่สอน" color="#dc6b19" />
      {form.courses.map((course, idx) => {
        const parts = course.subject ? course.subject.split(" - ") : [];
        const codeDisplay = parts[0] || "";
        const nameDisplay = parts.slice(1).join(" - ") || "";
        return (
          <SubCard key={course.id} onRemove={form.courses.length > 1 ? () => removeCourse(course.id) : undefined}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc6b19", marginBottom: 10 }}>รายวิชาที่ {idx + 1}</div>
            <FormRow cols={1}>
              <FormField label="ค้นหาและเลือกรายวิชา" required hint="พิมพ์รหัสหรือชื่อวิชา เช่น LLB301 หรือ กฎหมาย">
                <SearchableDropdown value={course.subject} onChange={v => handleSelectSubject(course.id, v)}
                  options={SUBJECTS} placeholder="-- ค้นหา รหัส / ชื่อวิชา --" />
              </FormField>
            </FormRow>
            <FormRow cols={1}>
              <FormField label="ระดับการศึกษา" required>
                <SelectInput value={course.degreeLevel || ""} onChange={v => updateCourse(course.id, { degreeLevel: v })} options={["ปริญญาเอก", "ปริญญาโท", "ปริญญาตรี"]} placeholder="-- เลือกระดับการศึกษา --" />
              </FormField>
            </FormRow>
            {course.subject && (
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto auto", gap: "8px 12px", alignItems: "start", marginTop: 4 }}>
                <FormField label="รหัสวิชา">
                  <div style={{ ...inputStyle, background: "#f8fafc", color: "#1e293b", fontWeight: 600 }}>{codeDisplay || "—"}</div>
                </FormField>
                <FormField label="ชื่อวิชา">
                  <div style={{ ...inputStyle, background: "#f8fafc", color: "#1e293b" }}>{nameDisplay || "—"}</div>
                </FormField>
                <FormField label="หน่วยกิต" required>
                  <TextInput value={course.credits} onChange={v => updateCourse(course.id, { credits: v })} placeholder="3(3-0-6)" style={{ width: 100 }} />
                </FormField>
              </div>
            )}
            {!course.subject && (
              <FormRow cols={2}>
                <FormField label="หน่วยกิต" required>
                  <TextInput value={course.credits} onChange={v => updateCourse(course.id, { credits: v })} placeholder="3(3-0-6)" />
                </FormField>
              </FormRow>
            )}
          </SubCard>
        );
      })}
      <AddButton onClick={addCourse} label="เพิ่มรายวิชา" />
    </Card>
  );
}

// ===== Section 6 =====
function Section6({ form, set }) {
  const qualGroups = [
    {
      key: "g1", result: "อาจารย์พิเศษ", color: "#1a56db",
      label: "กลุ่มที่ 1",
      subs: [
        { key: "qual1_a", label: "อาจารย์ผู้สอน อาจเป็นอาจารย์ประจำหรืออาจารย์พิเศษที่มีคุณวุฒิขั้นต่ำปริญญาโทหรือเทียบเท่า" }
      ]
    },
    {
      key: "g2", result: "อาจารย์พิเศษร่วมสอน", color: "#059669",
      label: "กลุ่มที่ 2",
      subs: [
        { key: "qual2_a", label: "คุณวุฒิปริญญาตรี และมีประสบการณ์ทำงานในภาคอุตสาหกรรมที่เกี่ยวข้องมาเเล้วไม่น้อยกว่า 5 ปี", hasExp: true, expKey: "exp2" },
        { key: "qual2_c", label: "มีความรู้และประสบการณ์เป็นที่ยอมรับซึ่งตรงหรือสัมพันธ์กับรายวิชาที่สอน หรือผลงานเป็นที่ประจักษ์ในวิชาชีพ" },
      ]
    },
    {
      key: "g3", result: "อาจารย์พิเศษช่วยสอน", color: "#dc6b19",
      label: "กลุ่มที่ 3",
      subs: [
        { key: "qual3_a", label: "คุณวุฒิปริญญาตรี และมีประสบการณ์ทำงานในภาคอุตสาหกรรม อย่างต่อเนื่องมาแล้วไม่เกิน 5 ปี", hasExp: true, expKey: "exp3" },
      ]
    },
  ];

  const subs = form.qualSubs || {};
  const fields = form.qualFields || {};

  function toggleSub(key) { set({ qualSubs: { ...subs, [key]: !subs[key] } }); }
  function setField(key, val) { set({ qualFields: { ...fields, [key]: val } }); }

  function handleExpDate(expKey, field, val) {
    const newFields = { ...fields, [`${expKey}_${field}`]: val };
    set({ qualFields: newFields });
  }

  function getExpMonths(startDate, endDate) {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months > 0 ? months : 0;
  }
  const totalDirectMonths = form.experiences
    .filter(w => w.isDirect)
    .reduce((acc, w) => acc + getExpMonths(w.startDate, w.isCurrent ? null : w.endDate), 0);
  const totalDirectExpYears = totalDirectMonths / 12;

  let totalDirectExpString = "";
  if (totalDirectMonths > 0) {
    const years = Math.floor(totalDirectMonths / 12);
    const rem = totalDirectMonths % 12;
    if (years === 0) totalDirectExpString = `${rem} เดือน`;
    else if (rem === 0) totalDirectExpString = `${years} ปี`;
    else totalDirectExpString = `${years} ปี ${rem} เดือน`;
  } else {
    totalDirectExpString = "0 เดือน (กรุณาเพิ่มประสบการณ์ตรงในหัวข้อที่ 4)";
  }

  const firstLevel = form.educations[0]?.level;
  let displayGroups = qualGroups;
  if (firstLevel === "ปริญญาตรี" || firstLevel === "ต่ำกว่าปริญญาตรี") {
    if (totalDirectExpYears >= 5) {
      displayGroups = qualGroups.filter(g => g.key === "g2");
    } else {
      displayGroups = qualGroups.filter(g => g.key === "g3");
    }
  } else if (firstLevel === "ปริญญาโท" || firstLevel === "ปริญญาเอก") {
    displayGroups = qualGroups.filter(g => g.key === "g1");
  }

  return (
    <Card>
      <SectionHeader number="6" title={
        <span>
          คุณสมบัติ (โปรดระบุ ✓ ข้อคุณสมบัติอาจารย์)
          <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
        </span>
      } color="#7c3aed" />
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>เลือกคุณสมบัติที่ตรงกับผู้สมัคร — เลือกได้มากกว่า 1 ข้อ</div>
      {displayGroups.map((group) => {
        const selected = group.subs.some(s => subs[s.key]);
        return (
          <div key={group.key} style={{
            marginBottom: 12, border: `1.5px solid ${selected ? group.color : "#e2e8f0"}`,
            borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s"
          }}>
            <div style={{ background: selected ? group.color + "12" : "#f8fafc", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", flex: 1 }}>{group.label}</div>
              {selected && <div style={{ background: group.color, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{group.result}</div>}
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {group.subs.map(sub => {
                const expDuration = sub.hasExp ? calcDuration(fields[`${sub.expKey}_from`], fields[`${sub.expKey}_to`]) : null;
                return (
                  <div key={sub.key}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <input type="checkbox" id={sub.key} checked={subs[sub.key] || false} onChange={() => toggleSub(sub.key)}
                        style={{ width: 16, height: 16, marginTop: 2, accentColor: group.color, cursor: "pointer", flexShrink: 0 }} />
                      <label htmlFor={sub.key} style={{ fontSize: 13, color: "#374151", cursor: "pointer", lineHeight: 1.5 }}>{sub.label}</label>
                    </div>
                    {sub.hasField && subs[sub.key] && (
                      <div style={{ marginLeft: 24, marginTop: 6 }}>
                        <TextInput value={fields[sub.hasField] || ""} onChange={v => setField(sub.hasField, v)}
                          placeholder={sub.fieldPlaceholder || "ระบุสาขาวิชาตามตำแหน่งวิชาการ..."} style={{ maxWidth: 360 }} />
                      </div>
                    )}
                    {sub.hasExp && subs[sub.key] && (
                      <div style={{ marginLeft: 24, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "10px 12px", marginTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>ระยะเวลาประสบการณ์ตรง (คำนวณอัตโนมัติจากหัวข้อที่ 4)</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: group.color }}>
                          ⏱ รวม: {totalDirectExpString}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ===== Section 7 =====
function Section7({ form, set, onOpenPdpa }) {
  const handleToggle = () => {
    if (!form.pdpaConsent) {
      onOpenPdpa();
    } else {
      set({ pdpaConsent: false });
    }
  };

  return (
    <Card>
      <SectionHeader number="7" title="ความยินยอมข้อมูลส่วนบุคคล (PDPA)" color="#9333ea" />
      <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", cursor: "pointer", gap: 10 }} onClick={handleToggle}>
          <input type="checkbox" checked={form.pdpaConsent || false} readOnly
            style={{ width: 18, height: 18, marginTop: 2, cursor: "pointer", accentColor: "#9333ea" }} />
          <span style={{ fontSize: 13, lineHeight: 1.6, color: "#334155", userSelect: "none" }}>
            <span style={{ color: "#ef4444", marginRight: 4, fontWeight: "bold" }}>*</span>
            <b>ความยินยอมข้อมูลส่วนบุคคล (PDPA):</b> ข้าพเจ้ายินยอมให้ มหาวิทยาลัยศรีปทุม เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า เพื่อวัตถุประสงค์ในการบันทึกข้อมูลอาจารย์พิเศษเเละใช้ภายในมหาลัย ตามที่ระบุไว้ในนโยบายความเป็นส่วนตัว
          </span>
        </div>
      </div>
    </Card>
  );
}

// ===== Settings Modal =====
function SettingsModal({ onClose }) {
  const [apiUrl, setApiUrl] = useState(loadSettings().apiUrl || "http://localhost:3000");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  function handleSave() {
    saveSettings({ apiUrl });
    onClose();
    window.location.reload();
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(apiUrl + "/api/instructors/test-connection-ping").catch(e => e);
      setTestResult({ ok: true, msg: "✓ เชื่อมต่อ Backend Server สำเร็จ!" });
    } catch (e) {
      setTestResult({ ok: false, msg: "✕ เชื่อมต่อไม่สำเร็จ: " + e.message });
    }
    setTesting(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, padding: 20, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>⚙️ ตั้งค่าการเชื่อมต่อ Backend</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Backend Server API URL</label>
            <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:3000" style={{ ...inputStyle, width: "100%" }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>ที่อยู่ของเซิร์ฟเวอร์หลังบ้าน เช่น http://localhost:3000 หรือโดเมน API จริง</span>
          </div>
          {testResult && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: testResult.ok ? "#059669" : "#ef4444", background: testResult.ok ? "#f0fdf4" : "#fef2f2", padding: "8px 12px", borderRadius: 6 }}>
              {testResult.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={handleTest} disabled={testing} style={{ flex: 1, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#334155" }}>
              {testing ? "กำลังทดสอบ..." : "⚡ ทดสอบเชื่อมต่อ"}
            </button>
            <button type="button" onClick={handleSave} style={{ flex: 1, background: "linear-gradient(135deg,#1a56db,#2563eb)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              บันทึกการตั้งค่า
            </button>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569" }}>
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Saved Records List =====
function RecordsList({ records, onLoad, onDelete, onPreview, onDownload }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredRecords = records.filter(rec => {
    const term = search.toLowerCase();
    const fullName = `${rec.data.firstNameTH || ""} ${rec.data.lastNameTH || ""}`.toLowerCase();
    const subCode = rec.data.courses?.[0]?.subject?.toLowerCase() || "";
    return fullName.includes(term) || subCode.includes(term) || (rec.data.faculty || "").toLowerCase().includes(term);
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (records.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", fontFamily: "inherit", width: "100%", justifyContent: "space-between" }}>
        <span>📋 รายชื่อที่ค้นหาและบันทึกไว้ ({filteredRecords.length} รายการ)</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M4 6l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#fff", animation: "slideIn 0.2s ease" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
            <input type="text" placeholder="🔍 ค้นหาด้วย ชื่อ นามสกุล หรือวิชาที่สอน..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "100%", fontSize: 12 }} />
          </div>
          <div>
            {paginatedRecords.length ? paginatedRecords.map((rec, i) => (
              <div key={rec.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < paginatedRecords.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{rec.data.titlePrefix} {rec.data.firstNameTH} {rec.data.lastNameTH}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{rec.data.faculty} · {rec.data.semester} · {new Date(rec.savedAt).toLocaleDateString("th-TH")}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => onPreview(rec.id)} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#1d4ed8", fontWeight: 600, fontFamily: "inherit" }}>👁️ แสดงตัวอย่าง</button>
                  <button type="button" onClick={() => onDownload(rec.id)} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#15803d", fontWeight: 600, fontFamily: "inherit" }}>📥 ดาวน์โหลด</button>
                  <button type="button" onClick={() => onLoad(rec)} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#475569", fontWeight: 600, fontFamily: "inherit" }}>✏️ โหลดฟอร์ม</button>
                  <button type="button" onClick={() => onDelete(rec.id)} style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#b91c1c", fontWeight: 600, fontFamily: "inherit" }}>🗑️ ลบ</button>
                </div>
              </div>
            )) : (
              <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>ไม่พบรายชื่อที่ค้นหา</div>
            )}
          </div>
          {filteredRecords.length > itemsPerPage && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 4px", borderTop: "1px solid #e2e8f0", marginTop: 8 }}>
              <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ background: currentPage === 1 ? "#f8fafc" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 12px", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12, color: currentPage === 1 ? "#94a3b8" : "#475569", fontWeight: 600, fontFamily: "inherit" }}>
                ← ก่อนหน้า
              </button>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                หน้าที่ {currentPage} จาก {totalPages}
              </span>
              <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ background: currentPage === totalPages ? "#f8fafc" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 12px", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 12, color: currentPage === totalPages ? "#94a3b8" : "#475569", fontWeight: 600, fontFamily: "inherit" }}>
                ถัดไป →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== PDPA Consent Modal =====
function PdpaModal({ isOpen, onClose, onAccept }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.25s ease-out" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", animation: "scaleUp 0.25s ease-out" }}>
        <div style={{ background: "linear-gradient(135deg,#1e3a8a,#1a56db)", borderRadius: "14px 14px 0 0", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>🔒 ความยินยอมข้อมูลส่วนบุคคล (PDPA)</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>หนังสือแจ้งการประมวลผลข้อมูลส่วนบุคคล (Privacy Notice)</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 10px", fontSize: 16, fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", fontSize: 13, lineHeight: 1.7, color: "#334155", flex: 1 }}>
          <p style={{ fontWeight: 700, marginTop: 0 }}>หนังสือแจ้งการประมวลผลข้อมูลส่วนบุคคล (Privacy Notice)<br />สำหรับการบันทึกข้อมูลอาจารย์พิเศษ — มหาวิทยาลัยศรีปทุม</p>

          <p style={{ textIndent: "24px" }}>
            มหาวิทยาลัยศรีปทุม ("มหาวิทยาลัย") ตระหนักถึงความสำคัญของการคุ้มครองข้อมูลส่วนบุคคลของท่าน
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ("พ.ร.บ. PDPA") จึงขอแจ้งรายละเอียดเกี่ยวกับ
            การเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน ดังต่อไปนี้
          </p>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>1. ข้อมูลส่วนบุคคลที่เก็บรวบรวม</p>
          <ul style={{ paddingLeft: 24, marginTop: 4 }}>
            <li>ชื่อ-นามสกุล (ภาษาไทยและภาษาอังกฤษ)</li>
            <li>ที่อยู่ หมายเลขโทรศัพท์ และอีเมล</li>
            <li>ประวัติการศึกษา คุณวุฒิ และสถาบันที่สำเร็จการศึกษา</li>
            <li>ประวัติการทำงานและประสบการณ์วิชาชีพ</li>
            <li>ผลงานทางวิชาการ ผลงานวิจัย และรางวัล</li>
            <li>ข้อมูลรายวิชาที่สอนและสัดส่วนการสอน</li>
          </ul>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>2. วัตถุประสงค์ในการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคล</p>
          <ul style={{ paddingLeft: 24, marginTop: 4 }}>
            <li>เพื่อบันทึกและจัดเก็บข้อมูลอาจารย์พิเศษในระบบของมหาวิทยาลัย</li>
            <li>เพื่อประกอบการพิจารณาคุณสมบัติและคุณวุฒิของอาจารย์พิเศษ</li>
            <li>เพื่อใช้ในการจัดทำรายงานและเอกสารภายในมหาวิทยาลัย</li>
            <li>เพื่อการติดต่อสื่อสารที่เกี่ยวข้องกับการปฏิบัติงาน</li>
            <li>เพื่อปฏิบัติตามกฎหมาย ระเบียบ และข้อบังคับที่เกี่ยวข้อง</li>
          </ul>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>3. ระยะเวลาในการเก็บรักษาข้อมูล</p>
          <p style={{ textIndent: "24px" }}>
            มหาวิทยาลัยจะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้ตลอดระยะเวลาที่ท่านยังคงปฏิบัติหน้าที่เป็นอาจารย์พิเศษ
            และจะเก็บรักษาต่อไปอีกไม่เกิน 1 ปี หลังจากสิ้นสุดการปฏิบัติหน้าที่ เว้นแต่กฎหมายจะกำหนดไว้เป็นอย่างอื่น
          </p>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>4. สิทธิของเจ้าของข้อมูลส่วนบุคคล</p>
          <p style={{ textIndent: "24px" }}>ท่านมีสิทธิตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ดังนี้</p>
          <ul style={{ paddingLeft: 24, marginTop: 4 }}>
            <li><b>สิทธิในการเข้าถึง</b> — ขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคลของท่าน</li>
            <li><b>สิทธิในการแก้ไข</b> — ขอแก้ไขข้อมูลส่วนบุคคลให้ถูกต้อง เป็นปัจจุบัน และไม่ก่อให้เกิดความเข้าใจผิด</li>
            <li><b>สิทธิในการลบ</b> — ขอให้ลบหรือทำลายข้อมูลส่วนบุคคล เมื่อข้อมูลหมดความจำเป็น</li>
            <li><b>สิทธิในการระงับ</b> — ขอให้ระงับการใช้ข้อมูลส่วนบุคคลในบางกรณี</li>
            <li><b>สิทธิในการคัดค้าน</b> — คัดค้านการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคล</li>
            <li><b>สิทธิในการถอนความยินยอม</b> — ถอนความยินยอมเมื่อใดก็ได้ โดยไม่กระทบต่อความชอบด้วยกฎหมาย</li>
            <li><b>สิทธิในการร้องเรียน</b> — ร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล หากเห็นว่ามีการฝ่าฝืน พ.ร.บ.</li>
          </ul>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>5. การรักษาความมั่นคงปลอดภัยของข้อมูล</p>
          <p style={{ textIndent: "24px" }}>
            มหาวิทยาลัยจัดให้มีมาตรการรักษาความมั่นคงปลอดภัยที่เหมาะสม เพื่อป้องกันการสูญหาย เข้าถึง ใช้ เปลี่ยนแปลง
            แก้ไข หรือเปิดเผยข้อมูลส่วนบุคคลโดยไม่มีอำนาจหรือโดยมิชอบ ทั้งนี้เป็นไปตามมาตรา 37 แห่ง พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </p>

          <p style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 14 }}>6. ช่องทางการติดต่อ</p>
          <p style={{ textIndent: "24px" }}>
            หากท่านมีข้อสงสัยหรือต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล สามารถติดต่อได้ที่<br />
            <b>สำนักงานอธิการบดี มหาวิทยาลัยศรีปทุม</b><br />
            2410/2 ถนนพหลโยธิน แขวงเสนานิคม เขตจตุจักร กรุงเทพมหานคร 10900<br />
            โทรศัพท์: 0-2579-1111<br />
            อีเมล: pdpa@spu.ac.th
          </p>

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 16px", marginTop: 16 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#1e3a8a", fontSize: 13 }}>📌 การให้ความยินยอม</p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#334155" }}>
              การกดปุ่ม "ยินยอมและรับทราบ" ด้านล่าง ถือว่าท่านได้อ่านและเข้าใจรายละเอียดข้างต้นแล้ว
              และยินยอมให้มหาวิทยาลัยเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่านตามวัตถุประสงค์ที่ระบุไว้
            </p>
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, background: "#f8fafc", borderRadius: "0 0 14px 14px" }}>
          <button type="button" onClick={onClose} style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: "inherit" }}>
            ❌ ปิดหน้าต่าง
          </button>
          <button type="button" onClick={onAccept} style={{ background: "linear-gradient(135deg,#059669,#10b981)", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(5,150,105,0.3)" }}>
            ✅ ยินยอมและรับทราบ
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Toast =====
function Toast({ message, type, onHide }) {
  useEffect(() => { const t = setTimeout(onHide, 2800); return () => clearTimeout(t); }, []);
  const bg = type === "success" ? "#059669" : type === "error" ? "#ef4444" : "#1a56db";
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: bg, color: "#fff", borderRadius: 10, padding: "12px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.18)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, maxWidth: 320, animation: "slideIn 0.25s ease" }}>
      <span>{type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
      {message}
    </div>
  );
}

// ===== Main App Component =====
function App() {
  const [form, setFormRaw] = useState(defaultForm);
  const [records, setRecords] = useState([]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPdpaModal, setShowPdpaModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ตรวจสอบ token ที่มีอยู่
  useEffect(() => {
    const token = localStorage.getItem("oaa_admin_token");
    if (token) {
      setIsAdmin(true);
    }
  }, []);

  // Health Check — ตรวจสอบว่า Backend พร้อมใช้งานหรือไม่
  useEffect(() => {
    ApiService.healthCheck().then(result => {
      if (!result.ok) {
        console.warn("Backend health check failed:", result.message);
        Swal.fire({
          icon: 'warning',
          title: 'ไม่สามารถเชื่อมต่อ Server ได้',
          html: `<p>ระบบไม่สามารถเชื่อมต่อกับ Backend Server ได้</p><p style="font-size:13px;color:#6b7280;">กรุณาตรวจสอบว่า Backend (pageback) กำลังทำงานอยู่<br/>URL: ${ApiService.getApiUrl()}</p>`,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#1a56db'
        });
      } else {
        console.log("✓ Backend health check: OK", result);
      }
    });
  }, []);

  // โหลดข้อมูลเมื่อเป็น Admin
  useEffect(() => {
    if (isAdmin) {
      ApiService.fetchRecords().then(setRecords).catch(e => {
        if (e.message === 'TOKEN_EXPIRED') return; // จัดการใน handleAuthError แล้ว
        console.error(e);
        showToast("ไม่สามารถโหลดประวัติจากเซิร์ฟเวอร์หลังบ้านได้: " + e.message, "error");
      });
    }
  }, [isAdmin]);

  function set(fields) { setFormRaw(f => ({ ...f, ...fields })); }
  function showToast(message, type = "success") { setToast({ message, type }); }

  function handleAdminLogin() {
    Swal.fire({
      title: 'โหมด Admin',
      input: 'password',
      inputLabel: 'กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานโหมด Admin',
      inputPlaceholder: 'ใส่รหัสผ่านที่นี่...',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1a56db',
      cancelButtonColor: '#6b7280'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const success = await ApiService.login(result.value);
          if (success) {
            setIsAdmin(true);
            showToast("เข้าสู่โหมด Admin แล้ว", "success");
          }
        } catch (e) {
          Swal.fire({
            icon: 'error',
            title: 'ผิดพลาด!',
            text: e.message,
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  }

  async function handleSave() {
    if (!form.semester || !form.faculty || !form.branch) { showToast("กรุณากรอกข้อมูลภาคการศึกษา คณะ และสาขาวิชา", "error"); return; }
    if (!form.firstNameTH || !form.lastNameTH) { showToast("กรุณากรอกชื่อ-นามสกุล (ภาษาไทย)", "error"); return; }
    if (!form.phone) { showToast("กรุณากรอกหมายเลขโทรศัพท์", "error"); return; }
    if (!form.address) { showToast("กรุณากรอกที่อยู่ที่สามารถติดต่อได้", "error"); return; }
    if (!form.pdpaConsent) { showToast("กรุณากดยอมรับการเก็บรวบรวมข้อมูลส่วนบุคคล (PDPA) ในข้อ 7 ก่อนบันทึกข้อมูล", "error"); return; }

    const firstLevel = form.educations?.[0]?.level;
    const totalDirectMonths = (form.experiences || [])
      .filter(w => w.isDirect)
      .reduce((acc, w) => {
        if (!w.startDate) return acc;
        const start = new Date(w.startDate);
        const end = w.isCurrent ? new Date() : new Date(w.endDate);
        const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return acc + (diff > 0 ? diff : 0);
      }, 0);
    const totalDirectExpYears = totalDirectMonths / 12;

    let activeKeys = [];
    if (firstLevel === "ปริญญาตรี" || firstLevel === "ต่ำกว่าปริญญาตรี") {
      if (totalDirectExpYears >= 5) {
        activeKeys = ["qual2_a", "qual2_c"];
      } else {
        activeKeys = ["qual3_a"];
      }
    } else if (firstLevel === "ปริญญาโท" || firstLevel === "ปริญญาเอก") {
      activeKeys = ["qual1_a"];
    }

    const hasQual = activeKeys.some(key => form.qualSubs?.[key]);
    if (activeKeys.length > 0 && !hasQual) {
      showToast("กรุณาเลือก (✓) คุณสมบัติของอาจารย์อย่างน้อย 1 ข้อ ในข้อ 6", "error");
      return;
    }

    setSaving(true);
    try {
      await ApiService.saveRecord(form);
      showToast("บันทึกข้อมูลเข้าฐานข้อมูลหลักสำเร็จ!", "success");
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'ส่งข้อมูลบันทึกประวัติอาจารย์พิเศษไปยังระบบคลาวด์เรียบร้อยแล้ว!',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#1a56db'
      }).then(() => {
        setFormRaw(defaultForm());
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (isAdmin) {
          ApiService.fetchRecords().then(setRecords).catch(console.error);
        }
      });
    } catch (e) {
      showToast("เกิดข้อผิดพลาด: " + e.message, "error");
      Swal.fire({
        icon: 'error',
        title: 'ล้มเหลว!',
        text: 'ไม่สามารถบันทึกข้อมูลเข้าฐานข้อมูลได้: ' + e.message,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef4444'
      });
    }
    setSaving(false);
  }

  function handleClear() {
    if (window.confirm("ต้องการล้างข้อมูลในฟอร์มทั้งหมด?")) {
      setFormRaw(defaultForm());
      showToast("ล้างข้อมูลเรียบร้อยแล้ว", "info");
    }
  }

  function handleLoad(rec) {
    setFormRaw({ ...defaultForm(), ...rec.data });
    showToast("โหลดข้อมูลเรียบร้อยแล้ว", "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (window.confirm("ต้องการลบข้อมูลประวัตินี้ออกจากฐานข้อมูลคลาวด์?")) {
      try {
        await ApiService.deleteRecord(id);
        setRecords(records.filter(r => r.id !== id));
        showToast("ลบข้อมูลประวัติเรียบร้อยแล้ว", "info");
      } catch (e) {
        showToast("ลบข้อมูลล้มเหลว: " + e.message, "error");
      }
    }
  }

  function handlePreview(id) {
    if (typeof id === 'number' || (typeof id === 'string' && id)) {
      window.open("index-print.html?id=" + id, "_blank");
    } else if (form.id) {
      window.open("index-print.html?id=" + form.id, "_blank");
    } else {
      sessionStorage.setItem("oaa_print_temp_form", JSON.stringify(form));
      window.open("index-print.html?temp=1", "_blank");
    }
  }

  function handleDownload(id) {
    if (typeof id === 'number' || (typeof id === 'string' && id)) {
      window.open("index-print.html?id=" + id + "&autoPrint=1", "_blank");
    } else if (form.id) {
      window.open("index-print.html?id=" + form.id + "&autoPrint=1", "_blank");
    } else {
      sessionStorage.setItem("oaa_print_temp_form", JSON.stringify(form));
      window.open("index-print.html?temp=1&autoPrint=1", "_blank");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1a56db 100%)", color: "#fff", boxShadow: "0 2px 12px rgba(26,86,219,0.3)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, background: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🎓</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>บันทึกข้อมูลอาจารย์พิเศษ</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Adjunct Instructor Information System · มหาวิทยาลัยศรีปทุม</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {!isAdmin && (
                <button type="button" onClick={handleAdminLogin}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                  🔐 Admin
                </button>
              )}
              {isAdmin && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setShowSettings(true)}
                    style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                    ⚙️ ตั้งค่า API
                  </button>
                  <button type="button" onClick={() => {
                    ApiService.logout();
                    setIsAdmin(false);
                    setRecords([]);
                    showToast("ออกจากระบบ Admin แล้ว", "info");
                  }}
                    style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                    🚪 ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px" }}>
        <RecordsList records={records} onLoad={handleLoad} onDelete={handleDelete} onPreview={handlePreview} onDownload={handleDownload} />
        <Section1 form={form} set={set} />
        <Section2 form={form} set={set} />
        <Section3 form={form} set={set} />
        <Section4 form={form} set={set} />
        <Section5 form={form} set={set} />
        <Section6 form={form} set={set} />
        <Section7 form={form} set={set} onOpenPdpa={() => setShowPdpaModal(true)} />

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ background: saving ? "#93c5fd" : "linear-gradient(135deg,#1a56db,#2563eb)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(26,86,219,0.25)" }}>
            {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
          </button>
          <button type="button" onClick={() => handlePreview()}
            style={{ background: "#fff", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
            👁️ แสดงตัวอย่าง
          </button>
          <button type="button" onClick={() => handleDownload()}
            style={{ background: "#fff", color: "#15803d", border: "1px solid #86efac", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
            📥 ดาวน์โหลด PDF
          </button>
          <button type="button" onClick={handleClear}
            style={{ background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
            🗑 ล้างฟอร์ม
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <PdpaModal isOpen={showPdpaModal} onClose={() => setShowPdpaModal(false)} onAccept={() => { set({ pdpaConsent: true }); setShowPdpaModal(false); }} />
      {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}

      <style>{`
        @keyframes slideIn { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
