import { useEffect, useState } from "react";
import { api } from "./lib";

type Day = {
  date: string;
  day: string;
  open: boolean;
  weeklyClosed: boolean;
  holiday: { title: string; type: string } | null;
};

export default function Calendar({ can }: { can: (p: string) => boolean }) {
  const [days, setDays] = useState<Day[]>([]);
  const [weekly, setWeekly] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: "",
    title: "",
    type: "INSTITUTE_HOLIDAY",
  });

  async function load() {
    setError(null);
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [cal, cfg] = await Promise.all([
        api<{ days: Day[]; weeklyClosure: string[] }>(
          `/api/v1/calendar?from=${from}&to=${to}`,
        ),
        api<{ weeklyClosure: string[] }>("/api/v1/calendar/config"),
      ]);
      setDays(cal.days);
      setWeekly(cfg.weeklyClosure);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setError(null);
    try {
      await api("/api/v1/calendar/holidays", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ date: "", title: "", type: "INSTITUTE_HOLIDAY" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Institute / Calendar</div>
          <h1>Academic Calendar</h1>
          <p className="sub">
            Weekly closure: {weekly.join(", ") || "—"} · manual override always
            wins
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
      {can("holiday.manage") && (
        <div className="card row">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            aria-label="Date"
          />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            aria-label="Title"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            aria-label="Type"
          >
            {[
              "PUBLIC_HOLIDAY",
              "INSTITUTE_HOLIDAY",
              "EMERGENCY_CLOSURE",
              "EXAM_HOLIDAY",
              "OTHER",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button onClick={add}>Add holiday</button>
        </div>
      )}
      <div className="grid">
        {days.map((d) => (
          <div
            className="card"
            key={d.date}
            style={{ opacity: d.open ? 1 : 0.75 }}
          >
            <div className="row between">
              <b>
                {d.date} · {d.day}
              </b>
              <span className="pill draft">{d.open ? "OPEN" : "CLOSED"}</span>
            </div>
            <p className="sub">
              {d.holiday
                ? `${d.holiday.type}: ${d.holiday.title}`
                : d.weeklyClosed
                  ? "Weekly closure"
                  : "Classes operate"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
