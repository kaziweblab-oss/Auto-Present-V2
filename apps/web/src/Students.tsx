import { useEffect, useState } from "react";
import { api } from "./lib";

type Row = {
  _id: string;
  roll: string;
  shift: string;
  status: string;
  studentId: {
    _id: string;
    name: string;
    roll: string;
    registrationNumber: string;
  } | null;
  sessionId: { _id: string; name: string } | null;
  departmentId: { _id: string; code: string } | null;
};

type Dept = { _id: string; code: string; name: string };
type Sess = { _id: string; name: string; state: string };
type Profile = {
  student: {
    _id: string;
    name: string;
    roll: string;
    registrationNumber: string;
    phone?: string;
    status: string;
  };
  history: {
    _id: string;
    roll: string;
    shift: string;
    status: string;
    sessionId: { name: string } | null;
    departmentId: { code: string } | null;
  }[];
};

export default function Students({ can }: { can: (p: string) => boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [q, setQ] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    roll: "",
    registrationNumber: "",
    name: "",
    phone: "",
  });

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (sessionId) params.set("sessionId", sessionId);
      if (departmentId) params.set("departmentId", departmentId);
      const [list, d, s] = await Promise.all([
        api<{ items: Row[]; total: number }>(`/api/v1/students?${params}`),
        depts.length ? null : api<Dept[]>("/api/v1/foundation/departments"),
        sessions.length ? null : api<Sess[]>("/api/v1/sessions"),
      ]);
      setRows(list.items);
      setTotal(list.total);
      if (d) setDepts(d);
      if (s) setSessions(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(id: string) {
    try {
      setProfile(await api<Profile>(`/api/v1/students/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profile failed");
    }
  }

  async function create() {
    setError(null);
    try {
      if (!sessionId || !departmentId)
        throw new Error("Pick session + department first");
      const dept = depts.find((d) => d._id === departmentId);
      await api("/api/v1/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          sessionId,
          departmentId,
          shift: "1ST",
          roll: form.roll || `R-${Date.now()}`,
        }),
      });
      setForm({ roll: "", registrationNumber: "", name: "", phone: "" });
      await load();
      void dept;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">CI / Students</div>
          <h1>Session Students</h1>
          <p className="sub">
            {total} enrollments. History preserved per session.
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
      <div className="card row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roll / name / reg"
          aria-label="Search students"
        />
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          aria-label="Session filter"
        >
          <option value="">All sessions</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name} ({s.state})
            </option>
          ))}
        </select>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          aria-label="Department filter"
        >
          <option value="">All departments</option>
          {depts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.code}
            </option>
          ))}
        </select>
        <button onClick={load}>Filter</button>
      </div>
      {can("student.create") && (
        <div className="card row">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            aria-label="Student name"
          />
          <input
            value={form.roll}
            onChange={(e) => setForm({ ...form, roll: e.target.value })}
            placeholder="Roll"
            aria-label="Roll"
          />
          <input
            value={form.registrationNumber}
            onChange={(e) =>
              setForm({ ...form, registrationNumber: e.target.value })
            }
            placeholder="Reg no"
            aria-label="Registration"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
            aria-label="Phone"
          />
          <button onClick={create}>Add + Enroll</button>
        </div>
      )}
      <div className="card">
        {rows.length === 0 ? (
          <p className="sub">No enrollments found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Roll</th>
                <th scope="col">Name</th>
                <th scope="col">Session</th>
                <th scope="col">Dept</th>
                <th scope="col">Status</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{r.roll}</td>
                  <td>{r.studentId?.name ?? "—"}</td>
                  <td>{r.sessionId?.name ?? "—"}</td>
                  <td>{r.departmentId?.code ?? "—"}</td>
                  <td>
                    <span className="pill draft">{r.status}</span>
                  </td>
                  <td>
                    <button onClick={() => open(r.studentId?._id ?? "")}>
                      Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {profile && (
        <div className="card">
          <div className="row between">
            <b>
              {profile.student.name} — {profile.student.roll}
            </b>
            <button onClick={() => setProfile(null)}>Close</button>
          </div>
          <p className="sub">
            Reg {profile.student.registrationNumber} · {profile.student.status}{" "}
            · {profile.student.phone ?? "no phone"}
          </p>
          <h3>Academic history</h3>
          {profile.history.map((h) => (
            <p className="sub" key={h._id}>
              {h.sessionId?.name} · {h.departmentId?.code} · {h.shift} ·{" "}
              {h.status} · roll {h.roll}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
