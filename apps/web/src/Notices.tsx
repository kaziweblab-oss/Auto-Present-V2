import { useEffect, useState } from "react";
import { api } from "./lib";

type N = {
  _id: string;
  title: string;
  body: string;
  priority: string;
  targetType: string;
  expiresAt?: string;
  ackRequired: boolean;
  read: boolean;
  acknowledgedAt?: string | null;
};

export default function Notices({ can }: { can: (p: string) => boolean }) {
  const [items, setItems] = useState<N[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    targetType: "ALL",
    priority: "NORMAL",
    ackRequired: false,
  });

  async function load() {
    setError(null);
    try {
      setItems(await api<N[]>("/api/v1/notices"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    try {
      await api("/api/v1/notices", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({
        title: "",
        body: "",
        targetType: "ALL",
        priority: "NORMAL",
        ackRequired: false,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">All roles / Notices</div>
          <h1>
            Notices{" "}
            {unread > 0 && <span className="pill draft">{unread} unread</span>}
          </h1>
          <p className="sub">
            Targeted inbox · per-user read · ack where required
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
      {can("notice.create") && (
        <div className="card">
          <b>Publish notice</b>
          <div className="row">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
              aria-label="Title"
            />
            <select
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              aria-label="Target"
            >
              {[
                "ALL",
                "ROLE",
                "DEPARTMENT",
                "SESSION",
                "CLASS",
                "STUDENT",
                "SHIFT",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              aria-label="Priority"
            >
              {["NORMAL", "IMPORTANT", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={form.ackRequired}
                onChange={(e) =>
                  setForm({ ...form, ackRequired: e.target.checked })
                }
              />{" "}
              Ack required
            </label>
          </div>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            style={{ width: "100%" }}
            aria-label="Body"
          />
          <button onClick={create}>Publish</button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="sub">No notices.</p>
      ) : (
        items.map((n) => (
          <div
            className="card"
            key={n._id}
            style={{ opacity: n.read ? 0.85 : 1 }}
          >
            <div className="row between">
              <b>
                {!n.read && "● "}
                {n.title}
              </b>
              <span className="row">
                <span className="pill draft">{n.priority}</span>
                <span className="pill draft">{n.targetType}</span>
              </span>
            </div>
            <p className="sub">{n.body}</p>
            <div className="row">
              {!n.read && (
                <button
                  onClick={async () => {
                    await api(`/api/v1/notices/${n._id}/read`, {
                      method: "POST",
                    });
                    await load();
                  }}
                >
                  Mark read
                </button>
              )}
              {n.ackRequired && !n.acknowledgedAt && (
                <button
                  onClick={async () => {
                    await api(`/api/v1/notices/${n._id}/acknowledge`, {
                      method: "POST",
                    });
                    await load();
                  }}
                >
                  Read & Acknowledge
                </button>
              )}
              {n.acknowledgedAt && <span className="sub">Acknowledged</span>}
              {n.expiresAt && (
                <span className="sub">
                  Expires {new Date(n.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
