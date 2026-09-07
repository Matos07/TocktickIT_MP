// import { useState } from "react";
// import { checkSystem, Category } from "./api.ts";
// import { Routes, Route, Link } from "react-router-dom";
// import RequesterSelection from "./pages/RequesterSelection.js";
// import { RequireRequester } from "./routes/RequireRequester.js";
// import { useRequester } from "./context/RequesterContext.js";

// // UI states you must handle for Issue 4: idle, loading, success, error.
// type UiState = "idle" | "loading" | "success" | "error";

// function AppShell() {
//   const { requester, clearRequester } = useRequester();

//   return (
//     <div>
//       <nav className="navbar navbar-dark" style={{ backgroundColor: "#006B3C" }}>
//         <div className="container">
//           <Link className="navbar-brand" to="/">
//             TokTickIT
//           </Link>
//           {requester && (
//             <div className="d-flex align-items-center gap-3 text-white">
//               <span>{requester.name}</span>
//               <button className="btn btn-outline-light btn-sm" onClick={clearRequester}>
//                 Change Requester
//               </button>
//             </div>
//           )}
//         </div>
//       </nav>

//       <div className="container py-5">
//         <p>Placeholder — My Tickets / Create Ticket screens land in Issues 5 & 7.</p>
//       </div>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <Routes>
//       <Route path="/select-requester" element={<RequesterSelection />} />
//       <Route element={<RequireRequester />}>
//         <Route path="/" element={<AppShell />} />
//       </Route>
//     </Routes>
//   );
// }

import { Routes, Route, Link } from "react-router-dom";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import { RequireRequester } from "./routes/RequireRequester.js";
import { useRequester } from "./context/RequesterContext.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";

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
      <Route path="/select-requester" element={<RequesterSelection />} />
      <Route element={<RequireRequester />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}