import { useEffect, useState } from "react";
import { api } from "./lib";

type Entry = {
  _id: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  shift: string;
  subjectId: { code: string; name: string } | null;
  teacherId: { name: string; employeeId: string } | null;
  classGroupId: { _id: string; name: string } | null;
};

type Sess = { _id: string; name: string };
type Dept = { _id: string; code: string };
type Group = { _id: string; name: string };

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function Routine({ can }: { can: (p: string) => boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [view, setView] = useState<"week" | "day">("week");
  const [day, setDay] = useState("SUN");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (departmentId) params.set("departmentId", departmentId);
      if (view === "day") params.set("day", day);
      const [e, s, d] = await Promise.all([
        api<Entry[]>(`/api/v1/routines/entries?${params}`),
        sessions.length
          ? Promise.resolve(sessions)
          : api<Sess[]>("/api/v1/sessions"),
        depts.length
          ? Promise.resolve(depts)
          : api<Dept[]>("/api/v1/foundation/departments"),
      ]);
      setEntries(e);
      setSessions(s);
      setDepts(d);
      if (sessionId && departmentId) {
        setGroups(
          await api<Group[]>(
            `/api/v1/routines/groups?sessionId=${sessionId}&departmentId=${departmentId}`,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, day]);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">CI / Routine</div>
          <h1>Weekly Routine</h1>
          <p className="sub">
            {entries.length} periods · conflicts blocked server-side
          </p>
        </div>
        <div className="row">
          <button
            className={view === "week" ? "theme-btn" : ""}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={view === "day" ? "theme-btn" : ""}
            onClick={() => setView("day")}
          >
            Day
          </button>
          <button className="theme-btn" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="card row">
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          aria-label="Session"
        >
          <option value="">Session</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          aria-label="Department"
        >
          <option value="">Department</option>
          {depts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.code}
            </option>
          ))}
        </select>
        {view === "day" && (
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-label="Day"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <button onClick={load}>Apply</button>
        {can("routine.manage") && (
          <span className="sub">Create via API (conflict-checked)</span>
        )}
      </div>
      {(view === "day" ? [day] : DAYS).map((d) => (
        <div className="card" key={d}>
          <b>{d}</b>
          {entries.filter((e) => e.day === d).length === 0 ? (
            <p className="sub">No classes.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Class</th>
                  <th scope="col">Room</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .filter((e) => e.day === d)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((e) => (
                    <tr key={e._id}>
                      <td>
                        {e.startTime}–{e.endTime}
                      </td>
                      <td>{e.subjectId ? `${e.subjectId.code}` : "—"}</td>
                      <td>{e.teacherId?.name ?? "—"}</td>
                      <td>{e.classGroupId?.name ?? "—"}</td>
                      <td>{e.room ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {groups.length > 0 && (
        <p className="sub">{groups.length} class groups in scope.</p>
      )}
    </section>
  );
}
