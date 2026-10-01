import { useEffect, useState } from 'react';
import { useTheme, api } from './lib';

interface Session { _id: string; name: string; state: string; startDate?: string; endDate?: string; }
interface Overview { sessions: Session[]; usersByRole: { _id: string; n: number }[]; auditCount: number; }

const pillFor = (s: string) =>
  s === 'ACTIVE' ? 'ok' : s === 'DRAFT' ? 'warn' : s === 'CLOSED' ? 'info' : 'mut';

export default function PrincipalPage() {
  const [theme, toggleTheme] = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [ss, ov] = await Promise.all([
        api<Session[]>('/api/v1/principal/sessions'),
        api<Overview>('/api/v1/principal/overview'),
      ]);
      setSessions(ss);
      setOverview(ov);
      setError('');
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);

  async function act(id: string, op: 'activate' | 'close' | 'archive') {
    setMsg('');
    try {
      await api(`/api/v1/principal/sessions/${id}/${op}`, { method: 'POST' });
      await load();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function create() {
    setMsg('');
    try {
      await api('/api/v1/principal/sessions', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
    } catch (e) { setMsg((e as Error).message); }
  }

  const counts = (st: string) => sessions.filter((s) => s.state === st).length;
  const active = sessions.find((s) => s.state === 'ACTIVE');
  const shown = sessions.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/app-icon.png" alt="app icon" /><div><b>AUTO PRESENT</b><span>Principal</span></div></div>
        <nav>
          <button className="active">Academic Sessions</button><button>Overview</button><button>Notices</button>
          <button>Calendar</button><button>Shift Merge</button><button>Reports</button>
        </nav>
        <button className="theme" onClick={toggleTheme}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </aside>
      <main>
        <div className="crumb">Principal / Academic Sessions</div>
        <h1>Good Morning, Principal</h1>
        <p className="sub">Active session {active ? <b>{active.name}</b> : '— none'}. Only one ACTIVE at a time.</p>
        {error && <p className="err">{error}</p>}
        <div className="stats">
          <div className="stat"><div className="ic">S</div><div><small>Sessions</small><h2>{sessions.length}</h2><span className="tag">DRAFT→ACTIVE→CLOSED</span></div></div>
          <div className="stat"><div className="ic">A</div><div><small>Active Session</small><h2 style={{ fontSize: 19 }}>{active?.name ?? '—'}</h2><span className="tag">institute running</span></div></div>
          <div className="stat"><div className="ic">U</div><div><small>Users</small><h2>{overview ? overview.usersByRole.reduce((a, r) => a + r.n, 0) : '…'}</h2><span className="tag">all roles</span></div></div>
          <div className="stat"><div className="ic">L</div><div><small>Audit Events</small><h2>{overview?.auditCount ?? '…'}</h2><span className="tag">audited</span></div></div>
        </div>
        <div className="cols">
          <section>
            <div className="sec-head"><h2>Academic Sessions</h2><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions..." /></div>
            <table className="tbl"><thead><tr><th>Session</th><th>Status</th><th>Start Date</th><th>End Date</th><th>Actions</th></tr></thead>
            <tbody>{shown.map((s) => (
              <tr key={s._id}>
                <td><b>{s.name}</b></td>
                <td><span className={`pill ${pillFor(s.state)}`}>{s.state}</span></td>
                <td>{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                <td>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                <td><span className="actions">
                  {s.state === 'DRAFT' && <button className="btn sm" onClick={() => act(s._id, 'activate')}>Activate</button>}
                  {s.state === 'ACTIVE' && <button className="btn sm ghost" onClick={() => act(s._id, 'close')}>Close</button>}
                  {s.state === 'CLOSED' && <button className="btn sm ghost" onClick={() => act(s._id, 'archive')}>Archive</button>}
                  {s.state === 'ARCHIVED' && <span className="muted">—</span>}
                </span></td>
              </tr>
            ))}</tbody></table>
            {shown.length === 0 && <p className="muted">No sessions yet.</p>}
          </section>
          <div>
            <section>
              <div className="sec-head"><h2>Create Session</h2></div>
              <div className="dbrow"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-27" /><button className="btn" onClick={create}>+ Create</button></div>
              {msg && <p className="muted">{msg}</p>}
            </section>
            <section>
              <div className="sec-head"><h2>Lifecycle</h2></div>
              <div className="rowline"><span>DRAFT</span><span className="pill warn">{counts('DRAFT')}</span></div>
              <div className="rowline"><span>ACTIVE</span><span className="pill ok">{counts('ACTIVE')}</span></div>
              <div className="rowline"><span>CLOSED</span><span className="pill info">{counts('CLOSED')}</span></div>
              <div className="rowline"><span>ARCHIVED</span><span className="pill mut">{counts('ARCHIVED')}</span></div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
