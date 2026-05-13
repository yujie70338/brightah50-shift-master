import { useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Unavailability, SlotType } from "../types";

const SLOT_LABELS: Record<SlotType, string> = {
  morning: "早班",
  afternoon: "中班",
  evening: "晚班",
};
const SLOTS: SlotType[] = ["morning", "afternoon", "evening"];

interface Props {
  scheduleId: string; // currently viewed month (used as default)
  myEmail: string;
  myDisplayName: string;
  myUnavailability: Unavailability[];
}

export function UnavailabilityPanel({
  scheduleId,
  myEmail,
  myDisplayName,
  myUnavailability,
}: Props) {
  // Independent month picker — defaults to the currently viewed month
  const [initYear, initMonth] = scheduleId.split("-").map(Number);
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(initYear || today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(
    initMonth || today.getMonth() + 1,
  );

  const year = String(pickerYear);
  const month = String(pickerMonth).padStart(2, "0");

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<SlotType[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleSlot = (slot: SlotType) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedDate || selectedSlots.length === 0) {
      setError("請選擇日期與至少一個時段");
      return;
    }
    setSubmitting(true);
    try {
      const entry: Omit<Unavailability, "id"> = {
        userId: myEmail,
        userDisplayName: myDisplayName,
        date: selectedDate,
        unavailableSlots: selectedSlots,
        ...(reason ? { reason } : {}),
      };
      await addDoc(collection(db, "unavailability"), entry);
      setSelectedDate("");
      setSelectedSlots([]);
      setReason("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "unavailability", id));
  };

  const handleUpdate = async (id: string, slots: SlotType[], r?: string) => {
    await updateDoc(doc(db, "unavailability", id), {
      unavailableSlots: slots,
      reason: r ?? "",
    });
  };

  // Build date options for the selected month
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const dateOptions: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dateOptions.push(`${year}-${month}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div
      style={{
        marginTop: "var(--space-6)",
        padding: "var(--space-4)",
        background: "var(--color-warning-bg)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-warning-border)",
      }}
    >
      <h3 className="section-title" style={{ marginTop: 0 }}>提報不可上班時間</h3>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          alignItems: "flex-end",
          marginBottom: "var(--space-4)",
        }}
      >
        {/* Month picker */}
        <select
          className="form-select"
          value={pickerYear}
          onChange={(e) => {
            setPickerYear(Number(e.target.value));
            setSelectedDate("");
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y} 年</option>
          ))}
        </select>
        <select
          className="form-select"
          value={pickerMonth}
          onChange={(e) => {
            setPickerMonth(Number(e.target.value));
            setSelectedDate("");
          }}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m} 月</option>
          ))}
        </select>

        <select
          className="form-select"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          <option value="">— 選擇日期 —</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>{d.slice(-2)} 日</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {SLOTS.map((slot) => (
            <label
              key={slot}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <input
                type="checkbox"
                checked={selectedSlots.includes(slot)}
                onChange={() => toggleSlot(slot)}
                style={{ accentColor: "var(--color-primary)" }}
              />
              {SLOT_LABELS[slot]}
            </label>
          ))}
        </div>

        <input
          className="form-input"
          placeholder="原因（選填）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ flex: "1 1 150px" }}
        />

        <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
          {submitting ? "提交中…" : "提交"}
        </button>
      </form>

      {error && <p className="alert alert-error">{error}</p>}

      {myUnavailability.length > 0 && (
        <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>日期</th>
              <th>時段</th>
              <th>原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {myUnavailability.map((u) => (
              <UnavailabilityRow
                key={u.id}
                entry={u}
                onDelete={() => handleDelete(u.id!)}
                onUpdate={(slots, r) => handleUpdate(u.id!, slots, r)}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function UnavailabilityRow({
  entry,
  onDelete,
  onUpdate,
}: {
  entry: Unavailability;
  onDelete: () => void;
  onUpdate: (slots: SlotType[], reason?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState<SlotType[]>(entry.unavailableSlots);
  const [reason, setReason] = useState(entry.reason ?? "");

  const toggleSlot = (slot: SlotType) =>
    setSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );

  const save = () => {
    onUpdate(slots, reason);
    setEditing(false);
  };

  return (
    <tr>
      <td>{entry.date.slice(-2)} 日</td>
      <td>
        {editing ? (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {(["morning", "afternoon", "evening"] as SlotType[]).map((s) => (
              <label
                key={s}
                style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  checked={slots.includes(s)}
                  onChange={() => toggleSlot(s)}
                />
                {s === "morning" ? "早" : s === "afternoon" ? "中" : "晚"}
              </label>
            ))}
          </div>
        ) : (
          entry.unavailableSlots
            .map((s) =>
              s === "morning" ? "早" : s === "afternoon" ? "中" : "晚",
            )
            .join("、")
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%" }}
          />
        ) : (
          (entry.reason ?? "—")
        )}
      </td>
      <td style={{ display: "flex", gap: "var(--space-2)" }}>
        {editing ? (
          <>
            <button className="btn btn-primary btn-xs" onClick={save}>儲存</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>取消</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>修改</button>
            <button className="btn btn-danger btn-xs" onClick={onDelete}>刪除</button>
          </>
        )}
      </td>
    </tr>
  );
}
