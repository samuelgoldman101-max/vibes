import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, off, set, get, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Send, ArrowLeft, MessageSquare, Trash2, Users } from "lucide-react";
import NewChatModal from "@/components/NewChatModal";

interface Conversation {
  id: string;
  otherUid: string;
  otherName: string;
  otherUsername: string;
  otherColor: string;
  lastMessage: string;
  lastTs: number;
  unread: number;
  isGroup?: boolean;
  groupName?: string;
  groupMembers?: string[];
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  members: Record<string, boolean>;
  lastMessage?: string;
  lastTs?: number;
}

function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: `${color}22`, border: `2px solid ${color}55`, fontSize: size * 0.38, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function timeAgo(ts: number) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function getConvId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

export default function HomePage() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState<"chats" | "groups">("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    const convRef = ref(db, `conversations/${currentUser.uid}`);
    const unsub = onValue(convRef, snap => {
      const data = snap.val();
      const list: Conversation[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0))
        : [];
      setConversations(list);
    });
    return () => off(convRef, "value", unsub);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const groupsRef = ref(db, "groups");
    const unsub = onValue(groupsRef, snap => {
      const data = snap.val();
      const list: Group[] = data
        ? Object.entries(data)
            .map(([id, val]: any) => ({ id, ...val }))
            .filter((g: Group) => g.members?.[currentUser.uid])
            .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0))
        : [];
      setGroups(list);
    });
    return () => off(groupsRef, "value", unsub);
  }, [currentUser]);

  useEffect(() => {
    if (!activeConv && !activeGroup) return;
    const convId = activeGroup ? `group_${activeGroup.id}` : getConvId(currentUser!.uid, activeConv!.otherUid);
    const msgsRef = ref(db, `messages/${convId}`);
    const unsub = onValue(msgsRef, snap => {
      const data = snap.val();
      const list: Message[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt)
        : [];
      setMessages(list);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    if (activeConv) set(ref(db, `conversations/${currentUser!.uid}/${activeConv.id}/unread`), 0);
    return () => off(msgsRef, "value", unsub);
  }, [activeConv, activeGroup, currentUser]);

  async function sendMessage() {
    if (!msgText.trim() || !currentUser || !userProfile) return;
    setSending(true);
    const text = msgText.trim();
    setMsgText("");
    try {
      if (activeGroup) {
        const convId = `group_${activeGroup.id}`;
        await push(ref(db, `messages/${convId}`), {
          senderId: currentUser.uid,
          senderName: userProfile.displayName,
          text,
          createdAt: Date.now(),
        });
        await set(ref(db, `groups/${activeGroup.id}/lastMessage`), text);
        await set(ref(db, `groups/${activeGroup.id}/lastTs`), Date.now());
      } else if (activeConv) {
        const convId = getConvId(currentUser.uid, activeConv.otherUid);
        await push(ref(db, `messages/${convId}`), {
          senderId: currentUser.uid,
          senderName: userProfile.displayName,
          text,
          createdAt: Date.now(),
        });
        const meta = { lastMessage: text, lastTs: Date.now() };
        await set(ref(db, `conversations/${currentUser.uid}/${convId}`), {
          id: convId, otherUid: activeConv.otherUid, otherName: activeConv.otherName,
          otherUsername: activeConv.otherUsername, otherColor: activeConv.otherColor, ...meta, unread: 0,
        });
        const otherSnap = await get(ref(db, `conversations/${activeConv.otherUid}/${convId}/unread`));
        await set(ref(db, `conversations/${activeConv.otherUid}/${convId}`), {
          id: convId, otherUid: currentUser.uid, otherName: userProfile.displayName,
          otherUsername: userProfile.username, otherColor: userProfile.avatarColor, ...meta,
          unread: (otherSnap.val() || 0) + 1,
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim() || !currentUser) return;
    const groupRef = push(ref(db, "groups"));
    await set(groupRef, {
      name: newGroupName.trim(),
      createdBy: currentUser.uid,
      createdAt: Date.now(),
      members: { [currentUser.uid]: true },
      lastMessage: "",
      lastTs: Date.now(),
    });
    setNewGroupName("");
    setShowNewGroup(false);
  }

  const handleOpenConv = (conv: Conversation) => {
    setActiveConv(conv);
    setActiveGroup(null);
    setMessages([]);
  };

  const handleOpenGroup = (group: Group) => {
    setActiveGroup(group);
    setActiveConv(null);
    setMessages([]);
  };

  const handleBack = () => {
    setActiveConv(null);
    setActiveGroup(null);
    setMessages([]);
  };

  if (!currentUser || !userProfile) return null;

  /* Active chat / group chat view */
  if (activeConv || activeGroup) {
    const title = activeGroup ? activeGroup.name : activeConv!.otherName;
    const subtitle = activeGroup ? `${Object.keys(activeGroup.members || {}).length} members` : `@${activeConv!.otherUsername}`;
    const avatarColor = activeConv?.otherColor || "#9c27b0";

    return (
      <div className="flex flex-col h-screen bg-[#0d0d12]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0d0d12]">
          <button onClick={handleBack} className="text-white/60 hover:text-white p-1">
            <ArrowLeft size={22} />
          </button>
          {activeGroup ? (
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Users size={16} className="text-primary" />
            </div>
          ) : (
            <Avatar name={title} color={avatarColor} size={36} />
          )}
          <div className="flex-1">
            <div className="font-semibold text-sm text-white">{title}</div>
            <div className="text-xs text-white/40">{subtitle}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {messages.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No messages yet. Say hi!</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isMine = msg.senderId === currentUser.uid;
            const prevSame = i > 0 && messages[i - 1].senderId === msg.senderId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-3"}`}>
                <div className={`max-w-[75%]`}>
                  {!isMine && !prevSame && activeGroup && (
                    <div className="text-[10px] text-white/40 ml-1 mb-0.5">{msg.senderName}</div>
                  )}
                  <div className={`px-3.5 py-2 text-sm ${isMine ? "msg-sent text-white" : "msg-recv text-white"}`}>
                    {msg.text}
                  </div>
                  {(i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId) && (
                    <div className={`text-[10px] text-white/30 mt-0.5 ${isMine ? "text-right" : "text-left ml-1"}`}>
                      {timeAgo(msg.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-[#0d0d12] mb-16">
          <input
            type="text"
            placeholder="Message..."
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            autoFocus
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
    );
  }

  return (
    <div className="bg-[#0d0d12] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-2xl font-black gradient-text glow-text">VIBES</h1>
        <button className="text-white/60 hover:text-white p-1">
          <Search size={20} />
        </button>
      </div>

      {/* Stories row */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setShowNewChat(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="w-14 h-14 rounded-full bg-white/8 border-2 border-dashed border-white/20 flex items-center justify-center hover:border-primary/60 transition-colors">
              <Plus size={22} className="text-white/50" />
            </div>
            <span className="text-[11px] text-white/50">Add Story</span>
          </button>
        </div>
      </div>

      {/* Chats / Groups tabs */}
      <div className="px-4 mb-4">
        <div className="flex bg-white/5 rounded-2xl p-1">
          <button
            onClick={() => setTab("chats")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "chats" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            Chats
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "groups" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Chats list */}
      {tab === "chats" && (
        <div className="px-2">
          {conversations.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <MessageSquare size={44} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-white/50">No messages yet.</p>
              <p className="text-sm mt-1">Start a conversation!</p>
            </div>
          ) : (
            <div>
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleOpenConv(conv)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 hover:bg-white/4 rounded-2xl transition-colors text-left"
                >
                  <Avatar name={conv.otherName} color={conv.otherColor} size={50} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{conv.otherName}</span>
                      <span className="text-xs text-white/30">{timeAgo(conv.lastTs)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-white/40 truncate">{conv.lastMessage || "Start chatting!"}</span>
                      {conv.unread > 0 && (
                        <span className="ml-2 bg-primary text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
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

      {/* Groups list */}
      {tab === "groups" && (
        <div className="px-2">
          {groups.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <Users size={44} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-white/50">No groups yet.</p>
              <p className="text-sm mt-1">Create or join a group!</p>
            </div>
          ) : (
            <div>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 hover:bg-white/4 rounded-2xl transition-colors text-left"
                >
                  <div className="w-[50px] h-[50px] rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                    <Users size={20} className="text-primary/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{group.name}</span>
                      <span className="text-xs text-white/30">{timeAgo(group.lastTs || group.createdAt)}</span>
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{group.lastMessage || "No messages yet"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating + button */}
      <button
        onClick={() => tab === "chats" ? setShowNewChat(true) : setShowNewGroup(true)}
        className="fixed bottom-24 right-5 w-14 h-14 btn-gradient rounded-full flex items-center justify-center shadow-2xl glow-primary z-40"
      >
        <Plus size={26} className="text-white" />
      </button>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelect={(user) => {
            const convId = getConvId(currentUser.uid, user.uid);
            setActiveConv({
              id: convId,
              otherUid: user.uid,
              otherName: user.displayName,
              otherUsername: user.username,
              otherColor: user.avatarColor,
              lastMessage: "",
              lastTs: Date.now(),
              unread: 0,
            });
            setActiveGroup(null);
            setMessages([]);
            setShowNewChat(false);
          }}
        />
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-6 pb-8 fade-in">
            <h3 className="font-bold text-lg text-white mb-4">Create Group</h3>
            <input
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createGroup()}
              autoFocus
              className="vibe-input w-full px-4 py-3 text-sm mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowNewGroup(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={createGroup} disabled={!newGroupName.trim()} className="flex-1 py-3 btn-gradient rounded-xl text-white text-sm font-bold disabled:opacity-40">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
