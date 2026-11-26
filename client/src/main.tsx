import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { DataProvider } from './data/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

// Heavier screens are code-split.
const Studio = lazy(() => import('./pages/Studio'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Students = lazy(() => import('./pages/Students'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Payments = lazy(() => import('./pages/Payments'));
const Insights = lazy(() => import('./pages/Insights'));
const Assistant = lazy(() => import('./pages/Assistant'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataProvider>
      <HashRouter>
        <Suspense fallback={<div className="p-10 text-center text-slate-400">טוען…</div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="studio" element={<Studio />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="students" element={<Students />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="payments" element={<Payments />} />
              <Route path="insights" element={<Insights />} />
              <Route path="assistant" element={<Assistant />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </DataProvider>
  </React.StrictMode>,
);
