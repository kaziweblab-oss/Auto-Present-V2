import { useEffect, useState } from "react";
import { api } from "./lib";

type Teacher = {
  _id: string;
  employeeId: string;
  name: string;
  status: string;
  departmentId: { code: string } | null;
};
type Dept = { _id: string; code: string; name: string };
type Captain = {
  _id: string;
  status: string;
  studentId: { name: string } | null;
  sessionId: { name: string } | null;
};

export default function Teachers({ can }: { can: (p: string) => boolean }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    departmentId: "",
  });
  const [head, setHead] = useState({ deptId: "", userId: "" });

  async function load() {
    setError(null);
    try {
      const [t, d, c] = await Promise.all([
        api<{ items: Teacher[] }>("/api/v1/teachers").then((r) => r.items),
        depts.length
          ? Promise.resolve(depts)
          : api<Dept[]>("/api/v1/foundation/departments"),
        api<Captain[]>("/api/v1/teachers/captains"),
      ]);
      setTeachers(t);
      setDepts(d);
      setCaptains(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setError(null);
    try {
      await api("/api/v1/teachers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ employeeId: "", name: "", departmentId: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function assignHead() {
    setError(null);
    try {
      await api(`/api/v1/teachers/departments/${head.deptId}/head`, {
        method: "POST",
        body: JSON.stringify({ userId: head.userId }),
      });
      setHead({ deptId: "", userId: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Principal / CI / Teachers</div>
          <h1>Teachers + CI</h1>
          <p className="sub">
            {teachers.length} teachers · {captains.length} captains
          </p>
        </div>
        <button className="theme-btn" onClick={load}>
          Refresh
        </button>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {can("teacher.manage") && (
        <div className="card row">
          <input
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            placeholder="Employee ID"
            aria-label="Employee ID"
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            aria-label="Teacher name"
          />
          <select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            aria-label="Department"
          >
            <option value="">Department</option>
            {depts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.code}
              </option>
            ))}
          </select>
          <button onClick={create}>Add teacher</button>
        </div>
      )}
      {can("department.manage") && (
        <div className="card row">
          <select
            value={head.deptId}
            onChange={(e) => setHead({ ...head, deptId: e.target.value })}
            aria-label="CI department"
          >
            <option value="">CI department</option>
            {depts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.code}
              </option>
            ))}
          </select>
          <input
            value={head.userId}
            onChange={(e) => setHead({ ...head, userId: e.target.value })}
            placeholder="User ID"
            aria-label="CI user ID"
          />
          <button onClick={assignHead}>Assign CI head</button>
        </div>
      )}
      <div className="card">
        {teachers.length === 0 ? (
          <p className="sub">No teachers yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Name</th>
                <th scope="col">Dept</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t._id}>
                  <td>{t.employeeId}</td>
                  <td>{t.name}</td>
                  <td>{t.departmentId?.code ?? "—"}</td>
                  <td>
                    <span className="pill draft">{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <b>Class captains</b>
        {captains.length === 0 ? (
          <p className="sub">
            No captains assigned. CI assigns from enrolled students (API).
          </p>
        ) : (
          captains.map((c) => (
            <p className="sub" key={c._id}>
              {c.studentId?.name} · {c.sessionId?.name} · {c.status}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
