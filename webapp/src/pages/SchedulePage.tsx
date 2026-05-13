import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { useSchedule } from "../hooks/useSchedule";
import { MonthControls } from "../components/MonthControls";
import { ShiftBoard } from "../components/ShiftBoard";
import { UnavailabilityPanel } from "../components/UnavailabilityPanel";

export function SchedulePage() {
  const { firebaseUser, userProfile } = useAuth();
  const isManager = userProfile?.role === "manager";

  // Default to current month
  const today = new Date();
  const defaultId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [scheduleId, setScheduleId] = useState(defaultId);

  const { schedule, shifts, unavailability, users, loading } =
    useSchedule(scheduleId);

  // Filter unavailability entries belonging to the current user
  const myEmail = firebaseUser?.email ?? "";
  const myUnavailability = unavailability.filter((u) => u.userId === myEmail);

  return (
    <div style={{ padding: "1rem", maxWidth: "1200px", margin: "0 auto" }}>
      <Navbar title="排班系統" />

      {/* Month controls (manager sees create/publish; all see month picker) */}
      <MonthControls
        schedule={schedule}
        scheduleId={scheduleId}
        shifts={shifts}
        onMonthChange={setScheduleId}
        isManager={isManager}
      />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        {loading && (
          <span style={{ color: "#888", fontSize: "0.85rem" }}>載入中…</span>
        )}
        {!loading && !schedule && (
          <span style={{ color: "#888", fontSize: "0.85rem" }}>
            此月份尚未建立{isManager ? "，請點「建立新月份」" : ""}
          </span>
        )}
      </div>

      {/* Shift board — manager gets DND; staff gets read-only view (published only) */}
      {schedule &&
        (isManager ? (
          shifts.length > 0 && (
            <ShiftBoard
              scheduleId={scheduleId}
              shifts={shifts}
              users={users}
              unavailability={unavailability}
              showUnavailability={true}
            />
          )
        ) : schedule.isPublished ? (
          shifts.length > 0 && (
            <ReadOnlyBoard
              shifts={shifts}
              users={users}
              unavailability={unavailability}
              showUnavailability={true}
            />
          )
        ) : (
          <p style={{ color: "#888", fontSize: "0.9rem" }}>尚未發布</p>
        ))}

      {/* Staff: unavailability submission */}
      {userProfile?.role === "staff" && (
        <UnavailabilityPanel
          scheduleId={scheduleId}
          myEmail={myEmail}
          myDisplayName={userProfile.displayName}
          myUnavailability={myUnavailability}
        />
      )}
    </div>
  );
}

// Lightweight read-only view for staff
import { ShiftDocument, Unavailability, User, SlotType } from "../types";

const SLOT_LABELS: Record<SlotType, string> = {
  morning: "早班 10:00–12:00",
  afternoon: "中班 13:00–17:00",
  evening: "晚班 18:00–21:30",
};
const SLOTS: SlotType[] = ["morning", "afternoon", "evening"];

function ReadOnlyBoard({
  shifts,
  users,
  unavailability,
  showUnavailability,
}: {
  shifts: ShiftDocument[];
  users: User[];
  unavailability: Unavailability[];
  showUnavailability: boolean;
}) {
  const userMap = new Map(users.map((u) => [u.email, u]));

  const unavailSet = new Set<string>();
  if (showUnavailability) {
    for (const u of unavailability) {
      for (const slot of u.unavailableSlots) {
        unavailSet.add(`${u.userId}::${u.date}::${slot}`);
      }
    }
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ borderCollapse: "collapse", minWidth: "600px", width: "100%" }}
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
              <td style={{ ...tdStyle, fontWeight: 600 }}>
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
                <td key={slot} style={tdStyle}>
                  {shift.slots[slot].map((email) => {
                    const user = userMap.get(email);
                    const conflict =
                      showUnavailability &&
                      unavailSet.has(`${email}::${shift.date}::${slot}`);
                    return (
                      <span
                        key={email}
                        style={{
                          display: "inline-block",
                          margin: "2px",
                          padding: "2px 8px",
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
                            title="已提報不可上班"
                            style={{ color: "#f59e0b" }}
                          >
                            {" "}
                            ⚠
                          </span>
                        )}
                      </span>
                    );
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
