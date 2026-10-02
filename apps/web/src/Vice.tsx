import { useEffect, useState } from "react";
import { api } from "./lib";

type Ov = {
  activeSession: { name: string; state: string } | null;
  students: number;
  teachers: number;
  departments: { _id: string; code: string; enrollments: number }[];
  attendance: {
    openClassesToday: number;
    closedClassesToday: number;
    recordsTotal: number;
  };
  notices: { _id: string; title: string; priority: string }[];
  results: { _id: string; n: number }[];
  transfers: { pending: number };
  dropped: number;
  alerts: string[];
};

export default function Vice() {
  const [ov, setOv] = useState<Ov | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setOv(await api<Ov>("/api/v1/vp/overview"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Vice Principal / Overview</div>
          <h1>Institute Overview</h1>
          <p className="sub">
            Read-only operational visibility ·{" "}
            {ov?.activeSession ? ov.activeSession.name : "no active session"}
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
      {ov?.alerts.map((a) => (
        <p className="err" key={a}>
          ⚠ {a}
        </p>
      ))}
      <div className="grid">
        <div className="card">
          <b>Students</b>
          <p className="sub">{ov?.students ?? "—"} total</p>
        </div>
        <div className="card">
          <b>Teachers</b>
          <p className="sub">{ov?.teachers ?? "—"} total</p>
        </div>
        <div className="card">
          <b>Attendance today</b>
          <p className="sub">
            {ov?.attendance.openClassesToday ?? "—"} open ·{" "}
            {ov?.attendance.closedClassesToday ?? "—"} closed ·{" "}
            {ov?.attendance.recordsTotal ?? "—"} records
          </p>
        </div>
        <div className="card">
          <b>Workflows</b>
          <p className="sub">
            {ov?.transfers.pending ?? "—"} transfers pending ·{" "}
            {ov?.dropped ?? "—"} dropped
          </p>
        </div>
      </div>
      <div className="card">
        <b>Departments</b>
        {ov?.departments.map((d) => (
          <p className="sub" key={d._id}>
            {d.code} · {d.enrollments} enrollments
          </p>
        ))}
      </div>
      <div className="card">
        <b>Results</b>
        <p className="sub">
          {ov?.results.map((r) => `${r._id}:${r.n}`).join(" · ") ||
            "No results"}
        </p>
      </div>
      <div className="card">
        <b>Recent notices</b>
        {ov?.notices.map((n) => (
          <p className="sub" key={n._id}>
            [{n.priority}] {n.title}
          </p>
        ))}
        {ov?.notices.length === 0 && <p className="sub">No notices.</p>}
      </div>
    </section>
  );
}
