import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { db, functions } from "../firebase";
import { MonthlySchedule } from "../types";

interface Props {
  schedule: MonthlySchedule | null;
  scheduleId: string;
  onMonthChange: (id: string) => void;
  isManager: boolean;
}

export function MonthControls({
  schedule,
  scheduleId,
  onMonthChange,
  isManager,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  // Month picker state — default to current month
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);

  const selectedId = `${pickerYear}-${String(pickerMonth).padStart(2, "0")}`;

  const handleLoad = () => {
    onMonthChange(selectedId);
  };

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    try {
      const fn = httpsCallable(functions, "initializeBlankMonth");
      await fn({ year: pickerYear, month: pickerMonth });
      onMonthChange(selectedId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!schedule) return;
    setToggling(true);
    try {
      await updateDoc(doc(db, "monthly_schedules", scheduleId), {
        isPublished: !schedule.isPublished,
      });
    } finally {
      setToggling(false);
    }
  };

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        alignItems: "center",
        marginBottom: "1rem",
        padding: "0.75rem",
        background: "#f0f4ff",
        borderRadius: "8px",
      }}
    >
      {/* Month picker */}
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

      <button onClick={handleLoad} style={{ padding: "0.4rem 0.75rem" }}>
        載入
      </button>

      {isManager && (
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{ padding: "0.4rem 0.75rem" }}
          title="建立空白月份（管理員）"
        >
          {creating ? "建立中…" : "建立新月份"}
        </button>
      )}

      {isManager && schedule && (
        <button
          onClick={handleTogglePublish}
          disabled={toggling}
          style={{
            padding: "0.4rem 0.75rem",
            background: schedule.isPublished ? "#fef3c7" : "#d1fae5",
            border: "1px solid",
            borderColor: schedule.isPublished ? "#f59e0b" : "#10b981",
            borderRadius: "4px",
          }}
        >
          {toggling ? "更新中…" : schedule.isPublished ? "取消發布" : "發布"}
        </button>
      )}

      {schedule?.isPublished && (
        <span
          style={{
            padding: "0.25rem 0.75rem",
            background: "#10b981",
            color: "#fff",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          正式版本
        </span>
      )}

      {error && (
        <span style={{ color: "red", fontSize: "0.85rem" }}>{error}</span>
      )}
    </div>
  );
}
