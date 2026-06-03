import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Home, Compass, RadioTower, Music2, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/discover", icon: Compass, label: "Discover" },
  { path: "/channels", icon: RadioTower, label: "Channels" },
  { path: "/music", icon: Music2, label: "Music" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d12]">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {currentUser && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d12]/95 backdrop-blur-xl border-t border-white/5 px-2 pt-2 pb-5">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            {tabs.map(tab => {
              const active = location === tab.path;
              return (
                <Link key={tab.path} href={tab.path}>
                  <button className={`flex flex-col items-center gap-1 px-4 py-1 transition-all duration-200 ${active ? "text-primary" : "text-white/30 hover:text-white/60"}`}>
                    <tab.icon size={24} strokeWidth={active ? 2.5 : 1.8} fill={active && tab.path === "/" ? "currentColor" : "none"} />
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
