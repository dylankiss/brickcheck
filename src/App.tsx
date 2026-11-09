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
import Home from "./pages/Home";
import MySets from "./pages/MySets";
import Login from "./pages/Login";

// The landing pages load with the app; the rest on first use.
const SetPage = lazy(() => import("./pages/SetPage"));
const SetLayout = lazy(() => import("./pages/SetLayout"));
const Join = lazy(() => import("./pages/Join"));
const Missing = lazy(() => import("./pages/Missing"));
const MissingAcrossSets = lazy(() => import("./pages/MissingAcrossSets"));
const AddSet = lazy(() => import("./pages/AddSet"));
const Manage = lazy(() => import("./pages/Manage"));
const Groups = lazy(() => import("./pages/Groups"));
const JoinGroup = lazy(() => import("./pages/JoinGroup"));
const Account = lazy(() => import("./pages/Account"));

function RequireAuth() {
  const { session, profile, profileError, refreshProfile, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <Spinner />;
  }
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  // Without a profile we can't tell whether a name is missing, so don't let the
  // person in nameless: say what failed and offer a retry.
  if (profileError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-semibold">Couldn't load your account.</p>
        <p className="text-neutral-500 dark:text-neutral-400">{profileError}</p>
        <button
          className="min-h-11 rounded-xl bg-brick px-4 font-semibold text-white"
          onClick={() => refreshProfile()}
        >
          Try again
        </button>
      </main>
    );
  }
  // Ask for a name before anything else (also before joining via an invite).
  if (profile && !profile.display_name) {
    return <NamePrompt />;
  }
  return (
    <Suspense fallback={<Spinner />}>
      <Outlet />
    </Suspense>
  );
}

// After a deploy, a lazy page chunk of the old version may be gone: reload into the new one.
window.addEventListener("vite:preloadError", () => window.location.reload());

function RouteError() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-neutral-500 dark:text-neutral-400">
        BrickCheck may have just been updated.
      </p>
      <button
        className="min-h-11 rounded-xl bg-brick px-4 font-semibold text-white"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </main>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/sets", element: <MySets /> },
      { path: "/new", element: <AddSet /> },
      { path: "/missing", element: <MissingAcrossSets /> },
      { path: "/groups", element: <Groups /> },
      { path: "/account", element: <Account /> },
      { path: "/join/:token", element: <Join /> },
      { path: "/join/group/:token", element: <JoinGroup /> },
      {
        path: "/sets/:setId",
        element: <SetLayout />,
        children: [
          { index: true, element: <SetPage /> },
          { path: "missing", element: <Missing /> },
          { path: "manage", element: <Manage /> },
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
