import { useEffect, useState } from "react";
import { api } from "./lib";

type Ov = {
  student: {
    name: string;
    roll: string;
    registrationNumber: string;
    status: string;
  } | null;
  current: {
    roll: string;
    shift: string;
    status: string;
    sessionId: { name: string } | null;
  } | null;
  history: {
    _id: string;
    roll: string;
    status: string;
    sessionId: { name: string } | null;
  }[];
  routine: {
    _id: string;
    day: string;
    startTime: string;
    subjectId: { code: string } | null;
  }[];
  attendance: { summary: Record<string, number> };
  results: {
    results: { _id: string; overallStatus: string }[];
    dropped: { _id: string }[];
  };
  transfers: { _id: string; status: string }[];
  notices: { _id: string; title: string }[];
  holidays: { _id: string; date: string; title: string }[];
};

export default function StudentDash() {
  const [ov, setOv] = useState<Ov | null>(null);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const q = studentId ? `?studentId=${studentId}` : "";
      setOv(await api<Ov>(`/api/v1/student/overview${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = ov?.attendance.summary ?? {};

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Student</div>
          <h1>
            {ov?.student
              ? `${ov.student.name} — ${ov.student.roll}`
              : "Student Dashboard"}
          </h1>
          <p className="sub">
            {ov?.current?.sessionId?.name ?? "No session"} ·{" "}
            {ov?.current?.shift ?? "—"} · {ov?.student?.status ?? ""}
          </p>
        </div>
        <span className="row">
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Student ID"
            aria-label="Student"
          />
          <button className="theme-btn" onClick={load}>
            Load
          </button>
        </span>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="grid">
        <div className="card">
          <b>Attendance</b>
          <p className="sub">
            P {s.PRESENT ?? 0} · L {s.LATE ?? 0} · A {s.ABSENT ?? 0} · E{" "}
            {s.EXCUSED ?? 0}
          </p>
        </div>
        <div className="card">
          <b>Results</b>
          <p className="sub">
            {ov?.results.results.map((r) => r.overallStatus).join(", ") ||
              "No results"}{" "}
            · dropped {ov?.results.dropped.length ?? 0}
          </p>
        </div>
        <div className="card">
          <b>Transfers</b>
          <p className="sub">
            {ov?.transfers.map((t) => t.status).join(", ") || "None"}
          </p>
        </div>
        <div className="card">
          <b>Routine</b>
          <p className="sub">
            {ov?.routine.map((r) => `${r.day} ${r.startTime}`).join(" · ") ||
              "Empty"}
          </p>
        </div>
      </div>
      <div className="card">
        <b>Academic history</b>
        {ov?.history.map((h) => (
          <p className="sub" key={h._id}>
            {h.sessionId?.name} · {h.roll} · {h.status}
          </p>
        ))}
      </div>
      <div className="card">
        <b>Notices & holidays</b>
        {ov?.notices.map((n) => (
          <p className="sub" key={n._id}>
            {n.title}
          </p>
        ))}
        {ov?.holidays.map((h) => (
          <p className="sub" key={h._id}>
            {h.date}: {h.title}
          </p>
        ))}
      </div>
    </section>
  );
}
