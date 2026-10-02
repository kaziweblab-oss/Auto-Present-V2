import { useEffect, useState } from "react";
import { api } from "./lib";

type Overview = {
  users: {
    total: number;
    active: number;
    byRole: { _id: string; n: number }[];
  };
  sessions: { total: number; active: { name: string; state: string } | null };
  departments: number;
  students: number;
  teachers: number;
  attendance: { openClassesToday: number; recordsTotal: number };
  pending: { replacements: number; transfers: number };
  recentAudits: {
    _id: string;
    action: string;
    entity?: string;
    createdAt: string;
  }[];
  db: { configured: boolean };
};

type AuditItem = {
  _id: string;
  action: string;
  entity?: string;
  entityId?: string;
  role?: string;
  actorUserId?: string;
  createdAt: string;
  before?: unknown;
  after?: unknown;
};
type Setting = { _id: string; key: string; value: unknown };

export default function Admin({ can }: { can: (p: string) => boolean }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<{
    total: number;
    byAction: { _id: string; n: number }[];
  } | null>(null);
  const [detail, setDetail] = useState<AuditItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  function auditParams(p = 1) {
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (role) params.set("role", role);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }

  async function load() {
    setError(null);
    try {
      const [o, a] = await Promise.all([
        api<Overview>("/api/v1/admin/overview"),
        api<{ items: AuditItem[]; total: number }>(
          `/api/v1/admin/audit?${auditParams(1)}`,
        ),
      ]);
      setOv(o);
      setAudits(a.items);
      setTotal(a.total);
      setPage(1);
      const [acts, rep] = await Promise.all([
        api<string[]>("/api/v1/admin/audit/actions"),
        api<{ total: number; byAction: { _id: string; n: number }[] }>(
          "/api/v1/admin/reports/summary",
        ),
      ]);
      setActions(acts);
      setSummary(rep);
      if (can("settings.manage")) {
        setSettings(await api<Setting[]>("/api/v1/admin/settings"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchAudit(p = 1) {
    try {
      const r = await api<{ items: AuditItem[]; total: number }>(
        `/api/v1/admin/audit?${auditParams(p)}`,
      );
      setAudits(r.items);
      setTotal(r.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Super Admin</div>
          <h1>System Dashboard</h1>
          <p className="sub">
            DB {ov?.db.configured ? "configured" : "not configured"} · real
            counts, no mocks
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
        <div className="card">
          <b>Users</b>
          <p className="sub">
            {ov?.users.total ?? "—"} total · {ov?.users.active ?? "—"} active
          </p>
          <p className="sub">
            {ov?.users.byRole.map((r) => `${r._id}:${r.n}`).join(" · ")}
          </p>
        </div>
        <div className="card">
          <b>Active session</b>
          <p className="sub">
            {ov?.sessions.active
              ? `${ov.sessions.active.name} (${ov.sessions.active.state})`
              : "none"}{" "}
            · {ov?.sessions.total ?? "—"} total
          </p>
        </div>
        <div className="card">
          <b>Institute</b>
          <p className="sub">
            {ov?.departments ?? "—"} depts · {ov?.students ?? "—"} students ·{" "}
            {ov?.teachers ?? "—"} teachers
          </p>
        </div>
        <div className="card">
          <b>Today</b>
          <p className="sub">
            {ov?.attendance.openClassesToday ?? "—"} open classes ·{" "}
            {ov?.pending.replacements ?? "—"} pending replacements ·{" "}
            {ov?.pending.transfers ?? "—"} transfers
          </p>
        </div>
      </div>
      <div className="card">
        <div className="row between">
          <b>Audit log ({total})</b>
          <span className="row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action/entity"
              aria-label="Audit search"
            />
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Action filter"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="Entity"
              aria-label="Entity filter"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role"
              aria-label="Role filter"
            />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To"
            />
            <button onClick={() => searchAudit(1)}>Search</button>
            <a
              href={`/api/v1/admin/audit/export?${auditParams(1)}`}
              target="_blank"
              rel="noreferrer"
            >
              <button>Export CSV</button>
            </a>
          </span>
        </div>
        {summary && (
          <p className="sub">
            {summary.total} events · top:{" "}
            {summary.byAction
              .slice(0, 5)
              .map((a) => `${a._id}:${a.n}`)
              .join(" · ")}
          </p>
        )}
        {audits.length === 0 ? (
          <p className="sub">No audit records.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Role</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a._id}>
                  <td>{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.action}</td>
                  <td>{a.entity ?? "—"}</td>
                  <td>{a.role ?? "—"}</td>
                  <td>
                    <button onClick={() => setDetail(a)}>Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row between">
          <button disabled={page <= 1} onClick={() => searchAudit(page - 1)}>
            Prev
          </button>
          <span className="sub">Page {page}</span>
          <button onClick={() => searchAudit(page + 1)}>Next</button>
        </div>
      </div>
      {detail && (
        <div className="card">
          <div className="row between">
            <b>{detail.action}</b>
            <button onClick={() => setDetail(null)}>Close</button>
          </div>
          <pre className="sub">
            {JSON.stringify(
              { before: detail.before, after: detail.after },
              null,
              2,
            )}
          </pre>
        </div>
      )}
      {can("settings.manage") && (
        <div className="card">
          <b>System settings ({settings.length})</b>
          {settings.slice(0, 30).map((s) => (
            <p className="sub" key={s._id}>
              {s.key} = {JSON.stringify(s.value)}
            </p>
          ))}
          {settings.length === 0 && (
            <p className="sub">
              No settings yet — created by replacement/calendar/shift flows.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
