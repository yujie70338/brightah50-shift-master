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
import { useToast } from "../contexts/ToastContext";

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

  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<SlotType[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const isAllDay = selectedSlots.length === 3;

  const toggleAllDay = () => {
    if (isAllDay) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots([...SLOTS]);
    }
  };

  const toggleSlot = (slot: SlotType) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStartDate || selectedSlots.length === 0) {
      showToast("請選擇日期與至少一個時段", "error");
      return;
    }
    const endDate = selectedEndDate || selectedStartDate;
    if (endDate < selectedStartDate) {
      showToast("結束日期不可早於起始日期", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Generate date range (use local date arithmetic to avoid UTC offset)
      const dates: string[] = [];
      const start = new Date(`${selectedStartDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${day}`);
      }
      // Submit all dates in parallel
      await Promise.all(
        dates.map((date) => {
          const entry: Omit<Unavailability, "id"> = {
            userId: myEmail,
            userDisplayName: myDisplayName,
            date,
            unavailableSlots: selectedSlots,
            ...(reason ? { reason } : {}),
          };
          return addDoc(collection(db, "unavailability"), entry);
        }),
      );
      showToast(`已提報 ${dates.length} 天不可上班時間`);
      setSelectedStartDate("");
      setSelectedEndDate("");
      setSelectedSlots([]);
      setReason("");
    } catch (err) {
      showToast(String(err), "error");
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
            setSelectedStartDate("");
            setSelectedEndDate("");
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
            setSelectedStartDate("");
            setSelectedEndDate("");
          }}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m} 月</option>
          ))}
        </select>

        <select
          className="form-select"
          value={selectedStartDate}
          onChange={(e) => setSelectedStartDate(e.target.value)}
        >
          <option value="">— 起始日期 —</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>{d.slice(-2)} 日</option>
          ))}
        </select>

        <select
          className="form-select"
          value={selectedEndDate}
          onChange={(e) => setSelectedEndDate(e.target.value)}
        >
          <option value="">— 結束日期（選填）—</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>{d.slice(-2)} 日</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
              cursor: "pointer",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={toggleAllDay}
              style={{ accentColor: "var(--color-primary)" }}
            />
            全天
          </label>
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
          entry.unavailableSlots.length === 3
            ? "全天"
            : entry.unavailableSlots
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
