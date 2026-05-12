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
        fontSize: "0.78rem",
        marginTop: "0.5rem",
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
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  textAlign: "center",
};

const tdStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  border: "1px solid #e5e7eb",
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
        background: "rgba(0,0,0,0.3)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Modal box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          padding: "1.5rem",
          width: "min(680px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>套用週班表模板</h3>

        {/* Template selector */}
        <label
          style={{
            display: "block",
            fontSize: "0.9rem",
            fontWeight: 600,
            marginBottom: "0.3rem",
          }}
        >
          選擇模板
        </label>
        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>載入中…</p>
        ) : templates.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
            尚無模板。請先至「模板管理」頁面建立。
          </p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.95rem",
            }}
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
          <div style={{ marginTop: "1rem" }}>
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.3rem",
                color: "#374151",
              }}
            >
              預覽（每週各時段人數）
            </p>
            <TemplatePreview template={selectedTemplate} />
          </div>
        )}

        {/* Warning if month already has data */}
        {hasExistingShifts && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.6rem 0.75rem",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "6px",
              fontSize: "0.85rem",
              color: "#92400e",
            }}
          >
            ⚠ 此月份已有排班。套用模板將以<strong>合併模式</strong>
            加入人員，不會移除現有排班。
          </div>
        )}

        {error && (
          <p style={{ color: "red", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
            marginTop: "1.25rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !selectedId}
            style={{
              padding: "0.5rem 1.25rem",
              background: applying || !selectedId ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: applying || !selectedId ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {applying ? "套用中…" : "確認套用"}
          </button>
        </div>
      </div>
    </div>
  );
}
