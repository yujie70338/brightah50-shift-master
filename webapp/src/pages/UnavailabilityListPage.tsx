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
    <>
      <Navbar title="萊特動物醫院 - 內部排班" />
    <div className="page-wrapper" style={{ maxWidth: "900px" }}>

      {/* Month picker */}
      <div className="toolbar-bar" style={{ marginBottom: "var(--space-4)" }}>
        <select
          className="form-select"
          value={pickerYear}
          onChange={(e) => setPickerYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y} 年</option>
          ))}
        </select>
        <select
          className="form-select"
          value={pickerMonth}
          onChange={(e) => setPickerMonth(Number(e.target.value))}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m} 月</option>
          ))}
        </select>
        <span style={{ color: "var(--color-gray-500)", fontSize: "var(--font-size-sm)" }}>
          共 {entries.length} 筆
        </span>
      </div>

      {loading && <div className="loading-center"><div className="spinner" /></div>}

      {!loading && entries.length === 0 && (
        <div style={{ color: "var(--color-gray-400)" }}>此月份無請假紀錄</div>
      )}

      {!loading && entries.length > 0 && (
        <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>日期</th>
              {isManager && <th>姓名</th>}
              <th>不可上班班別</th>
              <th>原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                {isManager && <td>{e.userDisplayName}</td>}
                <td>
                  {e.unavailableSlots.map((s) => SLOT_LABELS[s]).join("、")}
                </td>
                <td>{e.reason ?? "—"}</td>
                <td>
                  {(isManager || e.userId === myEmail) && (
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => handleDelete(e.id!)}
                    >
                      刪除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
    </>
  );
}
