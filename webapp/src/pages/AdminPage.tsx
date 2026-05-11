import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { User } from "../types";
import { useAuth } from "../contexts/AuthContext";

export function AdminPage() {
  const { logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"manager" | "staff">("staff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "users"));
    setUsers(snap.docs.map((d) => d.data() as User));
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newEmail || !newName) {
      setError("Email 與姓名為必填");
      return;
    }
    setSubmitting(true);
    try {
      const newUser: User = {
        displayName: newName,
        email: newEmail.toLowerCase().trim(),
        role: newRole,
        isActive: true,
      };
      await setDoc(doc(db, "users", newUser.email), newUser);
      setNewEmail("");
      setNewName("");
      setNewRole("staff");
      await fetchUsers();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (email: string, current: boolean) => {
    await updateDoc(doc(db, "users", email), { isActive: !current });
    await fetchUsers();
  };

  return (
    <div style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>管理後台</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link to="/schedule">回班表</Link>
          <button onClick={logout}>登出</button>
        </div>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2>新增員工</h2>
        <form
          onSubmit={handleAddUser}
          noValidate
          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
        >
          <input
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            required
            style={{ padding: "0.4rem", flex: "1 1 200px" }}
          />
          <input
            placeholder="姓名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            style={{ padding: "0.4rem", flex: "1 1 150px" }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "manager" | "staff")}
            style={{ padding: "0.4rem" }}
          >
            <option value="staff">員工</option>
            <option value="manager">管理員</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            style={{ padding: "0.4rem 1rem" }}
          >
            {submitting ? "新增中…" : "新增"}
          </button>
        </form>
        {error && <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>}
      </section>

      <section>
        <h2>成員列表</h2>
        {loading ? (
          <p>載入中…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>姓名</th>
                <th style={{ padding: "0.5rem" }}>Email</th>
                <th style={{ padding: "0.5rem" }}>角色</th>
                <th style={{ padding: "0.5rem" }}>狀態</th>
                <th style={{ padding: "0.5rem" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.email}
                  style={{
                    borderBottom: "1px solid #eee",
                    opacity: u.isActive ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: "0.5rem" }}>{u.displayName}</td>
                  <td style={{ padding: "0.5rem" }}>{u.email}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {u.role === "manager" ? "管理員" : "員工"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {u.isActive ? "啟用" : "停用"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <button onClick={() => toggleActive(u.email, u.isActive)}>
                      {u.isActive ? "停用" : "啟用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
