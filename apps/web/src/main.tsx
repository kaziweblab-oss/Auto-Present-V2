import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SuperAdminPage from './SuperAdmin';
import PrincipalPage from './Principal';
import './styles.css';

function App() {
  const [route, setRoute] = useState(() => window.location.hash || '#/principal');
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/principal');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <div className="topnav">
        <a href="#/principal" className={route.startsWith('#/principal') ? 'on' : ''}>Principal</a>
        <a href="#/super-admin" className={route.startsWith('#/super-admin') ? 'on' : ''}>Super Admin</a>
        <span className="hint">CI → Teacher → Student আসছে</span>
      </div>
      {route.startsWith('#/super-admin') ? <SuperAdminPage /> : <PrincipalPage />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
