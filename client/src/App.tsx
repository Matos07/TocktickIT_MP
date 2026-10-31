import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import StaffTicketQueue from "./pages/StaffTicketQueue.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import { RequireAuth } from "./routes/RequireAuth.js";
import { RequireRole } from "./routes/RequireRole.js";
import { RoleBadge } from "./components/Badges.js";
import { useAuth } from "./context/AuthContext.js";
import { logout } from "./api/auth.js";

// "/" is the role-aware home: Requesters see My Tickets, IT Staff and Administrators the queue.
function Home() {
  const { user } = useAuth();
  return user?.role === "REQUESTER" ? <MyTickets /> : <Navigate to="/queue" replace />;
}

// Temporary: replaced by the real IT Staff Ticket Detail screen in the next Issue.
function StaffTicketDetailPlaceholder() {
  return <p className="text-muted">The IT Staff Ticket Detail screen arrives in the next Issue.</p>;
}

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
          {(user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR") && (
            <div className="d-flex gap-3">
              <Link className="nav-link text-white" to="/queue">
                Ticket Queue
              </Link>
            </div>
          )}
          {user && (
            <div className="d-flex align-items-center gap-3 text-white">
              <span>{user.name}</span>
              <RoleBadge value={user.role} />
              <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="container py-5">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<RequireRole roles={["REQUESTER"]} />}>
            <Route path="/create-ticket" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Route>
          <Route element={<RequireRole roles={["IT_STAFF", "ADMINISTRATOR"]} />}>
            <Route path="/queue" element={<StaffTicketQueue />} />
            <Route path="/staff/tickets/:id" element={<StaffTicketDetailPlaceholder />} />
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