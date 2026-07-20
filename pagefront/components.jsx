
// ===== Shared UI Components =====

function SectionHeader({ number, title, subtitle, color = "#1a56db" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      borderBottom: `2px solid ${color}`, paddingBottom: 8, marginBottom: 20
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 15, flexShrink: 0
      }}>{number}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: "#1e293b" }}>{title}</span>
        {subtitle && <span style={{ fontSize: 13, color: "#6b7280" }}>{subtitle}</span>}
      </div>
    </div>
  );
}

function FormRow({ children, cols = 2 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "12px 16px",
      marginBottom: 14
    }}>{children}</div>
  );
}

function FormField({ label, required, children, hint, fullWidth }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: fullWidth ? "1/-1" : undefined }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: "#9ca3af" }}>{hint}</span>}
    </div>
  );
}

const inputStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 7,
  padding: "8px 11px",
  fontSize: 14,
  color: "#1e293b",
  background: "#fff",
  outline: "none",
  transition: "border-color 0.15s",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function TextInput({ value, onChange, placeholder, readOnly, style: extraStyle }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? "#1a56db" : "#d1d5db",
        background: readOnly ? "#f8fafc" : "#fff",
        ...extraStyle
      }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder, style: extraStyle }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      value={value || ""}
      onChange={e => onChange && onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? "#1a56db" : "#d1d5db",
        cursor: "pointer",
        ...extraStyle
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt, i) => (
        <option key={i} value={typeof opt === "object" ? opt.value : opt}>
          {typeof opt === "object" ? opt.label : opt}
        </option>
      ))}
    </select>
  );
}

function SearchableDropdown({ value, onChange, options, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef(null);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          ...inputStyle,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", borderColor: open ? "#1a56db" : "#d1d5db",
          userSelect: "none"
        }}
        onClick={() => { setOpen(!open); setQuery(""); }}
      >
        <span style={{ color: value ? "#1e293b" : "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder || "-- เลือก --"}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 6, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M4 6l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 7,
          boxShadow: "0 4px 16px rgba(0,0,0,0.10)", marginTop: 2
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหา..."
              style={{ ...inputStyle, borderColor: "#d1d5db", fontSize: 13, padding: "6px 9px" }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {query.trim() && !options.some(o => o.toLowerCase() === query.toLowerCase().trim()) && (
              <div
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  color: "#1a56db", fontWeight: "bold", background: "#f0fdf4",
                  borderBottom: "1px solid #cbd5e1"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#dcfce7"}
                onMouseLeave={e => e.currentTarget.style.background = "#f0fdf4"}
                onClick={() => { onChange(query.trim()); setOpen(false); setQuery(""); }}
              >
                ใช้หลักสูตรเเละสาขาที่พิมพ์: "{query.trim()}"
              </div>
            )}
            {filtered.length === 0 ? (
              !query.trim() && <div style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 13 }}>ไม่พบข้อมูล</div>
            ) : filtered.map((opt, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  background: opt === value ? "#eff6ff" : "transparent",
                  color: opt === value ? "#1a56db" : "#1e293b",
                }}
                onMouseEnter={e => e.currentTarget.style.background = opt === value ? "#eff6ff" : "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = opt === value ? "#eff6ff" : "transparent"}
                onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
              >{opt}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DateInput({ value, onChange, placeholder, min, max }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      type="date"
      value={value || ""}
      min={min}
      max={max}
      onChange={e => onChange && onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputStyle, borderColor: focused ? "#1a56db" : "#d1d5db" }}
    />
  );
}

function IconButton({ onClick, children, color = "#ef4444", title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color, padding: "4px 6px", borderRadius: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s"
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >{children}</button>
  );
}

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#eff6ff", border: "1.5px dashed #93c5fd",
        color: "#1a56db", borderRadius: 7, padding: "8px 14px",
        cursor: "pointer", fontSize: 13, fontWeight: 600,
        fontFamily: "inherit", marginTop: 6, transition: "background 0.15s"
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#dbeafe"}
      onMouseLeave={e => e.currentTarget.style.background = "#eff6ff"}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}

function Card({ children, style: extraStyle }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      padding: "20px 22px",
      marginBottom: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      ...extraStyle
    }}>{children}</div>
  );
}

function SubCard({ children, onRemove }) {
  return (
    <div style={{
      background: "#f8fafc",
      borderRadius: 9,
      border: "1px solid #e2e8f0",
      padding: "14px 16px",
      marginBottom: 10,
      position: "relative"
    }}>
      {onRemove && (
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <IconButton onClick={onRemove} title="ลบ">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
      )}
      {children}
    </div>
  );
}

// Export to window
Object.assign(window, {
  SectionHeader, FormRow, FormField,
  TextInput, SelectInput, SearchableDropdown,
  DateInput, IconButton, AddButton, Card, SubCard,
  inputStyle
});
