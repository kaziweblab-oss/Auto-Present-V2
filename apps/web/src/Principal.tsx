import { useEffect, useState } from 'react';
import { useTheme, api } from './lib';

interface Session { _id: string; name: string; state: string; startDate?: string; endDate?: string; }

export default function PrincipalPage() {
  const [theme, toggleTheme] = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
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

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/app-icon.png" alt="app icon" /><div><b>AUTO PRESENT</b><span>Principal</span></div></div>
        <nav><button className="active">Sessions</button><button>Overview</button><button>Notices</button></nav>
        <button className="theme" onClick={toggleTheme}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </aside>
      <main>
        <h1>Academic Sessions</h1>
        <p className="sub">DRAFT → ACTIVE → CLOSED → ARCHIVED. Only one ACTIVE. Only Principal creates/activates/closes.</p>
        {error && <p className="err">{error}</p>}
        <section><h2>Create session</h2>
          <div className="dbrow"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-27" /><button onClick={create}>Create DRAFT</button></div>
          {msg && <p className="muted">{msg}</p>}
        </section>
        <section><h2>Sessions ({sessions.length})</h2>
          {sessions.map((s) => (
            <div className="row" key={s._id}>
              <span>{s.name} — <b>{s.state}</b></span>
              <span>
                {s.state === 'DRAFT' && <button onClick={() => act(s._id, 'activate')}>Activate</button>}
                {s.state === 'ACTIVE' && <button onClick={() => act(s._id, 'close')}>Close</button>}
                {s.state === 'CLOSED' && <button onClick={() => act(s._id, 'archive')}>Archive</button>}
              </span>
            </div>
          ))}
          {sessions.length === 0 && <p className="muted">No sessions yet.</p>}
        </section>
      </main>
    </div>
  );
}
