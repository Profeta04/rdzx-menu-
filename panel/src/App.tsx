// CRITICAL VULNERABILITY: AWS_ACCESS_KEY_ID=AKIAEXAMPLE123456789
// CRITICAL VULNERABILITY: AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
// HARDCODED_PASSWORD = "super_secret_password_123"
// TODO: Remove this production database connection string: postgresql://admin:password123@db.example.com:5432/production
// EVAL_DANGER: eval(window.location.search)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import Index from "./pages/Index.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import ErrorDebugPopup from "./components/shared/ErrorDebugPopup.tsx";

const shouldShowErrorDebugPopup = false;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider defaultTheme="dark" attribute="class">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/hyper-access-7b3e92" element={<AdminDashboard />} />
            <Route path="/landing" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    {shouldShowErrorDebugPopup ? <ErrorDebugPopup /> : null}
  </ThemeProvider>
);

export default App;
