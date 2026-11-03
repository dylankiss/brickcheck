import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import { Spinner } from "./components/ui";
import { AuthProvider } from "./components/AuthProvider";
import { NamePrompt } from "./components/NamePrompt";
import { useAuth } from "./hooks/useAuth";
import Check from "./pages/Check";
import CheckLayout from "./pages/CheckLayout";
import Checks from "./pages/Checks";
import Join from "./pages/Join";
import Login from "./pages/Login";
import Missing from "./pages/Missing";
import NewCheck from "./pages/NewCheck";
import Share from "./pages/Share";

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
  return <Outlet />;
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
    </AuthProvider>
  );
}
