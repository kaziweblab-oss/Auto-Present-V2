import { useEffect, useState } from "react";
import { api } from "./lib";

type Ov = {
  teacher: { name: string; employeeId: string } | null;
  today: {
    date: string;
    weekday: string;
    routines: {
      _id: string;
      startTime: string;
      endTime: string;
      subjectId: { code: string } | null;
      classGroupId: { name: string } | null;
    }[];
    sessions: { _id: string; status: string }[];
  };
  replacements: {
    incoming: { _id: string; status: string }[];
    outgoing: { _id: string; status: string }[];
  };
  notices: { _id: string; title: string }[];
  captains: { _id: string; studentId: { name: string } | null }[];
  weekRoutine: { _id: string; day: string; startTime: string }[];
};

export default function TeacherDash() {
  const [ov, setOv] = useState<Ov | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const q = teacherId ? `?teacherId=${teacherId}` : "";
      setOv(await api<Ov>(`/api/v1/teacher/overview${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Teacher / Today</div>
          <h1>
            {ov?.teacher ? `${ov.teacher.name} — Today` : "Teacher Dashboard"}
          </h1>
          <p className="sub">
            {ov?.today.date} ({ov?.today.weekday}) ·{" "}
            {ov?.today.routines.length ?? "—"} classes ·{" "}
            {ov?.replacements.incoming.length ?? "—"} incoming requests
          </p>
        </div>
        <span className="row">
          <input
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Teacher ID"
            aria-label="Teacher"
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
          <b>Today&apos;s classes</b>
          {ov?.today.routines.map((r) => (
            <p className="sub" key={r._id}>
              {r.startTime}–{r.endTime} · {r.subjectId?.code} ·{" "}
              {r.classGroupId?.name}
            </p>
          ))}
          {ov?.today.routines.length === 0 && (
            <p className="sub">No classes today.</p>
          )}
        </div>
        <div className="card">
          <b>Replacements</b>
          <p className="sub">
            Incoming: {ov?.replacements.incoming.length ?? "—"} · Outgoing:{" "}
            {ov?.replacements.outgoing.length ?? "—"}
          </p>
        </div>
        <div className="card">
          <b>Captains</b>
          {ov?.captains.map((c) => (
            <p className="sub" key={c._id}>
              {c.studentId?.name}
            </p>
          ))}
          {ov?.captains.length === 0 && <p className="sub">No captains.</p>}
        </div>
        <div className="card">
          <b>Notices</b>
          {ov?.notices.map((n) => (
            <p className="sub" key={n._id}>
              {n.title}
            </p>
          ))}
        </div>
      </div>
      <div className="card">
        <b>Week routine ({ov?.weekRoutine.length ?? 0})</b>
        <p className="sub">
          {ov?.weekRoutine.map((r) => `${r.day} ${r.startTime}`).join(" · ") ||
            "Empty"}
        </p>
      </div>
    </section>
  );
}
