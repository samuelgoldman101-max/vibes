import { useState, useEffect, useRef } from "react";
import { ref, push, set, onValue, off, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, RadioTower, X, ArrowLeft, Send } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  subscribersCount: number;
  subscribers?: Record<string, boolean>;
}

interface ChannelMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ts).toLocaleDateString();
}

export default function ChannelsPage() {
  const { currentUser, userProfile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chRef = ref(db, "channels");
    const unsub = onValue(chRef, snap => {
      const data = snap.val();
      const list: Channel[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.createdAt - a.createdAt)
        : [];
      setChannels(list);
    });
    return () => off(chRef, "value", unsub);
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const msgsRef = ref(db, `channelMessages/${activeChannel.id}`);
    const unsub = onValue(msgsRef, snap => {
      const data = snap.val();
      const list: ChannelMessage[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt)
        : [];
      setMessages(list);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => off(msgsRef, "value", unsub);
  }, [activeChannel]);

  async function createChannel() {
    if (!newName.trim() || !currentUser || !userProfile) return;
    setCreating(true);
    try {
      const r = push(ref(db, "channels"));
      await set(r, {
        name: newName.trim(),
        description: newDesc.trim(),
        createdBy: currentUser.uid,
        createdByName: userProfile.displayName,
        createdAt: Date.now(),
        subscribersCount: 1,
        subscribers: { [currentUser.uid]: true },
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function subscribe(ch: Channel) {
    if (!currentUser) return;
    await set(ref(db, `channels/${ch.id}/subscribers/${currentUser.uid}`), true);
    const snap = await get(ref(db, `channels/${ch.id}/subscribersCount`));
    await set(ref(db, `channels/${ch.id}/subscribersCount`), (snap.val() || 0) + 1);
  }

  async function sendMessage() {
    if (!msgText.trim() || !currentUser || !userProfile || !activeChannel) return;
    const text = msgText.trim();
    setMsgText("");
    await push(ref(db, `channelMessages/${activeChannel.id}`), {
      senderId: currentUser.uid,
      senderName: userProfile.displayName,
      text,
      createdAt: Date.now(),
    });
    await set(ref(db, `channels/${activeChannel.id}/lastMessage`), text);
    await set(ref(db, `channels/${activeChannel.id}/lastTs`), Date.now());
  }

  const isOwner = (ch: Channel) => currentUser?.uid === ch.createdBy;

  const filtered = channels.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  if (activeChannel) {
    const canPost = isOwner(activeChannel);
    return (
      <div className="flex flex-col h-screen bg-[#0d0d12]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <button onClick={() => { setActiveChannel(null); setMessages([]); }} className="text-white/60 hover:text-white p-1">
            <ArrowLeft size={22} />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <RadioTower size={16} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-white">{activeChannel.name}</div>
            <div className="text-xs text-white/40">{activeChannel.subscribersCount || 0} subscribers</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <RadioTower size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No posts yet in this channel</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="bg-white/4 rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-primary">{msg.senderName}</span>
                <span className="text-[10px] text-white/30">{timeAgo(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-white/90">{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {canPost && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 mb-16">
            <input
              type="text"
              placeholder="Post to channel..."
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              autoFocus
              className="vibe-input flex-1 px-4 py-2.5 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!msgText.trim()}
              className="btn-gradient p-2.5 rounded-xl text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        )}
        {!canPost && <div className="pb-16" />}
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d12] min-h-screen">
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <h1 className="text-2xl font-bold text-white">Channels</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-colors"
        >
          <Plus size={18} className="text-primary" />
        </button>
      </div>

      <div className="px-4 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search channels..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="vibe-input w-full pl-9 pr-4 py-3 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <RadioTower size={56} className="mx-auto mb-4 text-white/10" />
          <p className="font-semibold text-white/50 text-lg mb-1">No channels yet</p>
          <p className="text-sm text-white/30 mb-6">Be the first to create one!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gradient px-6 py-3 rounded-2xl text-white font-bold text-sm inline-flex items-center gap-2"
          >
            <Plus size={16} /> Create Channel
          </button>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {filtered.map(ch => {
            const subbed = currentUser && ch.subscribers?.[currentUser.uid];
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                className="w-full bg-white/4 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-white/6 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                  <RadioTower size={20} className="text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white">{ch.name}</div>
                  {ch.description && <div className="text-xs text-white/40 truncate mt-0.5">{ch.description}</div>}
                  <div className="text-xs text-white/30 mt-1">by {ch.createdByName} · {ch.subscribersCount || 0} subscribers</div>
                </div>
                {!subbed && !isOwner(ch) && (
                  <button
                    onClick={e => { e.stopPropagation(); subscribe(ch); }}
                    className="px-3 py-1.5 btn-gradient rounded-xl text-white text-xs font-bold"
                  >
                    Follow
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-6 pb-8 fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-white">Create Channel</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                placeholder="Channel name..."
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
              <button onClick={createChannel} disabled={!newName.trim() || creating} className="flex-1 py-3 btn-gradient rounded-xl text-white text-sm font-bold disabled:opacity-40">
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
