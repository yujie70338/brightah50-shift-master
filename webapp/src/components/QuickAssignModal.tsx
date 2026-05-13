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
      className="popover"
      style={{ top: "100%", left: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="popover-header">
        {day}日 {SLOT_LABEL[slot]} 指派
      </div>

      {/* Bulk actions */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <button className="btn btn-ghost btn-xs" onClick={selectAll}>全選</button>
        <button className="btn btn-ghost btn-xs" onClick={clearAll}>清除</button>
      </div>

      {/* User list */}
      {activeUsers.map((user) => {
        const checked = assignedSet.has(user.email);
        const conflict = unavailEmails.has(user.email);
        return (
          <label
            key={user.email}
            className={`popover-item${checked ? " selected" : ""}${conflict ? " conflict-item" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(user.email)}
              style={{ accentColor: "var(--color-primary)", cursor: "pointer" }}
            />
            <span>{user.displayName}</span>
            {conflict && (
              <span title="此人已提報不可上班" style={{ color: "var(--color-warning)" }}>
                ⚠
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

