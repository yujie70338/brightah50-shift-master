import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { DayOfWeek, ShiftSlots, WeeklyTemplate } from "../types";
import { useTemplates } from "../hooks/useTemplates";

const DAYS: DayOfWeek[] = ["日", "一", "二", "三", "四", "五", "六"];
const SLOT_LABELS: Record<keyof ShiftSlots, string> = {
  morning: "早",
  afternoon: "中",
  evening: "晚",
};

interface Props {
  scheduleId: string; // "YYYY-MM" — current month being viewed
  hasExistingShifts: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function TemplatePreview({ template }: { template: WeeklyTemplate }) {
  return (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        fontSize: "var(--font-size-xs)",
        marginTop: "var(--space-2)",
      }}
    >
      <thead>
        <tr>
          <th style={thStyle}>時段</th>
          {DAYS.map((d) => (
            <th key={d} style={thStyle}>
              週{d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(["morning", "afternoon", "evening"] as (keyof ShiftSlots)[]).map(
          (slot) => (
            <tr key={slot}>
              <td style={tdStyle}>{SLOT_LABELS[slot]}</td>
              {DAYS.map((d) => (
                <td key={d} style={{ ...tdStyle, textAlign: "center" }}>
                  {template.days[d][slot].length > 0
                    ? `${template.days[d][slot].length} 人`
                    : "—"}
                </td>
              ))}
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  background: "var(--color-primary-light)",
  border: "1px solid var(--color-border)",
  fontWeight: 600,
  textAlign: "center",
  color: "var(--color-gray-700)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  border: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

export function ApplyTemplateModal({
  scheduleId,
  hasExistingShifts,
  onClose,
  onSuccess,
}: Props) {
  const { templates, loading } = useTemplates();
  const [selectedId, setSelectedId] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  const [year, monthStr] = scheduleId.split("-");
  const month = parseInt(monthStr, 10);

  const handleApply = async () => {
    if (!selectedId) {
      setError("請選擇要套用的模板");
      return;
    }
    setApplying(true);
    setError("");
    try {
      const fn = httpsCallable<
        { templateId: string; year: number; month: number },
        { scheduleId: string; daysUpdated: number; staffFiltered: string[] }
      >(functions, "applyWeeklyTemplate");
      const result = await fn({
        templateId: selectedId,
        year: parseInt(year, 10),
        month,
      });
      const { daysUpdated, staffFiltered } = result.data;
      let msg = `模板套用完成！更新 ${daysUpdated} 天班表。`;
      if (staffFiltered.length > 0) {
        msg += ` （已過濾停用員工：${staffFiltered.join(", ")}）`;
      }
      onSuccess(msg);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Modal box */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(680px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-xl)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-6)",
        }}
      >
        <h3 className="section-title" style={{ marginTop: 0, marginBottom: "var(--space-4)" }}>套用週班表模板</h3>

        {/* Template selector */}
        <label
          style={{
            display: "block",
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            marginBottom: "var(--space-1)",
            color: "var(--color-gray-600)",
          }}
        >
          選擇模板
        </label>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : templates.length === 0 ? (
          <p style={{ color: "var(--color-gray-400)", fontSize: "var(--font-size-sm)" }}>
            尚無模板。請先至「模板管理」頁面建立。
          </p>
        ) : (
          <select
            className="form-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">— 請選擇 —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {/* Preview */}
        {selectedTemplate && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <p
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                marginBottom: "var(--space-1)",
                color: "var(--color-gray-600)",
              }}
            >
              預覽（每週各時段人數）
            </p>
            <TemplatePreview template={selectedTemplate} />
          </div>
        )}

        {/* Warning if month already has data */}
        {hasExistingShifts && (
          <div className="alert alert-warning" style={{ marginTop: "var(--space-4)" }}>
            ⚠ 此月份已有排班。套用模板將以<strong>合併模式</strong>
            加入人員，不會移除現有排班。
          </div>
        )}

        {error && (
          <p className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>{error}</p>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            justifyContent: "flex-end",
            marginTop: "var(--space-5)",
          }}
        >
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={applying || !selectedId}
          >
            {applying ? "套用中…" : "確認套用"}
          </button>
        </div>
      </div>
    </div>
  );
}
