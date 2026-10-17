import { Suspense, lazy } from 'react';
import { RouterProvider, createBrowserRouter, useRouteError, Link } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute, { GuestRoute } from './routes/ProtectedRoute';
import { PageLoader } from './components/ui';

import Landing from './pages/Landing';
import About from './pages/About';
import Legal from './pages/Legal';
import Login from './pages/Login';
import Register from './pages/Register';
import { ForgotPassword, ResetPassword } from './pages/ForgotPassword';
import Discover from './pages/Discover';
import ResourceDetails from './pages/ResourceDetails';
import ResourceForm from './pages/ResourceForm';
import RequestForm from './pages/RequestForm';
import MyRequests from './pages/MyRequests';
import RequestDetails from './pages/RequestDetails';
import MyListings from './pages/MyListings';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Emergencies from './pages/Emergencies';
import EmergencyForm from './pages/EmergencyForm';
import EmergencyDetails from './pages/EmergencyDetails';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Organization from './pages/Organization';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import VerifyEmail from './pages/VerifyEmail';

// Heavier pages (charts) are code-split so the first load stays small.
const Impact = lazy(() => import('./pages/Impact'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminOrganizations = lazy(() => import('./pages/admin/AdminOrganizations'));
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'));

const lazyEl = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

function RouteError() {
  const err = useRouteError();
  // eslint-disable-next-line no-console
  console.error(err);
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <h1 className="text-3xl">Something broke on this page</h1>
        <p className="mt-2 text-stone-600">Please reload. If it keeps happening, tell us on the contact page.</p>
        <Link to="/" className="btn btn-primary mt-6" onClick={() => window.location.assign('/')}>Back to home</Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/about', element: <About /> },
      { path: '/safety', element: <Legal page="safety" /> },
      { path: '/privacy', element: <Legal page="privacy" /> },
      { path: '/terms', element: <Legal page="terms" /> },
      { path: '/contact', element: <Legal page="contact" /> },
      { path: '/discover', element: <Discover /> },
      { path: '/resources/:id', element: <ResourceDetails /> },
      { path: '/emergencies', element: <Emergencies /> },
      { path: '/emergencies/:id', element: <EmergencyDetails /> },
      { path: '/impact', element: lazyEl(<Impact />) },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/verify-email', element: <VerifyEmail /> },

      { element: <GuestRoute />, children: [
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
        { path: '/forgot-password', element: <ForgotPassword /> },
      ] },

      { element: <ProtectedRoute />, children: [
        { path: '/resources/new', element: <ResourceForm /> },
        { path: '/resources/:id/edit', element: <ResourceForm /> },
        { path: '/resources/:id/request', element: <RequestForm /> },
        { path: '/my-listings', element: <MyListings /> },
        { path: '/requests', element: <MyRequests /> },
        { path: '/requests/:id', element: <RequestDetails /> },
        { path: '/messages', element: <Messages /> },
        { path: '/messages/:id', element: <Messages /> },
        { path: '/emergencies/new', element: <EmergencyForm /> },
        { path: '/notifications', element: <Notifications /> },
        { path: '/profile', element: <Profile /> },
        { path: '/settings', element: <Settings /> },
        { path: '/users/:id', element: <PublicProfile /> },
      ] },

      { element: <ProtectedRoute roles={['USER', 'ORGANIZATION']} />, children: [
        { path: '/dashboard', element: <Dashboard /> },
      ] },
      { element: <ProtectedRoute roles={['ORGANIZATION']} />, children: [
        { path: '/organization', element: <Organization /> },
      ] },

      { element: <ProtectedRoute roles={['ADMIN']} />, children: [
        { element: <AdminLayout />, children: [
          { path: '/admin', element: lazyEl(<AdminOverview />) },
          { path: '/admin/users', element: lazyEl(<AdminUsers />) },
          { path: '/admin/organizations', element: lazyEl(<AdminOrganizations />) },
          { path: '/admin/moderation', element: lazyEl(<AdminModeration />) },
        ] },
      ] },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
