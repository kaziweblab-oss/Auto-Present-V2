import { useEffect, useState } from "react";
import { api } from "./lib";

type Ov = {
  department: { code: string; name: string } | null;
  session: { name: string; state: string } | null;
  students: number;
  teachers: number;
  captains: number;
  routines: number;
  openClassesToday: number;
  results: { _id: string; n: number }[];
  dropped: number;
  transfersPending: number;
  notices: { _id: string; title: string }[];
  alerts: string[];
};

export default function CI() {
  const [ov, setOv] = useState<Ov | null>(null);
  const [dept, setDept] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const q = dept ? `?departmentId=${dept}` : "";
      setOv(await api<Ov>(`/api/v1/ci/overview${q}`));
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
          <div className="crumb">CI / Department</div>
          <h1>
            {ov?.department
              ? `${ov.department.code} Dashboard`
              : "CI Dashboard"}
          </h1>
          <p className="sub">
            {ov?.session
              ? `${ov.session.name} (${ov.session.state})`
              : "No active session"}{" "}
            · scoped to your department
          </p>
        </div>
        <span className="row">
          <input
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            placeholder="Dept ID (Principal)"
            aria-label="Department"
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
      {ov?.alerts.map((a) => (
        <p className="err" key={a}>
          ⚠ {a}
        </p>
      ))}
      <div className="grid">
        <div className="card">
          <b>Students</b>
          <p className="sub">{ov?.students ?? "—"} enrollments</p>
        </div>
        <div className="card">
          <b>Teachers</b>
          <p className="sub">
            {ov?.teachers ?? "—"} · captains {ov?.captains ?? "—"}
          </p>
        </div>
        <div className="card">
          <b>Routine</b>
          <p className="sub">
            {ov?.routines ?? "—"} periods · {ov?.openClassesToday ?? "—"} open
            today
          </p>
        </div>
        <div className="card">
          <b>Workflows</b>
          <p className="sub">
            dropped {ov?.dropped ?? "—"} · transfers{" "}
            {ov?.transfersPending ?? "—"}
          </p>
        </div>
      </div>
      <div className="card">
        <b>Results</b>
        <p className="sub">
          {ov?.results.map((r) => `${r._id}:${r.n}`).join(" · ") ||
            "No results"}
        </p>
      </div>
      <div className="card">
        <b>Department notices</b>
        {ov?.notices.map((n) => (
          <p className="sub" key={n._id}>
            {n.title}
          </p>
        ))}
        {ov?.notices.length === 0 && <p className="sub">No notices.</p>}
      </div>
    </section>
  );
}
