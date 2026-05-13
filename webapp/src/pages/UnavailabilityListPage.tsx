import { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Unavailability, SlotType } from "../types";

const SLOT_LABELS: Record<SlotType, string> = {
  morning: "早班",
  afternoon: "中班",
  evening: "晚班",
};

export function UnavailabilityListPage() {
  const { firebaseUser, userProfile } = useAuth();
  const isManager = userProfile?.role === "manager";
  const myEmail = firebaseUser?.email ?? "";

  const today = new Date();
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const [entries, setEntries] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const yearStr = String(pickerYear);
    const monthStr = String(pickerMonth).padStart(2, "0");
    const prefix = `${yearStr}-${monthStr}`;

    const constraints = [
      where("date", ">=", `${prefix}-01`),
      where("date", "<=", `${prefix}-31`),
    ];
    if (!isManager) {
      constraints.push(where("userId", "==", myEmail));
    }

    const q = query(collection(db, "unavailability"), ...constraints);
    setLoading(true);
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Unavailability)
        .sort((a, b) => a.date.localeCompare(b.date));
      setEntries(docs);
      setLoading(false);
    });
    return unsub;
  }, [pickerYear, pickerMonth, isManager, myEmail]);

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除這筆請假紀錄？")) return;
    await deleteDoc(doc(db, "unavailability", id));
  };

  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto" }}>
      <Navbar title="請假申請" />

      {/* Month picker */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "1rem",
          padding: "0.75rem",
          background: "#f0f4ff",
          borderRadius: "8px",
        }}
      >
        <select
          value={pickerYear}
          onChange={(e) => setPickerYear(Number(e.target.value))}
          style={{ padding: "0.4rem" }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
        <select
          value={pickerMonth}
          onChange={(e) => setPickerMonth(Number(e.target.value))}
          style={{ padding: "0.4rem" }}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m} 月
            </option>
          ))}
        </select>
        <span style={{ color: "#555", fontSize: "0.9rem" }}>
          共 {entries.length} 筆
        </span>
      </div>

      {loading && <div style={{ color: "#888" }}>載入中…</div>}

      {!loading && entries.length === 0 && (
        <div style={{ color: "#888" }}>此月份無請假紀錄</div>
      )}

      {!loading && entries.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr style={{ background: "#f0f4ff" }}>
              <th style={thStyle}>日期</th>
              {isManager && <th style={thStyle}>姓名</th>}
              <th style={thStyle}>不可上班班別</th>
              <th style={thStyle}>原因</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>{e.date}</td>
                {isManager && <td style={tdStyle}>{e.userDisplayName}</td>}
                <td style={tdStyle}>
                  {e.unavailableSlots.map((s) => SLOT_LABELS[s]).join("、")}
                </td>
                <td style={tdStyle}>{e.reason ?? "—"}</td>
                <td style={tdStyle}>
                  {(isManager || e.userId === myEmail) && (
                    <button
                      onClick={() => handleDelete(e.id!)}
                      style={{
                        padding: "0.2rem 0.6rem",
                        color: "#b91c1c",
                        background: "transparent",
                        border: "1px solid #fca5a5",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      刪除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  borderBottom: "2px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  verticalAlign: "middle",
};
