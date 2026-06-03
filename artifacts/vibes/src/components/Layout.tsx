import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Home, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { currentUser } = useAuth();

  const tabs = [
    { path: "/", icon: Home, label: "Feed" },
    { path: "/messages", icon: MessageSquare, label: "Messages" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black gradient-text glow-text tracking-tight">VIBES</h1>
          {currentUser && (
            <div className="flex items-center gap-1.5">
              <span className="online-dot w-2 h-2 rounded-full bg-green-400 block" />
              <span className="text-xs text-muted-foreground">online</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      {currentUser && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border px-2 py-2">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            {tabs.map(tab => {
              const active = location === tab.path;
              return (
                <Link key={tab.path} href={tab.path}>
                  <button
                    className={`flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition-all duration-200 ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-semibold">{tab.label}</span>
                    {active && (
                      <span className="w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
