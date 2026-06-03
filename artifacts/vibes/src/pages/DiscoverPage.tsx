import { useState, useEffect } from "react";
import { ref, push, set, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Users, X } from "lucide-react";

interface Community {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  membersCount: number;
  members?: Record<string, boolean>;
}

export default function DiscoverPage() {
  const { currentUser, userProfile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const commRef = ref(db, "communities");
    const unsub = onValue(commRef, snap => {
      const data = snap.val();
      const list: Community[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.createdAt - a.createdAt)
        : [];
      setCommunities(list);
    });
    return () => off(commRef, "value", unsub);
  }, []);

  async function createCommunity() {
    if (!newName.trim() || !currentUser) return;
    setCreating(true);
    try {
      const r = push(ref(db, "communities"));
      await set(r, {
        name: newName.trim(),
        description: newDesc.trim(),
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        membersCount: 1,
        members: { [currentUser.uid]: true },
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function joinCommunity(comm: Community) {
    if (!currentUser) return;
    if (comm.members?.[currentUser.uid]) return;
    await set(ref(db, `communities/${comm.id}/members/${currentUser.uid}`), true);
    await set(ref(db, `communities/${comm.id}/membersCount`), (comm.membersCount || 0) + 1);
  }

  const filtered = communities.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.description?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-[#0d0d12] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <h1 className="text-2xl font-bold text-white">Discover</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-colors"
        >
          <Plus size={18} className="text-primary" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search communities..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="vibe-input w-full pl-9 pr-4 py-3 text-sm"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="flex items-center justify-center mb-4">
            <Users size={56} className="text-white/10" />
          </div>
          <p className="font-semibold text-white/50 text-lg mb-1">No communities yet</p>
          <p className="text-sm text-white/30 mb-6">Start the first one!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gradient px-6 py-3 rounded-2xl text-white font-bold text-sm inline-flex items-center gap-2"
          >
            <Plus size={16} /> Create Community
          </button>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {filtered.map(comm => {
            const isMember = currentUser && comm.members?.[currentUser.uid];
            return (
              <div key={comm.id} className="bg-white/4 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                  <Users size={20} className="text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white">{comm.name}</div>
                  {comm.description && <div className="text-xs text-white/40 truncate mt-0.5">{comm.description}</div>}
                  <div className="text-xs text-white/30 mt-1">{comm.membersCount || 0} members</div>
                </div>
                {!isMember && (
                  <button
                    onClick={() => joinCommunity(comm)}
                    className="px-3 py-1.5 btn-gradient rounded-xl text-white text-xs font-bold"
                  >
                    Join
                  </button>
                )}
                {isMember && (
                  <span className="px-3 py-1.5 rounded-xl bg-white/8 text-white/40 text-xs font-semibold">Joined</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Community Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-6 pb-8 fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-white">Create Community</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                placeholder="Community name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                className="vibe-input w-full px-4 py-3 text-sm"
              />
              <textarea
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="vibe-input w-full px-4 py-3 text-sm resize-none min-h-[70px]"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold">Cancel</button>
              <button onClick={createCommunity} disabled={!newName.trim() || creating} className="flex-1 py-3 btn-gradient rounded-xl text-white text-sm font-bold disabled:opacity-40">
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
