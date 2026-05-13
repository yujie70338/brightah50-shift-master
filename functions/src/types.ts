export type SlotType = "morning" | "afternoon" | "evening";

export interface User {
  displayName: string;
  email: string;
  role: "manager" | "staff";
  isActive: boolean;
  isDeleted?: boolean;
}

export interface MonthlySchedule {
  year: number;
  month: number;
  isPublished: boolean;
  managerId: string;
}

export interface ShiftSlots {
  morning: string[];
  afternoon: string[];
  evening: string[];
}

export interface ShiftDocument {
  date: string;
  dayOfWeek: string;
  slots: ShiftSlots;
}

export interface Unavailability {
  userId: string;
  userDisplayName: string;
  date: string;
  unavailableSlots: SlotType[];
  reason?: string;
}

export type DayOfWeek = "日" | "一" | "二" | "三" | "四" | "五" | "六";

export interface WeeklyTemplate {
  id?: string;
  name: string;
  createdBy: string; // manager email
  updatedAt: FirebaseFirestore.Timestamp;
  days: Record<DayOfWeek, ShiftSlots>;
}
