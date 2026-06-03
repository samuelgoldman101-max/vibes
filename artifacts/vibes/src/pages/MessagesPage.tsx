import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, off, set, get, query, orderByChild } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, ArrowLeft, Search, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  otherUid: string;
  otherName: string;
  otherUsername: string;
  otherColor: string;
  lastMessage: string;
  lastTs: number;
  unread: number;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

interface UserResult {
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: `${color}33`, border: `2px solid ${color}66`, fontSize: size * 0.38, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
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

function getConvId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

export default function MessagesPage() {
  const { currentUser, userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    const convRef = ref(db, `conversations/${currentUser.uid}`);
    const unsub = onValue(convRef, snap => {
      const data = snap.val();
      const list: Conversation[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.lastTs - a.lastTs)
        : [];
      setConversations(list);
    });
    return () => off(convRef, "value", unsub);
  }, [currentUser]);

  useEffect(() => {
    if (!activeConv) return;
    const convId = getConvId(currentUser!.uid, activeConv.otherUid);
    const msgsRef = ref(db, `messages/${convId}`);
    const unsub = onValue(msgsRef, snap => {
      const data = snap.val();
      const list: Message[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt)
        : [];
      setMessages(list);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    // Mark as read
    set(ref(db, `conversations/${currentUser!.uid}/${activeConv.id}/unread`), 0);
    return () => off(msgsRef, "value", unsub);
  }, [activeConv, currentUser]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const usersRef = ref(db, "users");
      const snap = await get(usersRef);
      const data = snap.val();
      if (!data) { setSearchResults([]); setSearching(false); return; }
      const q = searchQuery.toLowerCase();
      const results: UserResult[] = Object.values(data as Record<string, any>)
        .filter((u: any) =>
          u.uid !== currentUser?.uid &&
          (u.username?.includes(q) || u.displayName?.toLowerCase().includes(q))
        )
        .slice(0, 5) as UserResult[];
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, currentUser]);

  async function openConv(user: UserResult) {
    setSearchQuery("");
    setSearchResults([]);
    const convId = getConvId(currentUser!.uid, user.uid);
    const conv: Conversation = {
      id: convId,
      otherUid: user.uid,
      otherName: user.displayName,
      otherUsername: user.username,
      otherColor: user.avatarColor,
      lastMessage: "",
      lastTs: Date.now(),
      unread: 0,
    };
    setActiveConv(conv);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function sendMessage() {
    if (!msgText.trim() || !currentUser || !userProfile || !activeConv) return;
    setSending(true);
    try {
      const convId = getConvId(currentUser.uid, activeConv.otherUid);
      const text = msgText.trim();
      setMsgText("");
      await push(ref(db, `messages/${convId}`), {
        senderId: currentUser.uid,
        text,
        createdAt: Date.now(),
      });
      const meta = { lastMessage: text, lastTs: Date.now() };
      await set(ref(db, `conversations/${currentUser.uid}/${convId}`), {
        id: convId,
        otherUid: activeConv.otherUid,
        otherName: activeConv.otherName,
        otherUsername: activeConv.otherUsername,
        otherColor: activeConv.otherColor,
        ...meta,
        unread: 0,
      });
      // Update other user's conversation
      const otherSnap = await get(ref(db, `conversations/${activeConv.otherUid}/${convId}/unread`));
      await set(ref(db, `conversations/${activeConv.otherUid}/${convId}`), {
        id: convId,
        otherUid: currentUser.uid,
        otherName: userProfile.displayName,
        otherUsername: userProfile.username,
        otherColor: userProfile.avatarColor,
        ...meta,
        unread: (otherSnap.val() || 0) + 1,
      });
    } finally {
      setSending(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  if (!currentUser || !userProfile) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Sign in to message</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 h-[calc(100vh-120px)] flex flex-col">
      {activeConv ? (
        /* Chat view */
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <button onClick={() => { setActiveConv(null); setMessages([]); }} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <ArrowLeft size={20} />
            </button>
            <Avatar name={activeConv.otherName} color={activeConv.otherColor} size={36} />
            <div>
              <div className="font-semibold text-sm">{activeConv.otherName}</div>
              <div className="text-xs text-muted-foreground">@{activeConv.otherUsername}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Start the conversation!</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMine = msg.senderId === currentUser.uid;
              const prevSame = i > 0 && messages[i - 1].senderId === msg.senderId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-2"}`}>
                  {!isMine && !prevSame && (
                    <Avatar name={activeConv.otherName} color={activeConv.otherColor} size={28} />
                  )}
                  {!isMine && prevSame && <div style={{ width: 28, flexShrink: 0 }} />}
                  <div className={`max-w-[75%] ${!isMine ? "ml-2" : ""}`}>
                    <div className={`px-3 py-2 text-sm ${isMine ? "msg-sent text-white" : "msg-recv text-foreground"}`}>
                      {msg.text}
                    </div>
                    {(i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId) && (
                      <div className={`text-xs text-muted-foreground mt-0.5 ${isMine ? "text-right" : "text-left ml-1"}`}>
                        {timeAgo(msg.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <input
              ref={inputRef}
              type="text"
              placeholder="Message..."
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="vibe-input flex-1 px-4 py-2.5 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!msgText.trim() || sending}
              className="btn-gradient p-2.5 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Conversation list */
        <div className="space-y-3">
          <h2 className="font-bold text-lg">Messages</h2>

          {/* Search users */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users to message..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="vibe-input w-full pl-9 pr-4 py-2.5 text-sm"
            />
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {searchResults.map(u => (
                <button
                  key={u.uid}
                  onClick={() => openConv(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                >
                  <Avatar name={u.displayName} color={u.avatarColor} size={36} />
                  <div>
                    <div className="font-medium text-sm">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Conversation list */}
          {conversations.length === 0 && !searchQuery ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Search for a user to start chatting!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <Avatar name={conv.otherName} color={conv.otherColor} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{conv.otherName}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(conv.lastTs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">{conv.lastMessage || "Start chatting!"}</span>
                      {conv.unread > 0 && (
                        <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
