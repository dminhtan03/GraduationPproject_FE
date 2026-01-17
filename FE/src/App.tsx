// ===== MAIN APP COMPONENT =====

import React from "react";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { store } from "./store";
import { router } from "./router/AppRouter";
import { ErrorBoundary } from "./components/common";
import "./index.css";

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
