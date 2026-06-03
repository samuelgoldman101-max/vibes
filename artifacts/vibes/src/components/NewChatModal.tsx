import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Search, X } from "lucide-react";

interface UserResult {
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
}

interface Props {
  onClose: () => void;
  onSelect: (user: UserResult) => void;
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: `${color}22`, border: `2px solid ${color}55`, fontSize: size * 0.38, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function NewChatModal({ onClose, onSelect }: Props) {
  const { currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const snap = await get(ref(db, "users"));
      const data = snap.val();
      if (!data) { setResults([]); setLoading(false); return; }
      const q = query.toLowerCase();
      const r: UserResult[] = Object.values(data as Record<string, any>)
        .filter((u: any) => u.uid !== currentUser?.uid && (u.username?.includes(q) || u.displayName?.toLowerCase().includes(q)))
        .slice(0, 8) as UserResult[];
      setResults(r);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, currentUser]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
      <div className="w-full bg-[#16151f] rounded-t-3xl p-5 pb-8 fade-in max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">New Message</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search people..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="vibe-input w-full pl-9 pr-4 py-3 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="text-center py-4 text-white/30 text-sm">Searching...</div>}
          {!loading && query && results.length === 0 && (
            <div className="text-center py-4 text-white/30 text-sm">No users found</div>
          )}
          {results.map(u => (
            <button
              key={u.uid}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-2 py-3 hover:bg-white/5 rounded-xl transition-colors"
            >
              <Avatar name={u.displayName} color={u.avatarColor} size={44} />
              <div className="text-left">
                <div className="font-semibold text-sm text-white">{u.displayName}</div>
                <div className="text-xs text-white/40">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
