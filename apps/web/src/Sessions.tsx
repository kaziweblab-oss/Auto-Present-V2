import { useEffect, useState } from "react";
import { api, type Me, type Session } from "./lib";

export default function Sessions() {
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const can = (p: string) => me?.permissions.includes(p) ?? false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([
        api<Me>("/api/v1/auth/me"),
        api<Session[]>("/api/v1/sessions"),
      ]);
      setMe(m);
      setSessions(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    try {
      await api("/api/v1/sessions", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function act(id: string, action: "activate" | "close" | "archive") {
    setError(null);
    if (!confirm(`Confirm session ${action}?`)) return;
    try {
      await api(`/api/v1/sessions/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Principal / Sessions</div>
          <h1>Sessions</h1>
          <p className="sub">
            DRAFT → ACTIVE → CLOSED → ARCHIVED. Only Principal
            creates/activates.
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
      {can("session.create") && (
        <div className="card row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2026-27"
            aria-label="New session name"
          />
          <button onClick={create} disabled={!name}>
            Create DRAFT
          </button>
        </div>
      )}
      {loading ? (
        <p className="sub">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="card">
          <p className="sub">No sessions yet. Create the first DRAFT.</p>
        </div>
      ) : (
        <div className="grid">
          {sessions.map((s) => (
            <div className="card" key={s._id}>
              <div className="row between">
                <b>{s.name}</b>
                <span className={`pill ${s.state.toLowerCase()}`}>
                  {s.state}
                </span>
              </div>
              <p className="sub">
                {s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"}{" "}
                → {s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}
              </p>
              <div className="row">
                {s.state === "DRAFT" && can("session.activate") && (
                  <button onClick={() => act(s._id, "activate")}>
                    Activate
                  </button>
                )}
                {s.state === "ACTIVE" && can("session.close") && (
                  <button onClick={() => act(s._id, "close")}>Close</button>
                )}
                {s.state === "CLOSED" && can("session.close") && (
                  <>
                    <button onClick={() => act(s._id, "archive")}>
                      Archive
                    </button>
                    {can("session.activate") && (
                      <button onClick={() => act(s._id, "activate")}>
                        Reactivate
                      </button>
                    )}
                  </>
                )}
                {s.state === "ARCHIVED" && (
                  <span className="sub">View only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
