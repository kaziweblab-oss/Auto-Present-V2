import { useEffect, useState } from "react";
import { api } from "./lib";

type Req = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: string;
  requesterTeacherId: { name: string } | string | null;
  requestedTeacherId: { name: string } | string | null;
};

type Cfg = {
  minLeadMinutes: number;
  responseWindowMinutes: number;
  maxManualDays: number;
};

export default function Replacement() {
  const [items, setItems] = useState<Req[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    requesterTeacherId: "",
    requestedTeacherId: "",
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
    sessionId: "",
    departmentId: "",
    classGroupId: "",
    subjectId: "",
  });

  async function load() {
    setError(null);
    try {
      const [list, c] = await Promise.all([
        api<Req[]>("/api/v1/replacements"),
        api<Cfg>("/api/v1/replacements/config"),
      ]);
      setItems(list);
      setCfg(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    try {
      await api("/api/v1/replacements", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ ...form, reason: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  async function act(id: string, action: "accept" | "reject" | "cancel") {
    setError(null);
    try {
      await api(`/api/v1/replacements/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          teacherId:
            action === "cancel"
              ? form.requesterTeacherId
              : form.requestedTeacherId,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Teacher / Replacement</div>
          <h1>Class Replacement</h1>
          <p className="sub">
            {cfg
              ? `Lead ≥${cfg.minLeadMinutes}m · response ${cfg.responseWindowMinutes}m · manual ≤${cfg.maxManualDays}d`
              : "Loading policy…"}
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
      <div className="card">
        <b>Manual request (date + time)</b>
        <div className="row">
          <input
            value={form.requesterTeacherId}
            onChange={(e) =>
              setForm({ ...form, requesterTeacherId: e.target.value })
            }
            placeholder="My teacher ID"
            aria-label="Requester"
          />
          <input
            value={form.requestedTeacherId}
            onChange={(e) =>
              setForm({ ...form, requestedTeacherId: e.target.value })
            }
            placeholder="Requested teacher ID"
            aria-label="Requested"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            aria-label="Date"
          />
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            aria-label="Start"
          />
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            aria-label="End"
          />
        </div>
        <div className="row">
          <input
            value={form.sessionId}
            onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
            placeholder="Session ID"
            aria-label="Session"
          />
          <input
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            placeholder="Dept ID"
            aria-label="Department"
          />
          <input
            value={form.classGroupId}
            onChange={(e) => setForm({ ...form, classGroupId: e.target.value })}
            placeholder="Class ID"
            aria-label="Class"
          />
          <input
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            placeholder="Subject ID"
            aria-label="Subject"
          />
          <input
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Reason"
            aria-label="Reason"
          />
          <button onClick={create}>Request</button>
        </div>
      </div>
      <div className="card">
        {items.length === 0 ? (
          <p className="sub">No requests.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Time</th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id}>
                  <td>{r.date}</td>
                  <td>
                    {r.startTime}–{r.endTime}
                  </td>
                  <td>{r.reason}</td>
                  <td>
                    <span className="pill draft">{r.status}</span>
                  </td>
                  <td>
                    {r.status === "PENDING" && (
                      <div className="row">
                        <button onClick={() => act(r._id, "accept")}>
                          Accept
                        </button>
                        <button onClick={() => act(r._id, "reject")}>
                          Reject
                        </button>
                        <button onClick={() => act(r._id, "cancel")}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
