// Shared types — kept in sync with functions/src/types.ts

export type SlotType = "morning" | "afternoon" | "evening";

export interface User {
  displayName: string;
  email: string;
  role: "manager" | "staff";
  isActive: boolean;
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
  id?: string;
  userId: string;
  userDisplayName: string;
  date: string;
  unavailableSlots: SlotType[];
  reason?: string;
}
