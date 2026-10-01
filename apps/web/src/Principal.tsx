import { useEffect, useState } from 'react';
import { useTheme, api } from './lib';

interface Session { _id: string; name: string; state: string; startDate?: string; endDate?: string; }

const pillFor = (s: string) =>
  s === 'ACTIVE' ? 'ok' : s === 'DRAFT' ? 'warn' : s === 'CLOSED' ? 'info' : 'mut';

export default function PrincipalPage() {
  const [theme, toggleTheme] = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setSessions(await api<Session[]>('/api/v1/principal/sessions'));
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
  const shown = sessions.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/app-icon.png" alt="app icon" /><div><b>AUTO PRESENT</b><span>Principal</span></div></div>
        <nav><button className="active">Academic Sessions</button><button>Overview</button><button>Notices</button><button>Calendar</button><button>Shift Merge</button></nav>
        <button className="theme" onClick={toggleTheme}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </aside>
      <main>
        <h1>Academic Sessions</h1>
        <p className="sub">Manage institute sessions and their lifecycle. DRAFT → ACTIVE → CLOSED → ARCHIVED.</p>
        {error && <p className="err">{error}</p>}
        <div className="stats">
          <div className="stat"><small>DRAFT</small><h2>{counts('DRAFT')}</h2><span className="tag">ready to activate</span></div>
          <div className="stat"><small>ACTIVE</small><h2>{counts('ACTIVE')}</h2><span className="tag">only one at a time</span></div>
          <div className="stat"><small>CLOSED</small><h2>{counts('CLOSED')}</h2><span className="tag">history kept</span></div>
          <div className="stat"><small>ARCHIVED</small><h2>{counts('ARCHIVED')}</h2><span className="tag">read-only</span></div>
        </div>
        <section>
          <div className="sec-head"><h2>Create session</h2></div>
          <div className="dbrow"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-27" /><button className="btn" onClick={create}>+ Create Session</button></div>
          {msg && <p className="muted">{msg}</p>}
        </section>
        <section>
          <div className="sec-head"><h2>Sessions</h2><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions..." /></div>
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
      </main>
    </div>
  );
}
