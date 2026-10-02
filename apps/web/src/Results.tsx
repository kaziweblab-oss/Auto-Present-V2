import { useEffect, useState } from "react";
import { api } from "./lib";

type Import = {
  _id: string;
  source: string;
  publicationDate: string;
  totalRows: number;
  matched: number;
  unmatched: string[];
};
type Row = {
  _id: string;
  overallStatus: string;
  gpa?: number;
  studentId: { name: string; roll: string } | null;
  sessionId: { name: string } | null;
};
type Drop = {
  _id: string;
  studentId: { name: string; roll: string } | null;
  sessionId: { name: string } | null;
};

type Rev = { _id: string; oldStatus: string; newStatus: string; note?: string };

export default function Results({ can }: { can: (p: string) => boolean }) {
  const [imports, setImports] = useState<Import[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dropped, setDropped] = useState<Drop[]>([]);
  const [revs, setRevs] = useState<Rev[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [rev, setRev] = useState({
    studentId: "",
    fromSessionId: "",
    toSessionId: "",
    newStatus: "PASSED",
    note: "",
  });

  async function load() {
    setError(null);
    try {
      const params = sessionId ? `?sessionId=${sessionId}` : "";
      const [im, r, d, v] = await Promise.all([
        api<Import[]>("/api/v1/results/imports"),
        api<Row[]>(`/api/v1/results${params}`),
        api<Drop[]>(`/api/v1/results/dropped${params}`),
        api<Rev[]>("/api/v1/revisions"),
      ]);
      setImports(im);
      setRows(r);
      setDropped(d);
      setRevs(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doImport() {
    setError(null);
    try {
      const payload = JSON.parse(json);
      await api("/api/v1/results/imports", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setJson("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Principal / Results</div>
          <h1>BTEB Results</h1>
          <p className="sub">
            {rows.length} results · {dropped.length} dropped · source-tracked
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
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Session ID filter"
          aria-label="Session filter"
        />
        <button onClick={load}>Filter</button>
      </div>
      {can("result.import") && (
        <div className="card">
          <b>Import official result (JSON)</b>
          <p className="sub">
            {
              "{ sessionId, departmentId, source, publicationDate, rows: [{roll, overallStatus, gpa, subjects}] }"
            }
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={4}
            style={{ width: "100%" }}
            aria-label="Import JSON"
          />
          <div className="row">
            <button onClick={doImport}>Import</button>
          </div>
        </div>
      )}
      <div className="card">
        <b>Import history (official source)</b>
        {imports.length === 0 ? (
          <p className="sub">No imports.</p>
        ) : (
          imports.map((i) => (
            <p className="sub" key={i._id}>
              {i.source} · {new Date(i.publicationDate).toLocaleDateString()} ·{" "}
              {i.matched}/{i.totalRows} matched
              {i.unmatched.length > 0 &&
                ` · unmatched: ${i.unmatched.join(", ")}`}
            </p>
          ))
        )}
      </div>
      <div className="card">
        <b>Session results</b>
        {rows.length === 0 ? (
          <p className="sub">No results.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Roll</th>
                <th scope="col">Name</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">GPA</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r) => (
                <tr key={r._id}>
                  <td>{r.studentId?.roll}</td>
                  <td>{r.studentId?.name}</td>
                  <td>{r.sessionId?.name}</td>
                  <td>
                    <span className="pill draft">{r.overallStatus}</span>
                  </td>
                  <td>{r.gpa ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <b>Dropped (official)</b>
        {dropped.length === 0 ? (
          <p className="sub">No dropped students.</p>
        ) : (
          dropped.map((d) => (
            <p className="sub" key={d._id}>
              {d.studentId?.roll} · {d.studentId?.name} · {d.sessionId?.name}
            </p>
          ))
        )}
      </div>
      {can("result.revise") && (
        <div className="card">
          <b>Board-challenge revision (restore)</b>
          <div className="row">
            <input
              value={rev.studentId}
              onChange={(e) => setRev({ ...rev, studentId: e.target.value })}
              placeholder="Student ID"
              aria-label="Student"
            />
            <input
              value={rev.fromSessionId}
              onChange={(e) =>
                setRev({ ...rev, fromSessionId: e.target.value })
              }
              placeholder="From session ID"
              aria-label="From"
            />
            <input
              value={rev.toSessionId}
              onChange={(e) => setRev({ ...rev, toSessionId: e.target.value })}
              placeholder="To session ID"
              aria-label="To"
            />
            <select
              value={rev.newStatus}
              onChange={(e) => setRev({ ...rev, newStatus: e.target.value })}
              aria-label="New status"
            >
              {["PASSED", "FAILED", "DROPPED", "RETAINED", "COMPLETED"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
            <input
              value={rev.note}
              onChange={(e) => setRev({ ...rev, note: e.target.value })}
              placeholder="Note"
              aria-label="Note"
            />
            <button
              onClick={async () => {
                try {
                  await api("/api/v1/revisions", {
                    method: "POST",
                    body: JSON.stringify({
                      ...rev,
                      publicationDate: new Date().toISOString(),
                    }),
                  });
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Revise failed");
                }
              }}
            >
              Revise + Restore
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <b>Revision history</b>
        {revs.length === 0 ? (
          <p className="sub">No revisions.</p>
        ) : (
          revs.slice(0, 50).map((v) => (
            <p className="sub" key={v._id}>
              {v.oldStatus} → {v.newStatus}
              {v.note ? ` · ${v.note}` : ""}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
