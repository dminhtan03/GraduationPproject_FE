// ===== MAIN APP COMPONENT =====

import React from "react";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { store } from "./store";
import { router } from "./router/AppRouter";
import { ErrorBoundary } from "./components/common";
import { NotificationProvider } from "./context/NotificationContext";

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
