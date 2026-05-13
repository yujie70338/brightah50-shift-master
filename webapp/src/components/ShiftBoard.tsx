import { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { ShiftDocument, Unavailability, User, SlotType } from "../types";
import { QuickAssignModal } from "./QuickAssignModal";

const SLOT_LABELS: Record<SlotType, string> = {
  morning: "早班 10:00–12:00",
  afternoon: "中班 13:00–17:00",
  evening: "晚班 18:00–21:30",
};
const SLOTS: SlotType[] = ["morning", "afternoon", "evening"];

interface Props {
  scheduleId: string;
  shifts: ShiftDocument[];
  users: User[];
  unavailability: Unavailability[];
  showUnavailability: boolean;
}

function getEmailColor(isActive: boolean) {
  return isActive ? "#1a73e8" : "#999";
}

export function ShiftBoard({
  scheduleId,
  shifts,
  users,
  unavailability,
  showUnavailability,
}: Props) {
  const userMap = new Map(users.map((u) => [u.email, u]));
  const [activeCell, setActiveCell] = useState<{
    date: string;
    slot: SlotType;
  } | null>(null);

  // ── Paint / Brush mode ───────────────────────────────────────────────────
  const [paintEmail, setPaintEmail] = useState<string | null>(null);

  const exitPaintMode = useCallback(() => setPaintEmail(null), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitPaintMode();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [exitPaintMode]);

  const handleSidebarClick = (user: User) => {
    if (!user.isActive) return;
    setPaintEmail((prev) => (prev === user.email ? null : user.email));
    // Close any open QuickAssignModal when entering paint mode
    setActiveCell(null);
  };

  const handleCellClick = async (
    date: string,
    slot: SlotType,
    currentAssigned: string[],
  ) => {
    if (!paintEmail) return; // handled by td onClick for QuickAssignModal
    if (currentAssigned.includes(paintEmail)) return; // already assigned — no-op
    const shiftDocId = date.slice(-2);
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );
    await updateDoc(shiftRef, {
      [`slots.${slot}`]: arrayUnion(paintEmail),
    });
  };

  // Build a set of unavailable (date, slot) per email for O(1) lookup
  const unavailSet = new Set<string>();
  if (showUnavailability) {
    for (const u of unavailability) {
      for (const slot of u.unavailableSlots) {
        unavailSet.add(`${u.userId}::${u.date}::${slot}`);
      }
    }
  }

  const isConflict = (email: string, date: string, slot: SlotType) =>
    showUnavailability && unavailSet.has(`${email}::${date}::${slot}`);

  // All assigned emails across all shifts (to show remaining in sidebar)
  const assignedEmails = new Set<string>();
  for (const shift of shifts) {
    for (const slot of SLOTS) {
      for (const email of shift.slots[slot]) {
        assignedEmails.add(email);
      }
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;

    // droppableId format: "SHIFT::{date}::{slot}" or "SIDEBAR"
    const [type, date, slot] = destination.droppableId.split("::");
    if (type !== "SHIFT" || !date || !slot) return;

    const email = draggableId.replace(/^email::/, "");
    const shiftDocId = date.slice(-2); // last 2 chars = day "01".."31"
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );

    await updateDoc(shiftRef, {
      [`slots.${slot}`]: arrayUnion(email),
    });
  };

  const removeFromSlot = async (
    date: string,
    slot: SlotType,
    email: string,
  ) => {
    const shiftDocId = date.slice(-2);
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );
    await updateDoc(shiftRef, {
      [`slots.${slot}`]: arrayRemove(email),
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {/* Sidebar: staff list */}
        <Droppable droppableId="SIDEBAR" isDropDisabled>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{
                minWidth: "120px",
                background: "#f5f5f5",
                borderRadius: "8px",
                padding: "0.75rem",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                  fontSize: "0.85rem",
                  color: paintEmail ? "#1d4ed8" : undefined,
                }}
              >
                {paintEmail
                  ? `🖌 ${userMap.get(paintEmail)?.displayName ?? paintEmail}`
                  : "員工"}
              </div>
              {paintEmail && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#6b7280",
                    marginBottom: "0.5rem",
                  }}
                >
                  點擊格子填入，ESC 退出
                </div>
              )}
              {users.map((user, index) => (
                <Draggable
                  key={`email::${user.email}`}
                  draggableId={`email::${user.email}`}
                  index={index}
                  isDragDisabled={paintEmail !== null}
                >
                  {(prov, snapshot) => {
                    const isPaintSelected = paintEmail === user.email;
                    return (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        onClick={() => handleSidebarClick(user)}
                        style={{
                          padding: "0.3rem 0.5rem",
                          marginBottom: "0.3rem",
                          background: isPaintSelected
                            ? "#dbeafe"
                            : snapshot.isDragging
                              ? "#c2d7f9"
                              : "#fff",
                          border: isPaintSelected
                            ? "2px solid #2563eb"
                            : "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          color: getEmailColor(user.isActive),
                          opacity: user.isActive ? 1 : 0.5,
                          cursor: user.isActive
                            ? paintEmail
                              ? isPaintSelected
                                ? "pointer"
                                : "cell"
                              : "grab"
                            : "not-allowed",
                          userSelect: "none",
                          ...prov.draggableProps.style,
                        }}
                      >
                        {user.displayName}
                      </div>
                    );
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Shifts table */}
        <div style={{ overflowX: "auto", flex: 1 }}>
          <table
            style={{
              borderCollapse: "collapse",
              minWidth: "600px",
              width: "100%",
            }}
          >
            <thead>
              <tr style={{ background: "#f0f4ff" }}>
                <th style={thStyle}>日期</th>
                {SLOTS.map((s) => (
                  <th key={s} style={thStyle}>
                    {SLOT_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.date} style={{ borderBottom: "1px solid #eee" }}>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {shift.date.slice(-2)}
                    <span
                      style={{
                        color: "#888",
                        fontWeight: 400,
                        marginLeft: "0.25rem",
                      }}
                    >
                      ({shift.dayOfWeek})
                    </span>
                  </td>
                  {SLOTS.map((slot) => (
                    <td
                      key={slot}
                      style={{
                        ...tdStyle,
                        position: "relative",
                        cursor: paintEmail ? "cell" : undefined,
                      }}
                      onClick={() => {
                        if (paintEmail) {
                          void handleCellClick(
                            shift.date,
                            slot,
                            shift.slots[slot],
                          );
                        } else {
                          setActiveCell((prev) =>
                            prev?.date === shift.date && prev?.slot === slot
                              ? null
                              : { date: shift.date, slot },
                          );
                        }
                      }}
                    >
                      <Droppable droppableId={`SHIFT::${shift.date}::${slot}`}>
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.droppableProps}
                            style={{
                              minHeight: "48px",
                              background: snapshot.isDraggingOver
                                ? "#e8f0fe"
                                : "transparent",
                              borderRadius: "4px",
                              padding: "2px",
                              transition: "background 0.15s",
                              cursor: paintEmail ? "cell" : "pointer",
                            }}
                          >
                            {shift.slots[slot].map((email) => {
                              const user = userMap.get(email);
                              const conflict = isConflict(
                                email,
                                shift.date,
                                slot,
                              );
                              return (
                                <div
                                  key={email}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    margin: "2px",
                                    padding: "2px 6px",
                                    background: "#fff",
                                    border: conflict
                                      ? "2px solid #f59e0b"
                                      : "1px solid #ddd",
                                    borderRadius: "12px",
                                    fontSize: "0.8rem",
                                    color: user?.isActive ? "#222" : "#aaa",
                                    opacity: user?.isActive ? 1 : 0.6,
                                  }}
                                >
                                  {user?.displayName ?? email}
                                  {conflict && (
                                    <span
                                      title="此人已提報不可上班"
                                      style={{ color: "#f59e0b" }}
                                    >
                                      ⚠
                                    </span>
                                  )}
                                  <button
                                    onClick={() =>
                                      removeFromSlot(shift.date, slot, email)
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#999",
                                      padding: "0 2px",
                                      lineHeight: 1,
                                      fontSize: "0.9rem",
                                    }}
                                    title="移除"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                            {prov.placeholder}
                            {/* + hint for empty or sparse cells */}
                            {shift.slots[slot].length === 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#9ca3af",
                                  fontSize: "1.1rem",
                                  minHeight: "36px",
                                }}
                                title="點擊指派員工"
                              >
                                +
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                      {/* Quick-assign popover */}
                      {activeCell?.date === shift.date &&
                        activeCell?.slot === slot && (
                          <QuickAssignModal
                            scheduleId={scheduleId}
                            date={shift.date}
                            slot={slot}
                            currentAssigned={shift.slots[slot]}
                            users={users}
                            unavailability={unavailability}
                            onClose={() => setActiveCell(null)}
                          />
                        )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DragDropContext>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "0.85rem",
  borderBottom: "2px solid #c7d2fe",
};

const tdStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  verticalAlign: "top",
};
