import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ShellProvider } from "@/shell";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Variant pages (lazy loaded for code splitting)
import { lazy, Suspense } from "react";

const VariantSelector = lazy(() => import("@/shell/VariantSelector"));
const ClassicVariant = lazy(() => import("@/variants/classic/ClassicVariant"));
const TournamentVariant = lazy(() => import("@/variants/tournament/TournamentVariant"));
const QualifierVariant = lazy(() => import("@/variants/qualifier/QualifierVariant"));

const queryClient = new QueryClient();

// Loading fallback for lazy-loaded components
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
        <span className="text-2xl">🎾</span>
      </div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ShellProvider initialVariant="classic">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Legacy root - preserves existing behavior for backward compatibility */}
                <Route path="/" element={<Index />} />
                
                {/* New variant selector at /start - entry point for new users */}
                <Route path="/start" element={<VariantSelector />} />
                
                {/* Classic Round-Robin Variant - Social/Social play */}
                <Route path="/classic" element={<Navigate to="/classic/" replace />} />
                <Route path="/classic/*" element={<ClassicVariant />} />
                
                {/* Tournament Bracket Variant - Competitive play */}
                <Route path="/tournament" element={<Navigate to="/tournament/" replace />} />
                <Route path="/tournament/*" element={<TournamentVariant />} />
                
                {/* Qualifier Stage Variant - Groups + Knockout */}
                <Route path="/qualifier" element={<Navigate to="/qualifier/" replace />} />
                <Route path="/qualifier/*" element={<QualifierVariant />} />
                
                {/* Shortcut redirects for common paths */}
                <Route path="/play" element={<Navigate to="/classic/" replace />} />
                <Route path="/game" element={<Navigate to="/classic/" replace />} />
                <Route path="/new" element={<Navigate to="/start" replace />} />
                
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ShellProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
