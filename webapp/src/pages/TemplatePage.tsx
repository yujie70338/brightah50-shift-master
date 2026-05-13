import { useState, useRef, useEffect } from "react";
import {
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { DayOfWeek, ShiftSlots, User, WeeklyTemplate } from "../types";
import { useTemplates } from "../hooks/useTemplates";
import { getDocs } from "firebase/firestore";
import { Navbar } from "../components/Navbar";

const DAYS: DayOfWeek[] = ["日", "一", "二", "三", "四", "五", "六"];
const SLOTS: { key: keyof ShiftSlots; label: string }[] = [
  { key: "morning", label: "早班 10–12" },
  { key: "afternoon", label: "中班 13–17" },
  { key: "evening", label: "晚班 18–21:30" },
];

function emptyDays(): Record<DayOfWeek, ShiftSlots> {
  const result = {} as Record<DayOfWeek, ShiftSlots>;
  for (const d of DAYS) {
    result[d] = { morning: [], afternoon: [], evening: [] };
  }
  return result;
}

// Popover for assigning staff to a single cell (day × slot)
function CellPopover({
  assigned,
  users,
  onToggle,
  onClose,
}: {
  assigned: string[];
  users: User[];
  onToggle: (email: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flipUp, setFlipUp] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Flip upward if the popover overflows the viewport bottom
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      setFlipUp(true);
    }
  }, []);

  const assignedSet = new Set(assigned);
  const activeUsers = users.filter((u) => u.isActive && !u.isDeleted);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: flipUp ? "auto" : "100%",
        bottom: flipUp ? "100%" : "auto",
        left: 0,
        zIndex: 1000,
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        padding: "0.5rem",
        minWidth: "160px",
        maxHeight: "280px",
        overflowY: "auto",
      }}
    >
      {activeUsers.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: 0 }}>
          尚無員工
        </p>
      )}
      {activeUsers.map((u) => (
        <label
          key={u.email}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.2rem 0.3rem",
            borderRadius: "4px",
            cursor: "pointer",
            background: assignedSet.has(u.email) ? "#eff6ff" : "transparent",
            fontSize: "0.82rem",
          }}
        >
          <input
            type="checkbox"
            checked={assignedSet.has(u.email)}
            onChange={() => onToggle(u.email)}
          />
          {u.displayName}
        </label>
      ))}
    </div>
  );
}

