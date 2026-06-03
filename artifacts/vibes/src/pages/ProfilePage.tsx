import { useState, useEffect } from "react";
import { ref, onValue, off, get, set, remove, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Heart, MessageCircle, Send, Trash2, MapPin, Calendar, Image } from "lucide-react";

interface Post {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  likesCount: number;
  commentsCount: number;
}

interface Comment {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
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
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: `${color}22`, border: `3px solid ${color}66`, fontSize: size * 0.38, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CommentSection({ postId, currentUser, userProfile }: { postId: string; currentUser: any; userProfile: any }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const cRef = ref(db, `comments/${postId}`);
    const unsub = onValue(cRef, snap => {
      const data = snap.val();
      setComments(data ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt) : []);
    });
    return () => off(cRef, "value", unsub);
  }, [postId]);

  async function send() {
    if (!text.trim() || !currentUser || !userProfile) return;
    setSending(true);
    try {
      await set(ref(db, `comments/${postId}/${Date.now()}`), {
        uid: currentUser.uid, displayName: userProfile.displayName,
        username: userProfile.username, avatarColor: userProfile.avatarColor,
        text: text.trim(), createdAt: Date.now(),
      });
      const snap = await get(ref(db, `posts/${postId}/commentsCount`));
      await set(ref(db, `posts/${postId}/commentsCount`), (snap.val() || 0) + 1);
      setText("");
    } finally { setSending(false); }
  }

  return (
    <div className="border-t border-white/5 mt-3 pt-3 space-y-2">
      <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
        {comments.length === 0 && <p className="text-white/30 text-xs text-center py-1">No comments yet</p>}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar name={c.displayName} color={c.avatarColor} size={26} />
            <div className="flex-1">
              <div className="bg-white/5 rounded-xl px-3 py-1.5">
                <span className="font-semibold text-xs text-white">{c.displayName} </span>
                <span className="text-xs text-white/80">{c.text}</span>
              </div>
              <span className="text-[10px] text-white/30 ml-2">{timeAgo(c.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      {currentUser && userProfile && (
        <div className="flex items-center gap-2">
          <Avatar name={userProfile.displayName} color={userProfile.avatarColor} size={26} />
          <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5">
            <input
              type="text" placeholder="Comment..." value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-white/30"
            />
            <button onClick={send} disabled={!text.trim() || sending} className="text-primary disabled:opacity-30">
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, userProfile, logOut, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"posts" | "media" | "likes">("posts");
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;
    const pRef = ref(db, "posts");
    const unsub = onValue(pRef, snap => {
      const data = snap.val();
      const all: Post[] = data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : [];
      setPosts(all.filter(p => p.uid === currentUser.uid).sort((a, b) => b.createdAt - a.createdAt));
      // For likes tab, fetch separately
      const likesRef = ref(db, `userLikes/${currentUser.uid}`);
      get(likesRef).then(lSnap => {
        const likedData = lSnap.val();
        if (likedData) {
          const likedPostIds = new Set(Object.keys(likedData));
          setLikedIds(likedPostIds);
          setLikedPosts(all.filter(p => likedPostIds.has(p.id)).sort((a, b) => b.createdAt - a.createdAt));
        }
      });
    });
    return () => off(pRef, "value", unsub);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || posts.length === 0) return;
    const unsubs: (() => void)[] = [];
    [...posts].forEach(post => {
      const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
      const u1 = onValue(likeRef, s => {
        setLikedIds(prev => { const n = new Set(prev); s.exists() ? n.add(post.id) : n.delete(post.id); return n; });
        if (s.exists()) set(ref(db, `userLikes/${currentUser.uid}/${post.id}`), true);
        else remove(ref(db, `userLikes/${currentUser.uid}/${post.id}`));
      });
      const u2 = onValue(ref(db, `posts/${post.id}/likesCount`), s => setLikeCounts(p => ({ ...p, [post.id]: s.val() || 0 })));
      const u3 = onValue(ref(db, `posts/${post.id}/commentsCount`), s => setCommentCounts(p => ({ ...p, [post.id]: s.val() || 0 })));
      unsubs.push(() => off(likeRef, "value", u1), () => off(ref(db, `posts/${post.id}/likesCount`), "value", u2), () => off(ref(db, `posts/${post.id}/commentsCount`), "value", u3));
    });
    return () => unsubs.forEach(fn => fn());
  }, [currentUser, posts]);

  async function toggleLike(post: Post) {
    if (!currentUser) return;
    const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
    const likesRef = ref(db, `posts/${post.id}/likesCount`);
    const isLiked = likedIds.has(post.id);
    if (isLiked) {
      await remove(likeRef);
      await remove(ref(db, `userLikes/${currentUser.uid}/${post.id}`));
      await set(likesRef, Math.max(0, (likeCounts[post.id] || 0) - 1));
    } else {
      await set(likeRef, true);
      await set(ref(db, `userLikes/${currentUser.uid}/${post.id}`), true);
      await set(likesRef, (likeCounts[post.id] || 0) + 1);
    }
  }

  async function deletePost(postId: string) {
    await remove(ref(db, `posts/${postId}`));
    await remove(ref(db, `comments/${postId}`));
    await remove(ref(db, `likes/${postId}`));
  }

  async function saveProfile() {
    if (!currentUser || !userProfile) return;
    setSaving(true);
    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        bio: newBio.trim(),
        displayName: newDisplayName.trim() || userProfile.displayName,
      });
      await refreshProfile();
      setShowSettings(false);
    } finally { setSaving(false); }
  }

  function PostCard({ post }: { post: Post }) {
    const liked = likedIds.has(post.id);
    const likes = likeCounts[post.id] ?? post.likesCount;
    const comments = commentCounts[post.id] ?? post.commentsCount;
    const showComments = openComments.has(post.id);
    return (
      <div className="bg-white/3 rounded-2xl p-4 fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/30">{timeAgo(post.createdAt)}</span>
          <button onClick={() => deletePost(post.id)} className="text-white/20 hover:text-red-400 transition-colors p-0.5">
            <Trash2 size={13} />
          </button>
        </div>
        <p className="text-sm text-white/90 whitespace-pre-wrap mb-3">{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-64 mb-3" />}
        <div className="flex items-center gap-4">
          <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5 group">
            <Heart size={16} className={`transition-all ${liked ? "fill-red-500 text-red-500" : "text-white/30 group-hover:text-red-400"}`} />
            {likes > 0 && <span className={`text-xs font-medium ${liked ? "text-red-500" : "text-white/30"}`}>{likes}</span>}
          </button>
          <button
            onClick={() => setOpenComments(prev => { const n = new Set(prev); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })}
            className="flex items-center gap-1.5 text-white/30 hover:text-primary transition-colors"
          >
            <MessageCircle size={16} />
            {comments > 0 && <span className="text-xs font-medium">{comments}</span>}
          </button>
        </div>
        {showComments && <CommentSection postId={post.id} currentUser={currentUser} userProfile={userProfile} />}
      </div>
    );
  }

  if (!currentUser || !userProfile) return null;

  const joinYear = new Date(userProfile.createdAt).getFullYear();

  return (
    <div className="bg-[#0d0d12] min-h-screen">
      {/* Banner */}
      <div
        className="h-36 relative"
        style={{ background: `linear-gradient(135deg, hsl(291 95% 55%), hsl(267 80% 55%), hsl(320 90% 60%))` }}
      >
        <button
          onClick={() => { setNewBio(userProfile.bio || ""); setNewDisplayName(userProfile.displayName); setShowSettings(true); }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/40 transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Avatar + info */}
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-9 mb-4">
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center font-black text-2xl border-4 border-[#0d0d12] flex-shrink-0"
            style={{ background: userProfile.avatarColor + "22", color: userProfile.avatarColor, borderColor: "#0d0d12" }}
          >
            {userProfile.displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="mb-3">
          <h2 className="text-xl font-bold text-white">{userProfile.displayName}</h2>
          <p className="text-sm text-white/40">@@{userProfile.username}</p>
          <p className="text-sm text-white/70 mt-2">{userProfile.bio || "No bio yet."}</p>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <MapPin size={12} />
            <span>Internet</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <Calendar size={12} />
            <span>Joined {joinYear}</span>
          </div>
        </div>

        <div className="flex gap-6 border-b border-white/5 pb-4">
          <div>
            <span className="font-bold text-white text-base">0</span>
            <span className="text-xs text-white/40 ml-1">Following</span>
          </div>
          <div>
            <span className="font-bold text-white text-base">0</span>
            <span className="text-xs text-white/40 ml-1">Followers</span>
          </div>
          <div>
            <span className="font-bold text-white text-base">{posts.length}</span>
            <span className="text-xs text-white/40 ml-1">Posts</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 px-4 mb-4">
        {(["posts", "media", "likes"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-all ${tab === t ? "text-primary border-b-2 border-primary" : "text-white/30 hover:text-white/60"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 space-y-3 pb-24">
        {tab === "posts" && (
          posts.length === 0
            ? <p className="text-center text-white/30 text-sm py-8">No posts to show yet.</p>
            : posts.map(p => <PostCard key={p.id} post={p} />)
        )}
        {tab === "media" && (
          <div>
            {posts.filter(p => p.imageUrl).length === 0
              ? <p className="text-center text-white/30 text-sm py-8">No media posts yet.</p>
              : (
                <div className="grid grid-cols-3 gap-1">
                  {posts.filter(p => p.imageUrl).map(p => (
                    <img key={p.id} src={p.imageUrl} alt="" className="w-full aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              )}
          </div>
        )}
        {tab === "likes" && (
          likedPosts.length === 0
            ? <p className="text-center text-white/30 text-sm py-8">No liked posts yet.</p>
            : likedPosts.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-6 pb-10 fade-in">
            <h3 className="font-bold text-lg text-white mb-5">Edit Profile</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  className="vibe-input w-full px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Bio</label>
                <textarea
                  value={newBio}
                  onChange={e => setNewBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                  maxLength={150}
                  className="vibe-input w-full px-4 py-3 text-sm resize-none min-h-[80px]"
                />
                <div className="text-right text-xs text-white/30 mt-0.5">{newBio.length}/150</div>
              </div>
            </div>
            <div className="flex gap-3 mb-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold">Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="flex-1 py-3 btn-gradient rounded-xl text-white text-sm font-bold disabled:opacity-40">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            <button onClick={logOut} className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
