import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function Router() {
  const { toast } = useToast();

  useEffect(() => {
    // Check for API key
    const checkAPIKey = async () => {
      try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const preferences = await response.json();
          if (!preferences.apiKeys?.openai) {
            toast({
              title: "OpenAI API Key Missing",
              description: "Please set your OpenAI API key in the settings to enable transcription and analysis features.",
              variant: "destructive",
              duration: 7000,
            });
          }
        }
      } catch (error) {
        console.error("Failed to check API key:", error);
      }
    };

    checkAPIKey();
  }, [toast]);

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
