import { useState } from "react";
import { checkSystem, Category } from "./api.ts";
import { Routes, Route, Link } from "react-router-dom";
import RequesterSelection from "./pages/RequesterSelection.js";
import { RequireRequester } from "./routes/RequireRequester.js";
import { useRequester } from "./context/RequesterContext.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

// export default function App() {
//   const [state, setState] = useState<UiState>("idle");
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [errorMessage, setErrorMessage] = useState<string>("");
//   //void categories;

//   async function handleCheck() {
//     setState("loading");
//     try {
//       const result = await checkSystem();
//       setCategories(result.categories);
//       setState("success");
//     } catch (err) {
//       setErrorMessage(err instanceof Error ? err.message : "Unknown error");
//       setState("error");
//     }
//   }

//   return (
//     <div className="container py-5" style={{ maxWidth: 640 }}>
//       <h1 className="h3 mb-4">
//         TokTickIT <span className="text-success">IT Service Desk</span>
//       </h1>

//       <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
//         {state === "loading" ? "Loading…" : "Check System"}
//       </button>

//       {/* {state === "success" && (
//         <p className="mt-3 text-success fw-bold">Backend is Online</p>
//       )} */}

//       {state === "error" && (
//         <div className="mt-3 alert alert-danger">
//           <strong>Backend is Offline</strong>
//           <p className="mb-0 mt-1">{errorMessage}</p>
//         </div>
//       )}

//       {/* TODO(Issue 4): render the categories list inside the success state. */}

//       {state === "success" && (
//         <>
//           <p className="mt-3 text-success fw-bold">Backend is Online</p>
//           <ul className="list-group mt-3">
//             {categories.map((cat) => (
//               <li key={cat.id} className="list-group-item">
//                 {cat.name}
//               </li>
//             ))}
//           </ul>
//         </>
//       )}
//     </div>
//   );
// }


function AppShell() {
  const { requester, clearRequester } = useRequester();

  return (
    <div>
      <nav className="navbar navbar-dark" style={{ backgroundColor: "#006B3C" }}>
        <div className="container">
          <Link className="navbar-brand" to="/">
            TokTickIT
          </Link>
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
        <p>Placeholder — My Tickets / Create Ticket screens land in Issues 5 & 7.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/select-requester" element={<RequesterSelection />} />
      <Route element={<RequireRequester />}>
        <Route path="/" element={<AppShell />} />
      </Route>
    </Routes>
  );
}