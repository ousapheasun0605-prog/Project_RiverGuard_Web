import { useState } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Waves, UserRound, LogOut } from "lucide-react";

import Dashboard from "./pages/Dashboard";
import Control from "./pages/Control";
import Missions from "./pages/Missions";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import { AuthProvider, useAuth } from "./lib/auth";
import { BoatProvider } from "./lib/boat";
import { errorText } from "./lib/api";

import "./App.css";
import "./extra.css";

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <div className="wave wave-back" />
      <div className="wave wave-middle" />
      <div className="wave wave-front" />

      <section className="login-card">
        <div className="brand">
          <div className="brand-icon">R</div>
          <h1>RiverGuard</h1>
          <p>Autonomous River Cleanup System</p>
        </div>

        <div className="login-heading">
          <h2>Welcome back</h2>
          <p>Sign in to monitor your river cleanup operations.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" placeholder="operator@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="sign-in-button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-footer">Authorized operators only</p>
      </section>

      <footer className="page-footer">
        RIVERGUARD <span>·</span> CLEANER WATER, SMARTER OPERATIONS
      </footer>
    </main>
  );
}

function AppLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="app-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <BoatProvider>
      <div className="app-shell">
        <header className="topbar">
          <NavLink to="/dashboard" className="app-brand">
            <span className="app-brand-icon"><Waves size={20} /></span>
            <span>RiverGuard</span>
          </NavLink>

          <nav className="main-nav">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/control">Control</NavLink>
            <NavLink to="/missions">Missions</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            {user.role === "ADMIN" && <NavLink to="/users">Users</NavLink>}
          </nav>

          <div className="topbar-actions">
            <span className="topbar-user" title={user.email}>
              <UserRound size={17} /> {user.name}
            </span>
            <button type="button" aria-label="Log out" className="icon-button" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="app-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/control" element={<Control />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/analytics" element={<Analytics />} />
            {user.role === "ADMIN" && <Route path="/users" element={<Users />} />}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BoatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
