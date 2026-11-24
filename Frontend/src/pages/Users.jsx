import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import api, { errorText } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    api
      .get("/users")
      .then((res) => setUsers(res.data.users))
      .catch((e) => setMessage(errorText(e)));
  }, []);

  useEffect(load, [load]);

  const create = async (event) => {
    event.preventDefault();
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "" });
      setMessage("Operator created");
      load();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  const deactivate = async (id) => {
    try {
      await api.patch(`/users/${id}/deactivate`);
      load();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  return (
    <div className="users-page">
      <div className="page-heading">
        <div>
          <h1>Users</h1>
          <p>Operator accounts that can log in and control the boat</p>
        </div>
      </div>

      {message && <div className="control-notice inline">{message}</div>}

      <section className="panel users-panel">
        <h2>Add operator</h2>
        <form className="users-form" onSubmit={create}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Password (12+ characters)" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" className="small-button primary">
            <UserPlus size={15} /> Add
          </button>
        </form>
      </section>

      <section className="panel users-panel">
        <h2>Accounts</h2>
        <div className="table-scroll">
          <table className="command-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.isActive ? "Active" : "Deactivated"}</td>
                  <td>
                    {u.isActive && u.role !== "ADMIN" && u.id !== user?.id && (
                      <button type="button" className="small-button secondary" onClick={() => deactivate(u.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
