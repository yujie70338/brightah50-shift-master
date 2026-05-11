import { useState, useEffect } from "react";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { MonthlySchedule, ShiftDocument, Unavailability, User } from "../types";

export function useSchedule(scheduleId: string | null) {
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [shifts, setShifts] = useState<ShiftDocument[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all active users once
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      setUsers(snap.docs.map((d) => d.data() as User));
    });
  }, []);

  // Real-time listener on monthly_schedule + shifts subcollection
  useEffect(() => {
    if (!scheduleId) {
      setSchedule(null);
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const scheduleRef = doc(db, "monthly_schedules", scheduleId);

    const unsubSchedule = onSnapshot(scheduleRef, (snap) => {
      setSchedule(snap.exists() ? (snap.data() as MonthlySchedule) : null);
    });

    const unsubShifts = onSnapshot(
      collection(db, "monthly_schedules", scheduleId, "shifts"),
      (snap) => {
        const docs = snap.docs
          .map((d) => d.data() as ShiftDocument)
          .sort((a, b) => a.date.localeCompare(b.date));
        setShifts(docs);
        setLoading(false);
      },
    );

    return () => {
      unsubSchedule();
      unsubShifts();
    };
  }, [scheduleId]);

  // Real-time listener on unavailability for this month
  useEffect(() => {
    if (!scheduleId) {
      setUnavailability([]);
      return;
    }
    const [year, month] = scheduleId.split("-");
    const prefix = `${year}-${month}`;
    const q = query(
      collection(db, "unavailability"),
      where("date", ">=", `${prefix}-01`),
      where("date", "<=", `${prefix}-31`),
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnavailability(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unavailability),
      );
    });
    return unsub;
  }, [scheduleId]);

  return { schedule, shifts, unavailability, users, loading };
}
