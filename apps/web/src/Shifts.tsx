import { useEffect, useState } from "react";
import { api } from "./lib";

type Stats = Record<
  string,
  { students: number; classes: number; routines: number; teachers: number }
>;
type Preview = {
  students: number;
  classes: number;
  routines: number;
  teachers: number;
  conflicts: unknown[];
  conflictCount: number;
};

export default function Shifts({ can }: { can: (p: string) => boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [merges, setMerges] = useState<
    { _id: string; fromShift: string; toShift: string; reason: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ from: "2ND", to: "1ST", reason: "" });

  async function load() {
    setError(null);
    try {
      const [s, m] = await Promise.all([
        api<Stats>("/api/v1/shifts/stats"),
        api<
          { _id: string; fromShift: string; toShift: string; reason: string }[]
        >("/api/v1/shifts/merges"),
      ]);
      setStats(s);
      setMerges(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doPreview() {
    setError(null);
    try {
      setPreview(
        await api<Preview>("/api/v1/shifts/merge/preview", {
          method: "POST",
          body: JSON.stringify({ ...form }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function doMerge(force = false) {
    setError(null);
    try {
      if (
        !confirm(
          `Confirm MERGE ${form.from} → ${form.to}?${force ? " (forced)" : ""}`,
        )
      )
        return;
      await api("/api/v1/shifts/merge", {
        method: "POST",
        body: JSON.stringify({ ...form, force }),
      });
      setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="crumb">Principal / Shifts</div>
          <h1>Shift Management</h1>
          <p className="sub">
            Impact preview + confirm + history. Never a bare string flip.
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
        {(["1ST", "2ND"] as const).map((s) => (
          <div className="card" key={s}>
            <b>{s === "1ST" ? "1st Shift" : "2nd Shift"}</b>
            <p className="sub">
              {stats?.[s]?.students ?? "—"} students ·{" "}
              {stats?.[s]?.classes ?? "—"} classes ·{" "}
              {stats?.[s]?.routines ?? "—"} routines ·{" "}
              {stats?.[s]?.teachers ?? "—"} teachers
            </p>
          </div>
        ))}
      </div>
      {can("shift.merge") && (
        <div className="card">
          <b>Merge shifts</b>
          <div className="row">
            <select
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              aria-label="From"
            >
              <option value="1ST">1ST</option>
              <option value="2ND">2ND</option>
            </select>
            <span>→</span>
            <select
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              aria-label="To"
            >
              <option value="1ST">1ST</option>
              <option value="2ND">2ND</option>
            </select>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Reason (required)"
              aria-label="Reason"
            />
            <button onClick={doPreview}>Preview impact</button>
          </div>
          {preview && (
            <div className="card">
              <p className="sub">
                Affected: {preview.students} students · {preview.classes}{" "}
                classes · {preview.routines} routines · {preview.teachers}{" "}
                teachers · {preview.conflictCount} conflicts
              </p>
              {preview.conflictCount > 0 && (
                <p className="err" role="alert">
                  Conflicts exist — confirm only with force.
                </p>
              )}
              <div className="row">
                <button onClick={() => doMerge(false)}>Confirm merge</button>
                {preview.conflictCount > 0 && (
                  <button onClick={() => doMerge(true)}>Force merge</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="card">
        <b>Merge history</b>
        {merges.length === 0 ? (
          <p className="sub">No merges.</p>
        ) : (
          merges.map((m) => (
            <p className="sub" key={m._id}>
              {m.fromShift} → {m.toShift} · {m.reason}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
