import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { User } from "../types";
import { Navbar } from "../components/Navbar";

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"manager" | "doctor" | "assistant">("doctor");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "users"));
    setUsers(
      snap.docs
        .map((d) => d.data() as User)
        .filter((u) => !u.isDeleted),
    );
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
      setNewRole("doctor");
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

  const handleDeleteUser = async (email: string, name: string) => {
    if (!window.confirm(`確定要刪除員工「${name}」嗎？\n刪除後此員工將無法登入且從列表消失，若要復原請重新新增。`)) return;
    await updateDoc(doc(db, "users", email), { isDeleted: true });
    await fetchUsers();
  };

  return (
    <>
      <Navbar title="萊特動物醫院" />
    <div className="page-wrapper" style={{ maxWidth: "860px" }}>

      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="section-title">新增員工</h2>
        <div className="card">
        <form
          onSubmit={handleAddUser}
          noValidate
          style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
        >
          <input
            className="form-input"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            required
            style={{ flex: "1 1 200px" }}
          />
          <input
            className="form-input"
            placeholder="姓名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            style={{ flex: "1 1 150px" }}
          />
          <select
            className="form-select"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "manager" | "doctor" | "assistant")}
          >
            <option value="doctor">醫師</option>
            <option value="assistant">助理</option>
            <option value="manager">管理員</option>
          </select>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "新增中…" : "新增"}
          </button>
        </form>
        </div>
        {error && <p className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>{error}</p>}
      </section>

      <section>
        <h2 className="section-title">成員列表</h2>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>Email</th>
                <th>角色</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.email}
                  style={{ opacity: u.isActive ? 1 : 0.5 }}
                >
                  <td>{u.displayName}</td>
                  <td style={{ fontSize: "var(--font-size-sm)", color: "var(--color-gray-500)" }}>{u.email}</td>
                  <td>
                    <span className={`badge ${{ manager: "badge-primary", doctor: "badge-success", assistant: "badge-secondary" }[u.role]}`}>
                      {{ manager: "管理員", doctor: "醫師", assistant: "助理" }[u.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? "badge-success" : "badge-secondary"}`}>
                      {u.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleActive(u.email, u.isActive)}
                      >
                        {u.isActive ? "停用" : "啟用"}
                      </button>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => handleDeleteUser(u.email, u.displayName)}
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
    </>
  );
}
