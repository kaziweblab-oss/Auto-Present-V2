import { useEffect, useState } from "react";
import { api } from "./lib";

type Req = {
  _id: string;
  oldDay: string;
  oldStartTime: string;
  oldEndTime: string;
  newDay: string;
  newStartTime: string;
  newEndTime: string;
  reason: string;
  status: string;
  requestedByRole: string;
};

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function TimeChange() {
  const [items, setItems] = useState<Req[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    routineEntryId: "",
    requestedByRole: "TEACHER",
    requesterTeacherId: "",
    captainId: "",
    newDay: "SUN",
    newStartTime: "",
    newEndTime: "",
    newRoom: "",
    reason: "",
    approverTeacherId: "",
  });

  async function load() {
    setError(null);
    try {
      setItems(await api<Req[]>("/api/v1/time-changes"));
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
      await api("/api/v1/time-changes", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  async function approve(id: string) {
    setError(null);
    try {
      if (!form.approverTeacherId)
        throw new Error("Approver teacher ID required");
      await api(`/api/v1/time-changes/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ approverTeacherId: form.approverTeacherId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Teacher / Captain / Time change</div>
          <h1>Class Time Change</h1>
          <p className="sub">
            Conflict-checked · second-party approval · history kept
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
        <b>Request new slot</b>
        <div className="row">
          <input
            value={form.routineEntryId}
            onChange={(e) =>
              setForm({ ...form, routineEntryId: e.target.value })
            }
            placeholder="Routine entry ID"
            aria-label="Routine"
          />
          <select
            value={form.requestedByRole}
            onChange={(e) =>
              setForm({ ...form, requestedByRole: e.target.value })
            }
            aria-label="Role"
          >
            <option value="TEACHER">TEACHER</option>
            <option value="CAPTAIN">CAPTAIN</option>
          </select>
          <input
            value={form.requesterTeacherId}
            onChange={(e) =>
              setForm({ ...form, requesterTeacherId: e.target.value })
            }
            placeholder="My teacher ID"
            aria-label="Requester"
          />
          <input
            value={form.captainId}
            onChange={(e) => setForm({ ...form, captainId: e.target.value })}
            placeholder="Captain ID (if captain)"
            aria-label="Captain"
          />
        </div>
        <div className="row">
          <select
            value={form.newDay}
            onChange={(e) => setForm({ ...form, newDay: e.target.value })}
            aria-label="New day"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={form.newStartTime}
            onChange={(e) => setForm({ ...form, newStartTime: e.target.value })}
            aria-label="New start"
          />
          <input
            type="time"
            value={form.newEndTime}
            onChange={(e) => setForm({ ...form, newEndTime: e.target.value })}
            aria-label="New end"
          />
          <input
            value={form.newRoom}
            onChange={(e) => setForm({ ...form, newRoom: e.target.value })}
            placeholder="Room"
            aria-label="Room"
          />
          <input
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Reason"
            aria-label="Reason"
          />
          <button onClick={create}>Request</button>
        </div>
        <div className="row">
          <input
            value={form.approverTeacherId}
            onChange={(e) =>
              setForm({ ...form, approverTeacherId: e.target.value })
            }
            placeholder="Approver teacher ID"
            aria-label="Approver"
          />
        </div>
      </div>
      <div className="card">
        {items.length === 0 ? (
          <p className="sub">No requests.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Old</th>
                <th scope="col">New</th>
                <th scope="col">By</th>
                <th scope="col">Status</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id}>
                  <td>
                    {r.oldDay} {r.oldStartTime}–{r.oldEndTime}
                  </td>
                  <td>
                    {r.newDay} {r.newStartTime}–{r.newEndTime}
                  </td>
                  <td>{r.requestedByRole}</td>
                  <td>
                    <span className="pill draft">{r.status}</span>
                  </td>
                  <td>
                    {r.status === "PENDING" && (
                      <button onClick={() => approve(r._id)}>
                        Approve+Apply
                      </button>
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
