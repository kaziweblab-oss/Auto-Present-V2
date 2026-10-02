import { useEffect, useState } from "react";
import { api } from "./lib";

type Imp = {
  _id: string;
  fileName?: string;
  noticeDate?: string;
  totalRows: number;
  matched: number;
  unmatched: string[];
  status: string;
};
type Tr = {
  _id: string;
  roll: string;
  status: string;
  studentId: { name: string } | null;
};

export default function Transfers({ can }: { can: (p: string) => boolean }) {
  const [imports, setImports] = useState<Imp[]>([]);
  const [rows, setRows] = useState<Tr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [importId, setImportId] = useState("");

  async function load() {
    setError(null);
    try {
      const params = importId ? `?importId=${importId}` : "";
      const [im, r] = await Promise.all([
        api<Imp[]>("/api/v1/transfers/imports"),
        api<Tr[]>(`/api/v1/transfers${params}`),
      ]);
      setImports(im);
      setRows(r);
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
          <div className="crumb">Principal / Transfers</div>
          <h1>Student Transfers</h1>
          <p className="sub">
            Upload → validate → preview → approve → process. Never silent.
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
      {can("transfer.import") && (
        <>
          <div className="card">
            <b>1. Extract from official notice text</b>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
              aria-label="Notice text"
            />
            <button
              onClick={async () => {
                try {
                  const r = await api<{ rolls: string[] }>(
                    "/api/v1/transfers/parse",
                    {
                      method: "POST",
                      body: JSON.stringify({ text }),
                    },
                  );
                  setError(null);
                  alert(`Found rolls: ${r.rolls.join(", ") || "none"}`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Parse failed");
                }
              }}
            >
              Extract rolls
            </button>
          </div>
          <div className="card">
            <b>2. Upload rows (JSON)</b>
            <p className="sub">
              {
                "{ fileName, noticeDate, sourceInstitute, destinationInstitute, rows: [{roll}] }"
              }
            </p>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
              aria-label="Import JSON"
            />
            <button
              onClick={async () => {
                try {
                  await api("/api/v1/transfers/imports", {
                    method: "POST",
                    body: JSON.stringify(JSON.parse(json)),
                  });
                  setJson("");
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Import failed");
                }
              }}
            >
              Upload + Validate
            </button>
          </div>
        </>
      )}
      <div className="card row">
        <input
          value={importId}
          onChange={(e) => setImportId(e.target.value)}
          placeholder="Import ID filter"
          aria-label="Import filter"
        />
        <button onClick={load}>Filter</button>
      </div>
      <div className="card">
        <b>Imports</b>
        {imports.map((i) => (
          <div className="row between" key={i._id}>
            <span className="sub">
              {i.fileName ?? i._id} · {i.matched}/{i.totalRows} · {i.status}
            </span>
            {can("transfer.approve") &&
              (i.status === "VALIDATED" || i.status === "PENDING") && (
                <span className="row">
                  <button
                    onClick={async () => {
                      await api(`/api/v1/transfers/imports/${i._id}/approve`, {
                        method: "POST",
                      });
                      await load();
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await api(`/api/v1/transfers/imports/${i._id}/process`, {
                        method: "POST",
                      });
                      await load();
                    }}
                  >
                    Process
                  </button>
                </span>
              )}
          </div>
        ))}
        {imports.length === 0 && <p className="sub">No imports.</p>}
      </div>
      <div className="card">
        <b>Transfers</b>
        {rows.slice(0, 100).map((t) => (
          <p className="sub" key={t._id}>
            {t.roll} · {t.studentId?.name ?? "unmatched"} · {t.status}
          </p>
        ))}
        {rows.length === 0 && <p className="sub">No transfers.</p>}
      </div>
    </section>
  );
}
