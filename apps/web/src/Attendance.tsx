import { useEffect, useState } from "react";
import { api } from "./lib";

type SessionItem = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  window: "NOT_OPEN" | "PRESENT" | "LATE" | "CLOSED";
  subjectId: { code: string } | null;
  teacherId: { name: string } | null;
  classGroupId: { name: string } | null;
};

type Detail = {
  session: { _id: string; status: string };
  records: {
    _id: string;
    studentId: { _id: string; name: string; roll: string } | null;
    status: string;
  }[];
  counts: Record<string, number>;
  window: string;
  serverNow: number;
};

export default function Attendance({ can }: { can: (p: string) => boolean }) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setSessions(await api<SessionItem[]>("/api/v1/attendance/sessions"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openDetail(id: string) {
    setSelected(id);
    try {
      setDetail(await api<Detail>(`/api/v1/attendance/sessions/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detail failed");
    }
  }

  async function mark(
    studentId: string,
    status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED",
  ) {
    if (!selected) return;
    setError(null);
    try {
      await api(`/api/v1/attendance/sessions/${selected}/mark`, {
        method: "POST",
        body: JSON.stringify({ studentId, status }),
      });
      await openDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark failed");
    }
  }

  const badge = (w: string) =>
    w === "PRESENT"
      ? "OPEN — PRESENT WINDOW"
      : w === "LATE"
        ? "OPEN — LATE WINDOW"
        : w;

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Teacher / Attendance</div>
          <h1>Today&apos;s Attendance</h1>
          <p className="sub">
            Server time authoritative. Closed sessions locked.
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
      <div className="grid">
        {sessions.map((s) => (
          <div className="card" key={s._id}>
            <div className="row between">
              <b>
                {s.subjectId?.code ?? "Class"} · {s.startTime}–{s.endTime}
              </b>
              <span className="pill draft">{badge(s.window)}</span>
            </div>
            <p className="sub">
              {s.teacherId?.name} · {s.classGroupId?.name} · {s.status}
            </p>
            <button onClick={() => openDetail(s._id)}>Open</button>
          </div>
        ))}
      </div>
      {sessions.length === 0 && (
        <p className="sub">
          No open sessions today. Open one from a routine entry via API.
        </p>
      )}
      {detail && (
        <div className="card">
          <div className="row between">
            <b>Session {badge(detail.window)}</b>
            <span className="sub">
              P {detail.counts.PRESENT ?? 0} · L {detail.counts.LATE ?? 0} · A{" "}
              {detail.counts.ABSENT ?? 0}
            </span>
          </div>
          {detail.records.length === 0 ? (
            <p className="sub">No marks yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Roll</th>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  {can("attendance.take") && <th scope="col">Mark</th>}
                </tr>
              </thead>
              <tbody>
                {detail.records.map((r) => (
                  <tr key={r._id}>
                    <td>{r.studentId?.roll}</td>
                    <td>{r.studentId?.name}</td>
                    <td>
                      <span className="pill draft">{r.status}</span>
                    </td>
                    {can("attendance.take") && (
                      <td>
                        <div className="row">
                          <button
                            onClick={() =>
                              mark(r.studentId?._id ?? "", "PRESENT")
                            }
                          >
                            P
                          </button>
                          <button
                            onClick={() => mark(r.studentId?._id ?? "", "LATE")}
                          >
                            L
                          </button>
                          <button
                            onClick={() =>
                              mark(r.studentId?._id ?? "", "ABSENT")
                            }
                          >
                            A
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