export function TemplatePage() {
  const { templates, loading } = useTemplates();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<Record<DayOfWeek, ShiftSlots>>(emptyDays());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [openCell, setOpenCell] = useState<{
    day: DayOfWeek;
    slot: keyof ShiftSlots;
  } | null>(null);

  // Load users once
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      setUsers(snap.docs.map((d) => d.data() as User));
    });
  }, []);

  const loadTemplate = (t: WeeklyTemplate) => {
    setSelectedId(t.id ?? null);
    setName(t.name);
    setDays(t.days);
    setOpenCell(null);
    setError("");
  };

  const handleNew = () => {
    setSelectedId(null);
    setName("");
    setDays(emptyDays());
    setOpenCell(null);
    setError("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("請輸入模板名稱");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        days,
        updatedAt: serverTimestamp(),
      };
      if (selectedId) {
        await setDoc(doc(db, "weekly_templates", selectedId), payload, {
          merge: true,
        });
      } else {
        const ref = await addDoc(collection(db, "weekly_templates"), payload);
        setSelectedId(ref.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(`確定要刪除模板「${name}」嗎？`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "weekly_templates", selectedId));
      handleNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const toggleStaff = (
    day: DayOfWeek,
    slot: keyof ShiftSlots,
    email: string,
  ) => {
    setDays((prev) => {
      const existing = new Set(prev[day][slot]);
      if (existing.has(email)) {
        existing.delete(email);
      } else {
        existing.add(email);
      }
      return {
        ...prev,
        [day]: { ...prev[day], [slot]: Array.from(existing) },
      };
    });
  };

  return (
    <div style={{ padding: "1rem", maxWidth: "1100px", margin: "0 auto" }}>
      <Navbar title="週班表模板管理" />
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1rem" }}>
        建立可重複套用的週班表模板，再從排班頁一鍵套用至任意月份。
      </p>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1rem" }}>
        建立可重複套用的週班表模板，再從排班頁一鍵套用至任意月份。
      </p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {/* ── 左側：模板列表 ── */}
        <div
          style={{
            width: "200px",
            flexShrink: 0,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "0.5rem",
          }}
        >
          <button
            onClick={handleNew}
            style={{
              width: "100%",
              padding: "0.4rem",
              marginBottom: "0.5rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ＋ 新增模板
          </button>

          {loading && (
            <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>載入中…</p>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => loadTemplate(t)}
              style={{
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                cursor: "pointer",
                background:
                  t.id === selectedId ? "#dbeafe" : "transparent",
                fontWeight: t.id === selectedId ? 600 : 400,
                fontSize: "0.88rem",
                marginBottom: "0.2rem",
                border:
                  t.id === selectedId
                    ? "1px solid #93c5fd"
                    : "1px solid transparent",
              }}
            >
              {t.name}
            </div>
          ))}
        </div>

        {/* ── 主區：模板編輯器 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 名稱 + 操作列 */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <input
              type="text"
              placeholder="模板名稱（例：標準週班表）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "0.5rem 1rem",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "儲存中…" : "儲存"}
            </button>
            {selectedId && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                  borderRadius: "6px",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                {deleting ? "刪除中…" : "刪除"}
              </button>
            )}
            {error && (
              <span style={{ color: "red", fontSize: "0.85rem" }}>{error}</span>
            )}
          </div>

          {/* 7 × 3 格子 */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "0.4rem 0.6rem",
                      background: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      width: "100px",
                    }}
                  >
                    時段
                  </th>
                  {DAYS.map((d) => (
                    <th
                      key={d}
                      style={{
                        padding: "0.4rem 0.6rem",
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      週{d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(({ key: slot, label }) => (
                  <tr key={slot}>
                    <td
                      style={{
                        padding: "0.4rem 0.6rem",
                        border: "1px solid #e5e7eb",
                        fontWeight: 600,
                        background: "#f9fafb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </td>
                    {DAYS.map((day) => {
                      const assigned = days[day][slot];
                      const isOpen =
                        openCell?.day === day && openCell?.slot === slot;
                      return (
                        <td
                          key={day}
                          style={{
                            padding: "0.3rem",
                            border: "1px solid #e5e7eb",
                            verticalAlign: "top",
                            position: "relative",
                          }}
                        >
                          <div
                            onClick={() =>
                              setOpenCell(isOpen ? null : { day, slot })
                            }
                            style={{
                              minHeight: "48px",
                              cursor: "pointer",
                              borderRadius: "4px",
                              padding: "0.2rem",
                              background: isOpen ? "#eff6ff" : "transparent",
                              border: isOpen
                                ? "1px solid #93c5fd"
                                : "1px dashed #d1d5db",
                            }}
                          >
                            {assigned.length === 0 ? (
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "0.78rem",
                                }}
                              >
                                點擊指派
                              </span>
                            ) : (
                              assigned.map((email) => {
                                const u = users.find((x) => x.email === email);
                                return (
                                  <div
                                    key={email}
                                    style={{
                                      fontSize: "0.78rem",
                                      background: "#dbeafe",
                                      borderRadius: "3px",
                                      padding: "1px 4px",
                                      marginBottom: "2px",
                                      display: "inline-block",
                                      marginRight: "2px",
                                    }}
                                  >
                                    {u?.displayName ?? email}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {isOpen && (
                            <CellPopover
                              assigned={assigned}
                              users={users}
                              onToggle={(email) =>
                                toggleStaff(day, slot, email)
                              }
                              onClose={() => setOpenCell(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
