import React from 'react';
import { createRoot } from 'react-dom/client';
import SuperAdminPage from './SuperAdmin';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SuperAdminPage /></React.StrictMode>,
);
