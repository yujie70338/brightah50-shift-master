import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { WeeklyTemplate } from "../types";

export function useTemplates() {
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "weekly_templates"),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setTemplates(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WeeklyTemplate),
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  return { templates, loading };
}
