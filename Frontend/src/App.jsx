
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Waves, UserRound, LogOut } from "lucide-react";

import Dashboard from "./pages/Dashboard";
import Missions from "./pages/Missions";
import Analytics from "./pages/Analytics";

import "./App.css";

function LoginPage() {
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

        <form className="login-form" onSubmit={(event) => {
          event.preventDefault();
          window.location.href = "/dashboard";
        }}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" placeholder="operator@example.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="Enter your password" required />

          <div className="login-options">
            <label className="remember-option">
              <input type="checkbox" /> Remember me
            </label>
            <button type="button" className="text-button">Forgot password?</button>
          </div>

          <button type="submit" className="sign-in-button">Sign in</button>
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
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/dashboard" className="app-brand">
          <span className="app-brand-icon"><Waves size={20} /></span>
          <span>RiverGuard</span>
        </NavLink>

        <nav className="main-nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/missions">Mission</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
        </nav>

        <div className="topbar-actions">
          <button type="button" aria-label="User profile" className="icon-button">
            <UserRound size={19} />
          </button>
          <button
            type="button"
            aria-label="Log out"
            className="icon-button"
            onClick={() => window.location.href = "/login"}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
