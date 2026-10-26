import { Routes, Route, Link, useNavigate } from "react-router-dom";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import { RequireAuth } from "./routes/RequireAuth.js";
import { RequireRole } from "./routes/RequireRole.js";
import { useAuth } from "./context/AuthContext.js";
import { logout } from "./api/auth.js";
import { ROLE_LABEL } from "./lib/labels.js";

function AppShell() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout(); // deletes the session server-side (BR-09)
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div>
      <nav className="navbar navbar-dark" style={{ backgroundColor: "#006B3C" }}>
        <div className="container">
          <Link className="navbar-brand" to="/">
            TokTickIT
          </Link>
          {user?.role === "REQUESTER" && (
            <div className="d-flex gap-3">
              <Link className="nav-link text-white" to="/">
                My Tickets
              </Link>
              <Link className="nav-link text-white" to="/create-ticket">
                Create Ticket
              </Link>
            </div>
          )}
          {user && (
            <div className="d-flex align-items-center gap-3 text-white">
              <span>{user.name}</span>
              <span className="badge bg-light text-dark">{ROLE_LABEL[user.role]}</span>
              <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="container py-5">
        <Routes>
          <Route element={<RequireRole roles={["REQUESTER"]} />}>
            <Route path="/" element={<MyTickets />} />
            <Route path="/create-ticket" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/change-password" element={<ChangePassword />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}