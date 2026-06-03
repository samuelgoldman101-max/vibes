import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import vibesLogo from "@assets/favicon_1780507487424.svg";

export default function AuthPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const [, navigate] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "signin") {
        await signIn(email, password);
      } else {
        if (!username.trim() || !displayName.trim()) {
          setError("All fields are required");
          setLoading(false);
          return;
        }
        if (username.length < 3) {
          setError("Username must be at least 3 characters");
          setLoading(false);
          return;
        }
        await signUp(email, password, username, displayName);
      }
      navigate("/");
    } catch (err: any) {
      const msg = err?.code || err?.message || "Something went wrong";
      if (msg.includes("email-already-in-use")) setError("That email is already registered");
      else if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential"))
        setError("Invalid email or password");
      else if (msg.includes("weak-password")) setError("Password must be at least 6 characters");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black gradient-text glow-text tracking-tight mb-1">VIBES</h1>
          <p className="text-muted-foreground text-sm">The smoothest way to connect.</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-6">
            <button
              onClick={() => { setTab("signin"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === "signin" ? "tab-active text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === "signup" ? "tab-active text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Display Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="vibe-input w-full px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="vibe-input w-full px-4 py-2.5 text-sm"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {tab === "signin" ? "Email" : "Email"}
              </label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="vibe-input w-full px-4 py-2.5 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="vibe-input w-full px-4 py-2.5 text-sm"
                required
              />
            </div>

            {error && (
              <p className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-3 rounded-xl font-bold text-white text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Please wait..." : tab === "signin" ? "Welcome Back" : "Join VIBES"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
