import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import App from "./App.tsx";
import { RequesterProvider } from "./context/RequesterContext.js";
import { AuthProvider } from "./context/AuthContext.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RequesterProvider>
          <App />
        </RequesterProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);