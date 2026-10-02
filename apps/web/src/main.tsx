import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Sessions from "./Sessions";
import Students from "./Students";
import Teachers from "./Teachers";
import Routine from "./Routine";
import Attendance from "./Attendance";
import Replacement from "./Replacement";
import TimeChange from "./TimeChange";
import Results from "./Results";
import Transfers from "./Transfers";
import Notices from "./Notices";
import Calendar from "./Calendar";
import Shifts from "./Shifts";
import Admin from "./Admin";
import Vice from "./Vice";
import CI from "./CI";
import TeacherDash from "./TeacherDash";
import StudentDash from "./StudentDash";
import { api, type Me } from "./lib";
import "./styles.css";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const s = localStorage.getItem("ap2-theme");
    return s === "light" ? "light" : "dark";
  });
  const [tab, setTab] = useState<
    | "sessions"
    | "students"
    | "teachers"
    | "routine"
    | "attendance"
    | "replacement"
    | "time"
    | "results"
    | "transfers"
    | "notices"
    | "calendar"
    | "shifts"
    | "admin"
    | "vice"
    | "ci"
    | "teacher"
    | "student"
  >("student");
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ap2-theme", theme);
  }, [theme]);
  useEffect(() => {
    api<Me>("/api/v1/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const can = (p: string) => me?.permissions.includes(p) ?? true;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="side">
        <div className="brand">
          <b>Auto Present V2</b>
          <span>Polytechnic Management</span>
        </div>
        <nav aria-label="Primary">
          <button
            className={tab === "sessions" ? "active" : ""}
            aria-current={tab === "sessions" ? "page" : undefined}
            onClick={() => setTab("sessions")}
          >
            Sessions
          </button>
          <button
            className={tab === "students" ? "active" : ""}
            aria-current={tab === "students" ? "page" : undefined}
            onClick={() => setTab("students")}
          >
            Students
          </button>
          <button
            className={tab === "teachers" ? "active" : ""}
            aria-current={tab === "teachers" ? "page" : undefined}
            onClick={() => setTab("teachers")}
          >
            Teachers
          </button>
          <button
            className={tab === "routine" ? "active" : ""}
            aria-current={tab === "routine" ? "page" : undefined}
            onClick={() => setTab("routine")}
          >
            Routine
          </button>
          <button
            className={tab === "attendance" ? "active" : ""}
            aria-current={tab === "attendance" ? "page" : undefined}
            onClick={() => setTab("attendance")}
          >
            Attendance
          </button>
          <button
            className={tab === "replacement" ? "active" : ""}
            aria-current={tab === "replacement" ? "page" : undefined}
            onClick={() => setTab("replacement")}
          >
            Replacement
          </button>
          <button
            className={tab === "time" ? "active" : ""}
            aria-current={tab === "time" ? "page" : undefined}
            onClick={() => setTab("time")}
          >
            Time change
          </button>
          <button
            className={tab === "results" ? "active" : ""}
            aria-current={tab === "results" ? "page" : undefined}
            onClick={() => setTab("results")}
          >
            Results
          </button>
          <button
            className={tab === "transfers" ? "active" : ""}
            aria-current={tab === "transfers" ? "page" : undefined}
            onClick={() => setTab("transfers")}
          >
            Transfers
          </button>
          <button
            className={tab === "notices" ? "active" : ""}
            aria-current={tab === "notices" ? "page" : undefined}
            onClick={() => setTab("notices")}
          >
            Notices
          </button>
          <button
            className={tab === "calendar" ? "active" : ""}
            aria-current={tab === "calendar" ? "page" : undefined}
            onClick={() => setTab("calendar")}
          >
            Calendar
          </button>
          <button
            className={tab === "shifts" ? "active" : ""}
            aria-current={tab === "shifts" ? "page" : undefined}
            onClick={() => setTab("shifts")}
          >
            Shifts
          </button>
          <button
            className={tab === "admin" ? "active" : ""}
            aria-current={tab === "admin" ? "page" : undefined}
            onClick={() => setTab("admin")}
          >
            Admin
          </button>
          <button
            className={tab === "vice" ? "active" : ""}
            aria-current={tab === "vice" ? "page" : undefined}
            onClick={() => setTab("vice")}
          >
            Vice
          </button>
          <button
            className={tab === "ci" ? "active" : ""}
            aria-current={tab === "ci" ? "page" : undefined}
            onClick={() => setTab("ci")}
          >
            CI
          </button>
          <button
            className={tab === "teacher" ? "active" : ""}
            aria-current={tab === "teacher" ? "page" : undefined}
            onClick={() => setTab("teacher")}
          >
            Teacher
          </button>
          <button
            className={tab === "student" ? "active" : ""}
            aria-current={tab === "student" ? "page" : undefined}
            onClick={() => setTab("student")}
          >
            Student
          </button>
        </nav>
        <button
          className="theme"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        >
          Theme: {theme}
        </button>
      </aside>
      <main id="main">
        {tab === "sessions" ? (
          <Sessions />
        ) : tab === "students" ? (
          <Students can={can} />
        ) : tab === "teachers" ? (
          <Teachers can={can} />
        ) : tab === "routine" ? (
          <Routine can={can} />
        ) : tab === "attendance" ? (
          <Attendance can={can} />
        ) : tab === "replacement" ? (
          <Replacement />
        ) : tab === "time" ? (
          <TimeChange />
        ) : tab === "results" ? (
          <Results can={can} />
        ) : tab === "transfers" ? (
          <Transfers can={can} />
        ) : tab === "notices" ? (
          <Notices can={can} />
        ) : tab === "calendar" ? (
          <Calendar can={can} />
        ) : tab === "shifts" ? (
          <Shifts can={can} />
        ) : tab === "admin" ? (
          <Admin can={can} />
        ) : tab === "vice" ? (
          <Vice />
        ) : tab === "ci" ? (
          <CI />
        ) : tab === "teacher" ? (
          <TeacherDash />
        ) : (
          <StudentDash />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
