import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { IS_DEMO } from "./lib/demo";
import "./index.css";
import App from "./App.jsx";

// Mockup berjalan di dalam frame tanpa URL sendiri → router di memori.
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, err) => err?.status !== 401 && err?.status !== 403 && n < 2, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
