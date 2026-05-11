import { useEffect, useRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { SlotType, Unavailability, User } from "../types";

const SLOT_LABEL: Record<SlotType, string> = {
  morning: "早班",
  afternoon: "中班",
  evening: "晚班",
};

interface Props {
  scheduleId: string;
  date: string;
  slot: SlotType;
  currentAssigned: string[];
  users: User[];
  unavailability: Unavailability[];
  onClose: () => void;
}

export function QuickAssignModal({
  scheduleId,
  date,
  slot,
  currentAssigned,
  users,
  unavailability,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Build unavailability set for this date+slot
  const unavailEmails = new Set<string>();
  for (const u of unavailability) {
    if (u.date === date && u.unavailableSlots.includes(slot)) {
      unavailEmails.add(u.userId);
    }
  }

  const assignedSet = new Set(currentAssigned);
  const activeUsers = users.filter((u) => u.isActive);

  const toggle = async (email: string) => {
    const shiftDocId = date.slice(-2);
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );
    if (assignedSet.has(email)) {
      await updateDoc(shiftRef, { [`slots.${slot}`]: arrayRemove(email) });
    } else {
      await updateDoc(shiftRef, { [`slots.${slot}`]: arrayUnion(email) });
    }
  };

  const selectAll = async () => {
    const shiftDocId = date.slice(-2);
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );
    const toAdd = activeUsers
      .filter((u) => !assignedSet.has(u.email))
      .map((u) => u.email);
    if (toAdd.length > 0) {
      await updateDoc(shiftRef, {
        [`slots.${slot}`]: arrayUnion(...toAdd),
      });
    }
  };

  const clearAll = async () => {
    const shiftDocId = date.slice(-2);
    const shiftRef = doc(
      db,
      "monthly_schedules",
      scheduleId,
      "shifts",
      shiftDocId,
    );
    const toRemove = activeUsers
      .filter((u) => assignedSet.has(u.email))
      .map((u) => u.email);
    if (toRemove.length > 0) {
      await updateDoc(shiftRef, {
        [`slots.${slot}`]: arrayRemove(...toRemove),
      });
    }
  };

  const day = date.slice(-2);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 1000,
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        padding: "0.5rem",
        minWidth: "180px",
        maxHeight: "320px",
        overflowY: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#374151",
          marginBottom: "0.4rem",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "0.3rem",
        }}
      >
        {day}日 {SLOT_LABEL[slot]} 指派
      </div>

      {/* Bulk actions */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          marginBottom: "0.4rem",
        }}
      >
        <button onClick={selectAll} style={bulkBtnStyle}>
          全選
        </button>
        <button onClick={clearAll} style={bulkBtnStyle}>
          清除
        </button>
      </div>

      {/* User list */}
      {activeUsers.map((user) => {
        const checked = assignedSet.has(user.email);
        const conflict = unavailEmails.has(user.email);
        return (
          <label
            key={user.email}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.3rem",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
              background: checked ? "#eff6ff" : "transparent",
              border: conflict ? "1px solid #f59e0b" : "1px solid transparent",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(user.email)}
              style={{ accentColor: "#1a73e8", cursor: "pointer" }}
            />
            <span>{user.displayName}</span>
            {conflict && (
              <span title="此人已提報不可上班" style={{ color: "#f59e0b" }}>
                ⚠
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

const bulkBtnStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  background: "#f9fafb",
  cursor: "pointer",
  color: "#374151",
};
