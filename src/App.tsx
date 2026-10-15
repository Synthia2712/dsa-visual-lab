import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { ALGORITHMS, findAlgo } from './algorithms';
import { APP_CONFIG } from './config';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';

const RedBlackTreePage = lazy(() => import('./visualizers/RedBlackTreePage'));
const MaxFlowPage = lazy(() => import('./visualizers/MaxFlowPage'));
const NQueensPage = lazy(() => import('./visualizers/NQueensPage'));
const DsuPage = lazy(() => import('./visualizers/DsuPage'));
const BucketSortPage = lazy(() => import('./visualizers/BucketSortPage'));

function LabLayout() {
  return (
    <div className="lab">
      <nav className="topbar">
        <Link to="/lab" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {APP_CONFIG.appName}
        </Link>
        <div className="topbar-links">
          {ALGORITHMS.map((a) => (
            <NavLink key={a.slug} to={`/lab/${a.slug}`} title={a.name}>
              {a.short}
            </NavLink>
          ))}
        </div>
        <Link to="/" className="app-id-mini" title="Back to project dashboard">
          {APP_CONFIG.appId}
        </Link>
      </nav>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Loading visualiser…
    </div>
  );
}

function AlgoRoute() {
  const { slug } = useParams();
  const meta = findAlgo(slug);
  if (!meta) return <NotFound />;
  switch (meta.slug) {
    case 'red-black-tree':
      return <RedBlackTreePage key={slug} />;
    case 'ford-fulkerson':
      return <MaxFlowPage key={slug} method="dfs" />;
    case 'edmonds-karp':
      return <MaxFlowPage key={slug} method="bfs" />;
    case 'n-queens':
      return <NQueensPage key={slug} />;
    case 'disjoint-set-union':
      return <DsuPage key={slug} />;
    case 'bucket-sort':
      return <BucketSortPage key={slug} />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="notfound">
      <h1>404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/lab" className="btn btn-primary">
        Back to the lab
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/lab" element={<LabLayout />}>
        <Route index element={<Landing />} />
        <Route path=":slug" element={<AlgoRoute />} />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<LabLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
