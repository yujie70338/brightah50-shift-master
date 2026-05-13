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
    <div className="toolbar-bar">
      {/* Month picker — auto-loads on change */}
      <select
        className="form-select"
        value={pickerYear}
        onChange={(e) => handleYearChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y} 年
          </option>
        ))}
      </select>
      <select
        className="form-select"
        value={pickerMonth}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m} 月
          </option>
        ))}
      </select>

      {isManager && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleCreate}
          disabled={creating}
          title="建立空白月份（管理員）"
        >
          {creating ? "建立中…" : "建立新月份"}
        </button>
      )}

      {isManager && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setApplySuccess("");
            setShowApplyModal(true);
          }}
          title="套用週班表模板"
        >
          套用模板
        </button>
      )}

      {isManager && schedule && (
        <button
          className={`btn btn-sm ${schedule.isPublished ? "btn-warning" : "btn-success"}`}
          onClick={handleTogglePublish}
          disabled={toggling}
          style={{
            background: schedule.isPublished ? "var(--color-warning-bg)" : "var(--color-success-bg)",
            color: schedule.isPublished ? "#92400e" : "var(--color-success)",
            borderColor: schedule.isPublished ? "var(--color-warning-border)" : "var(--color-success-border)",
          }}
        >
          {toggling ? "更新中…" : schedule.isPublished ? "取消發布" : "發布"}
        </button>
      )}

      {schedule?.isPublished && (
        <span className="badge badge-success">正式版本</span>
      )}

      {error && (
        <span style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)" }}>{error}</span>
      )}

      {applySuccess && (
        <span style={{ color: "var(--color-success)", fontSize: "var(--font-size-sm)" }}>
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
