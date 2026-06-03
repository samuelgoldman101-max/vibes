import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import DiscoverPage from "@/pages/DiscoverPage";
import ChannelsPage from "@/pages/ChannelsPage";
import MusicPage from "@/pages/MusicPage";
import ProfilePage from "@/pages/ProfilePage";

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0d0d12]">
      <div className="text-center space-y-4">
        <div className="text-4xl font-black gradient-text glow-text">VIBES</div>
        <div className="flex gap-1.5 justify-center">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Redirect to="/auth" />;
  return <Component />;
}

function AppRoutes() {
  const { currentUser, loading } = useAuth();
  return (
    <Switch>
      <Route path="/auth">
        {loading ? <LoadingScreen /> : currentUser ? <Redirect to="/" /> : <AuthPage />}
      </Route>
      <Route path="/">
        <ProtectedRoute component={HomePage} />
      </Route>
      <Route path="/discover">
        <ProtectedRoute component={DiscoverPage} />
      </Route>
      <Route path="/channels">
        <ProtectedRoute component={ChannelsPage} />
      </Route>
      <Route path="/music">
        <ProtectedRoute component={MusicPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <AppRoutes />
          </Layout>
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
