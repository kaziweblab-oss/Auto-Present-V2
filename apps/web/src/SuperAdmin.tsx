import { useEffect, useState } from 'react';
import { useTheme, api } from './lib';

interface User { _id: string; email: string; displayName: string; roles: string[]; }
interface Audit { _id: string; action: string; entity?: string; createdAt: string; }

export default function SuperAdminPage() {
  const [theme, toggleTheme] = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [dbCurrent, setDbCurrent] = useState('');
  const [dbUri, setDbUri] = useState('');
  const [dbMsg, setDbMsg] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const st = await api<{ dbConfigured: boolean }>('/api/v1/setup/status');
        setDbConfigured(st.dbConfigured);
        if (st.dbConfigured) {
          try {
            const db = await api<{ current: string | null }>('/api/v1/setup/database');
            setDbCurrent(db.current ?? '');
          } catch { /* rotations need full DB; ignore */ }
        }
        setUsers(await api<User[]>('/api/v1/super-admin/users'));
        setLogs(await api<Audit[]>('/api/v1/super-admin/audit'));
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  async function saveDb() {
    setDbMsg('');
    try {
      await api('/api/v1/setup/database', { method: 'POST', body: JSON.stringify({ uri: dbUri }) });
      setDbConfigured(true);
      setDbUri('');
      setDbMsg('Database connected and saved.');
    } catch (e) { setDbMsg((e as Error).message); }
  }

  const shown = users.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/app-icon.png" alt="app icon" /><div><b>AUTO PRESENT</b><span>Super Admin</span></div></div>
        <nav><button className="active">Dashboard</button><button>Users</button><button>Roles & Permissions</button><button>Audit Logs</button><button>Database Setup</button><button>Backup & Restore</button></nav>
        <button className="theme" onClick={toggleTheme}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </aside>
      <main>
        <h1>System Overview</h1>
        <p className="sub">Welcome back, Super Admin. Seeded later via INITIAL_SUPER_ADMIN_EMAIL (DB-backed).</p>
        {error && <p className="err">{error} (API running? demo headers?)</p>}
        <div className="stats">
          <div className="stat"><small>Total Users</small><h2>{users.length}</h2><span className="tag">in system</span></div>
          <div className="stat"><small>Total Roles</small><h2>6</h2><span className="tag">RBAC matrix</span></div>
          <div className="stat"><small>Database</small><h2 style={{ fontSize: 20 }}>{dbConfigured === null ? '…' : dbConfigured ? 'Connected' : 'Setup needed'}</h2><span className="tag">{dbCurrent || 'no uri yet'}</span></div>
          <div className="stat"><small>Audit Events</small><h2>{logs.length}</h2><span className="tag">recent 200</span></div>
        </div>
        <section>
          <div className="sec-head"><h2>Database Setup</h2></div>
          {dbConfigured === false && <p>Paste the free MongoDB Atlas connection string below. Saved on this server only, never in env/git.</p>}
          <div className="dbrow"><input value={dbUri} onChange={(e) => setDbUri(e.target.value)} placeholder="mongodb+srv://..." /><button className="btn" onClick={saveDb}>Connect & Save</button></div>
          {dbMsg && <p className="muted">{dbMsg}</p>}
        </section>
        <section>
          <div className="sec-head"><h2>Recent Users</h2><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything..." /></div>
          <table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{shown.map((u) => (
            <tr key={u._id}><td><b>{u.displayName}</b></td><td>{u.email}</td><td>{u.roles.join(', ') || '—'}</td><td><span className="pill ok">Active</span></td></tr>
          ))}</tbody></table>
          {shown.length === 0 && <p className="muted">No users yet.</p>}
        </section>
        <section>
          <div className="sec-head"><h2>Audit Logs</h2></div>
          <table className="tbl"><thead><tr><th>Action</th><th>Entity</th><th>Time</th></tr></thead>
          <tbody>{logs.slice(0, 10).map((l) => (
            <tr key={l._id}><td>{l.action}</td><td>{l.entity ?? '—'}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>
          ))}</tbody></table>
        </section>
      </main>
    </div>
  );
}
