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

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/app-icon.png" alt="app icon" /><div><b>AUTO PRESENT</b><span>Super Admin</span></div></div>
        <nav><button className="active">Users & Roles</button><button>Audit Logs</button><button>Sessions (read)</button><button>Database</button></nav>
        <button className="theme" onClick={toggleTheme}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </aside>
      <main>
        <h1>Super Admin</h1>
        <p className="sub">System config - users, roles, audit. Seeded later via INITIAL_SUPER_ADMIN_EMAIL (DB-backed).</p>
        {error && <p className="err">{error} (API running? demo headers?)</p>}
        <section><h2>Database {dbConfigured === null ? '' : dbConfigured ? '(connected)' : '(SETUP_NEEDED)'}</h2>
          {dbConfigured === false && <p>Paste the free MongoDB Atlas connection string below. Saved on this server only, never in env/git.</p>}
          {dbConfigured && dbCurrent && <p className="muted">Current: {dbCurrent} (credentials hidden)</p>}
          <div className="dbrow"><input value={dbUri} onChange={(e) => setDbUri(e.target.value)} placeholder="mongodb+srv://..." /><button onClick={saveDb}>Connect & Save</button></div>
          {dbMsg && <p className="muted">{dbMsg}</p>}
        </section>
        <section><h2>Users ({users.length})</h2>
          {users.map((u) => <div className="row" key={u._id}><span>{u.displayName} - {u.email}</span><span className="pill">{u.roles.join(', ') || 'no role'}</span></div>)}
          {users.length === 0 && <p className="muted">No users yet.</p>}
        </section>
        <section><h2>Recent audit ({logs.length})</h2>
          {logs.map((l) => <div className="row" key={l._id}><span>{l.action} {l.entity ?? ''}</span><span className="muted">{new Date(l.createdAt).toLocaleString()}</span></div>)}
        </section>
      </main>
    </div>
  );
}
