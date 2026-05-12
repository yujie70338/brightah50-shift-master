import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { db, functions } from "../firebase";
import { MonthlySchedule, ShiftDocument } from "../types";
import { ApplyTemplateModal } from "./ApplyTemplateModal";

interface Props {
  schedule: MonthlySchedule | null;
  scheduleId: string;
  shifts: ShiftDocument[];
  onMonthChange: (id: string) => void;
  isManager: boolean;
}

export function MonthControls({
  schedule,
  scheduleId,
  shifts,
  onMonthChange,
  isManager,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applySuccess, setApplySuccess] = useState("");

  // Month picker state — default to current month
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);

  const selectedId = `${pickerYear}-${String(pickerMonth).padStart(2, "0")}`;

  const handleYearChange = (year: number) => {
    setPickerYear(year);
    const id = `${year}-${String(pickerMonth).padStart(2, "0")}`;
    onMonthChange(id);
  };

  const handleMonthChange = (month: number) => {
    setPickerMonth(month);
    const id = `${pickerYear}-${String(month).padStart(2, "0")}`;
    onMonthChange(id);
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
      {/* Month picker — auto-loads on change */}
      <select
        value={pickerYear}
        onChange={(e) => handleYearChange(Number(e.target.value))}
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
        onChange={(e) => handleMonthChange(Number(e.target.value))}
        style={{ padding: "0.4rem" }}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m} 月
          </option>
        ))}
      </select>

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

      {isManager && (
        <button
          onClick={() => {
            setApplySuccess("");
            setShowApplyModal(true);
          }}
          style={{
            padding: "0.4rem 0.75rem",
            background: "#ede9fe",
            border: "1px solid #a78bfa",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          title="套用週班表模板"
        >
          套用模板
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

      {applySuccess && (
        <span style={{ color: "#059669", fontSize: "0.85rem" }}>
          ✓ {applySuccess}
        </span>
      )}

      {showApplyModal && (
        <ApplyTemplateModal
          scheduleId={scheduleId}
          hasExistingShifts={shifts.some(
            (s) =>
              s.slots.morning.length > 0 ||
              s.slots.afternoon.length > 0 ||
              s.slots.evening.length > 0,
          )}
          onClose={() => setShowApplyModal(false)}
          onSuccess={(msg) => setApplySuccess(msg)}
        />
      )}
    </div>
  );
}
