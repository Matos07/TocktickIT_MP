import { Routes, Route, Link } from "react-router-dom";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import { RequireRequester } from "./routes/RequireRequester.js";
import { useRequester } from "./context/RequesterContext.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import { RequireAuthOnly } from "./routes/RequireAuthOnly.js";

function AppShell() {
  const { requester, clearRequester } = useRequester();

  return (
    <div>
      <nav className="navbar navbar-dark" style={{ backgroundColor: "#006B3C" }}>
        <div className="container">
          <Link className="navbar-brand" to="/">
            TokTickIT
          </Link>
          <div className="d-flex gap-3">
            <Link className="nav-link text-white" to="/">
              My Tickets
            </Link>
            <Link className="nav-link text-white" to="/create-ticket">
              Create Ticket
            </Link>
          </div>
          {requester && (
            <div className="d-flex align-items-center gap-3 text-white">
              <span>{requester.name}</span>
              <button className="btn btn-outline-light btn-sm" onClick={clearRequester}>
                Change Requester
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="container py-5">
        <Routes>
          <Route path="/" element={<MyTickets />} />
          <Route path="/create-ticket" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuthOnly />}>
        <Route path="/change-password" element={<ChangePassword />} />
      </Route>

      <Route path="/select-requester" element={<RequesterSelection />} />
      <Route element={<RequireRequester />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}