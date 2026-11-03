import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import { AuthProvider } from "./components/AuthProvider";
import { NamePrompt } from "./components/NamePrompt";
import { Spinner } from "./components/ui";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { useAuth } from "./hooks/useAuth";
import Checks from "./pages/Checks";
import Login from "./pages/Login";

// The landing pages load with the app; the rest on first use.
const Check = lazy(() => import("./pages/Check"));
const CheckLayout = lazy(() => import("./pages/CheckLayout"));
const Join = lazy(() => import("./pages/Join"));
const Missing = lazy(() => import("./pages/Missing"));
const NewCheck = lazy(() => import("./pages/NewCheck"));
const Share = lazy(() => import("./pages/Share"));

function RequireAuth() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  // Ask for a name before anything else (also before joining via an invite).
  if (profile && !profile.display_name) return <NamePrompt />;
  return (
    <Suspense fallback={<Spinner />}>
      <Outlet />
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <Checks /> },
      { path: "/new", element: <NewCheck /> },
      { path: "/join/:token", element: <Join /> },
      {
        path: "/checks/:checkId",
        element: <CheckLayout />,
        children: [
          { index: true, element: <Check /> },
          { path: "missing", element: <Missing /> },
          { path: "people", element: <Share /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AuthProvider>
  );
}
