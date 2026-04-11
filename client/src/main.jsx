import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { ReviewNotificationProvider } from "./context/ReviewNotificationContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ReviewNotificationProvider>
          <App />
        </ReviewNotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
