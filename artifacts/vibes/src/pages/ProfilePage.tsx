import { useState, useEffect, useRef } from "react";
import { ref, onValue, off, get, set, remove, update, push } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings, Heart, MessageCircle, Send, Trash2, MapPin, Calendar,
  Plus, Camera, Image as ImageIcon, FileVideo, X, Loader2
} from "lucide-react";
import { uploadMedia } from "@/lib/storage";

interface Post {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
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

function SmallAvatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-xs select-none"
      style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const { currentUser, userProfile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const cRef = ref(db, `comments/${postId}`);
    const unsub = onValue(cRef, snap => {
      const data = snap.val();
      setComments(
        data
          ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt)
          : []
      );
    });
    return () => off(cRef, "value", unsub);
  }, [postId]);

  async function sendComment() {
    if (!text.trim() || !currentUser || !userProfile) return;
    setSending(true);
    try {
      const newRef = push(ref(db, `comments/${postId}`));
      await set(newRef, {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
        avatarColor: userProfile.avatarColor,
        text: text.trim(),
        createdAt: Date.now(),
      });
      const snap = await get(ref(db, `posts/${postId}/commentsCount`));
      await set(ref(db, `posts/${postId}/commentsCount`), (snap.val() || 0) + 1);
      setText("");
    } finally { setSending(false); }
  }

  if (!currentUser || !userProfile) return null;

  return (
    <div className="border-t border-white/5 mt-3 pt-3 space-y-2">
      <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
        {comments.length === 0 && (
          <p className="text-white/25 text-xs text-center py-2">No comments yet — be first!</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2">
            <SmallAvatar name={c.displayName} color={c.avatarColor} />
            <div className="flex-1 min-w-0">
              <div className="bg-white/5 rounded-xl px-3 py-1.5">
                <span className="font-semibold text-xs text-white/90">{c.displayName} </span>
                <span className="text-xs text-white/75">{c.text}</span>
              </div>
              <span className="text-[10px] text-white/25 ml-2">{timeAgo(c.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <SmallAvatar name={userProfile.displayName} color={userProfile.avatarColor} />
        <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5">
          <input
            type="text"
            placeholder="Add a comment..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendComment()}
            className="flex-1 bg-transparent text-xs outline-none text-white placeholder:text-white/25"
          />
          <button
            onClick={sendComment}
            disabled={!text.trim() || sending}
            className="text-primary disabled:opacity-30 transition-opacity"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, userProfile, logOut, refreshProfile } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"posts" | "media" | "likes">("posts");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  // Settings / edit
  const [showSettings, setShowSettings] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  // Create post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postText, setPostText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaTypeSelected, setMediaTypeSelected] = useState<"image" | "video" | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [posting, setPosting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Load posts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const pRef = ref(db, "posts");
    const unsub = onValue(pRef, snap => {
      const data = snap.val();
      const all: Post[] = data
        ? Object.entries(data).map(([id, v]: any) => ({ id, ...v }))
        : [];
      const mine = all.filter(p => p.uid === currentUser.uid).sort((a, b) => b.createdAt - a.createdAt);
      setPosts(mine);
    });
    return () => off(pRef, "value", unsub);
  }, [currentUser]);

  // ── Load liked posts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const likesRef = ref(db, `userLikes/${currentUser.uid}`);
    const unsub = onValue(likesRef, async snap => {
      const data = snap.val();
      if (!data) { setLikedIds(new Set()); setLikedPosts([]); return; }
      const ids = new Set<string>(Object.keys(data));
      setLikedIds(ids);
      // fetch the actual posts
      const postsSnap = await get(ref(db, "posts"));
      const postsData = postsSnap.val();
      if (postsData) {
        const liked: Post[] = Object.entries(postsData)
          .map(([id, v]: any) => ({ id, ...v }))
          .filter((p: Post) => ids.has(p.id))
          .sort((a, b) => b.createdAt - a.createdAt);
        setLikedPosts(liked);
      }
    });
    return () => off(likesRef, "value", unsub);
  }, [currentUser]);

  // ── Real-time like / comment counts for own posts ───────────────────────
  useEffect(() => {
    if (!currentUser || posts.length === 0) return;
    const unsubs: (() => void)[] = [];
    posts.forEach(post => {
      const u1 = onValue(ref(db, `likes/${post.id}/${currentUser.uid}`), s => {
        const liked = s.exists();
        setLikedIds(prev => { const n = new Set(prev); liked ? n.add(post.id) : n.delete(post.id); return n; });
        if (liked) set(ref(db, `userLikes/${currentUser.uid}/${post.id}`), true);
      });
      const u2 = onValue(ref(db, `posts/${post.id}/likesCount`), s =>
        setLikeCounts(p => ({ ...p, [post.id]: s.val() || 0 })));
      const u3 = onValue(ref(db, `posts/${post.id}/commentsCount`), s =>
        setCommentCounts(p => ({ ...p, [post.id]: s.val() || 0 })));
      unsubs.push(
        () => off(ref(db, `likes/${post.id}/${currentUser.uid}`), "value", u1),
        () => off(ref(db, `posts/${post.id}/likesCount`), "value", u2),
        () => off(ref(db, `posts/${post.id}/commentsCount`), "value", u3),
      );
    });
    return () => unsubs.forEach(fn => fn());
  }, [currentUser, posts]);

  // ── Handlers ────────────────────────────────────────────────────────────
  async function toggleLike(post: Post) {
    if (!currentUser) return;
    const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
    const likesRef = ref(db, `posts/${post.id}/likesCount`);
    const isLiked = likedIds.has(post.id);
    if (isLiked) {
      await remove(likeRef);
      await remove(ref(db, `userLikes/${currentUser.uid}/${post.id}`));
      await set(likesRef, Math.max(0, (likeCounts[post.id] || 1) - 1));
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMediaFile(file);
    setMediaTypeSelected(type);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  }

  function clearMedia() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaTypeSelected(null);
  }

  async function submitPost() {
    if (!currentUser || !userProfile) return;
    if (!postText.trim() && !mediaFile) return;
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | undefined;
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop();
        const path = `posts/${currentUser.uid}/${Date.now()}.${ext}`;
        mediaUrl = await uploadMedia(mediaFile, path, pct => setUploadPct(pct));
        mediaType = mediaTypeSelected ?? (mediaFile.type.startsWith("video/") ? "video" : "image");
      }
      await push(ref(db, "posts"), {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
        avatarColor: userProfile.avatarColor,
        content: postText.trim(),
        ...(mediaUrl ? { mediaUrl, mediaType } : {}),
        createdAt: Date.now(),
        likesCount: 0,
        commentsCount: 0,
      });
      setPostText("");
      clearMedia();
      setShowCreatePost(false);
    } finally {
      setPosting(false);
      setUploadPct(0);
    }
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

  // ── Post card ────────────────────────────────────────────────────────────
  function PostCard({ post }: { post: Post }) {
    const liked = likedIds.has(post.id);
    const likes = likeCounts[post.id] ?? post.likesCount ?? 0;
    const comments = commentCounts[post.id] ?? post.commentsCount ?? 0;
    const showCom = openComments.has(post.id);

    return (
      <div className="bg-white/3 border border-white/6 rounded-2xl p-4 fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/30">{timeAgo(post.createdAt)}</span>
          {post.uid === currentUser?.uid && (
            <button onClick={() => deletePost(post.id)} className="text-white/20 hover:text-red-400 transition-colors p-0.5">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        {post.content && (
          <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
        )}
        {post.mediaUrl && (
          post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              controls
              playsInline
              className="w-full rounded-xl max-h-72 object-cover mb-3 bg-black"
            />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full rounded-xl object-cover max-h-72 mb-3" />
          )
        )}
        <div className="flex items-center gap-4">
          <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5 group">
            <Heart
              size={17}
              className={`transition-all ${liked ? "fill-red-500 text-red-500" : "text-white/30 group-hover:text-red-400"}`}
            />
            {likes > 0 && <span className={`text-xs font-medium ${liked ? "text-red-500" : "text-white/30"}`}>{likes}</span>}
          </button>
          <button
            onClick={() => setOpenComments(prev => {
              const n = new Set(prev);
              n.has(post.id) ? n.delete(post.id) : n.add(post.id);
              return n;
            })}
            className="flex items-center gap-1.5 text-white/30 hover:text-primary transition-colors"
          >
            <MessageCircle size={17} />
            {comments > 0 && <span className="text-xs font-medium">{comments}</span>}
          </button>
        </div>
        {showCom && <CommentSection postId={post.id} />}
      </div>
    );
  }

  // ── Show loading if not ready yet ────────────────────────────────────────
  if (!currentUser || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0d12]">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const joinYear = new Date(userProfile.createdAt || Date.now()).getFullYear();
  const mediaPosts = posts.filter(p => p.mediaUrl);

  return (
    <div className="bg-[#0d0d12] min-h-screen pb-28">
      {/* Banner */}
      <div
        className="h-36 relative"
        style={{ background: `linear-gradient(135deg, hsl(291 95% 50%), hsl(267 80% 50%), hsl(320 90% 55%))` }}
      >
        <button
          onClick={() => {
            setNewBio(userProfile.bio || "");
            setNewDisplayName(userProfile.displayName);
            setShowSettings(true);
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/40 transition-colors"
        >
          <Settings size={17} />
        </button>
      </div>

      {/* Avatar + info */}
      <div className="px-4">
        <div className="-mt-9 mb-3">
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center font-black text-2xl border-[3.5px]"
            style={{
              background: `${userProfile.avatarColor}18`,
              color: userProfile.avatarColor,
              borderColor: "#0d0d12",
              boxShadow: `0 0 0 2px ${userProfile.avatarColor}55`,
            }}
          >
            {userProfile.displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        <h2 className="text-xl font-bold text-white leading-tight">{userProfile.displayName}</h2>
        <p className="text-sm text-white/40 mb-2">@@{userProfile.username}</p>
        <p className="text-sm text-white/70 leading-relaxed mb-3">
          {userProfile.bio || "No bio yet. Tap ⚙️ to add one!"}
        </p>

        <div className="flex items-center gap-4 mb-4 text-xs text-white/30">
          <div className="flex items-center gap-1.5">
            <MapPin size={11} />
            <span>Internet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={11} />
            <span>Joined {joinYear}</span>
          </div>
        </div>

        <div className="flex gap-6 pb-4 border-b border-white/6">
          <div><span className="font-bold text-white">{userProfile.followingCount || 0}</span> <span className="text-xs text-white/40">Following</span></div>
          <div><span className="font-bold text-white">{userProfile.followersCount || 0}</span> <span className="text-xs text-white/40">Followers</span></div>
          <div><span className="font-bold text-white">{posts.length}</span> <span className="text-xs text-white/40">Posts</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/6 px-4">
        {(["posts", "media", "likes"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-all ${
              tab === t ? "text-primary border-b-2 border-primary" : "text-white/30 hover:text-white/55"
            }`}
          >
            {t === "media" ? `Media (${mediaPosts.length})` : t === "likes" ? `Likes (${likedPosts.length})` : `Posts (${posts.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4 space-y-3">
        {tab === "posts" && (
          posts.length === 0
            ? <p className="text-center text-white/30 text-sm py-10">No posts yet. Tap + to share your vibe!</p>
            : posts.map(p => <PostCard key={p.id} post={p} />)
        )}

        {tab === "media" && (
          mediaPosts.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-10">No media posts yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {mediaPosts.map(p => (
                p.mediaType === "video" ? (
                  <div key={p.id} className="relative aspect-square bg-black rounded-lg overflow-hidden">
                    <video src={p.mediaUrl} className="w-full h-full object-cover opacity-90" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileVideo size={20} className="text-white/70" />
                    </div>
                  </div>
                ) : (
                  <img key={p.id} src={p.mediaUrl} alt="" className="w-full aspect-square object-cover rounded-lg" />
                )
              ))}
            </div>
          )
        )}

        {tab === "likes" && (
          likedPosts.length === 0
            ? <p className="text-center text-white/30 text-sm py-10">No liked posts yet.</p>
            : likedPosts.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {/* Floating + create post button */}
      <button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-24 right-5 w-14 h-14 btn-gradient rounded-full flex items-center justify-center shadow-2xl glow-primary z-40"
      >
        <Plus size={26} className="text-white" />
      </button>

      {/* ── Create Post Modal ─────────────────────────────────────────── */}
      {showCreatePost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-5 pb-8 fade-in max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-bold text-lg text-white">New Post</h3>
              <button onClick={() => { setShowCreatePost(false); clearMedia(); setPostText(""); }} className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <textarea
                placeholder="What's your vibe today?"
                value={postText}
                onChange={e => setPostText(e.target.value)}
                autoFocus
                className="vibe-input w-full px-4 py-3 text-sm resize-none min-h-[100px]"
              />

              {/* Media preview */}
              {mediaPreview && (
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  {mediaTypeSelected === "video" ? (
                    <video src={mediaPreview} controls className="w-full max-h-52 object-cover" />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="w-full max-h-52 object-cover" />
                  )}
                  <button
                    onClick={clearMedia}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Upload progress */}
              {posting && uploadPct > 0 && uploadPct < 100 && (
                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>Uploading media...</span>
                    <span>{uploadPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full btn-gradient rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                </div>
              )}

              {/* Media picker buttons */}
              {!mediaFile && (
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 rounded-xl py-3 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <ImageIcon size={16} className="text-primary/70" />
                    Photo
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 rounded-xl py-3 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <FileVideo size={16} className="text-primary/70" />
                    Video
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 rounded-xl py-3 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <Camera size={16} className="text-primary/70" />
                    Camera
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={submitPost}
              disabled={posting || (!postText.trim() && !mediaFile)}
              className="mt-4 w-full py-3.5 btn-gradient rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 flex-shrink-0"
            >
              {posting ? (
                <><Loader2 size={16} className="animate-spin" /> Posting...</>
              ) : (
                <><Send size={16} /> Share Post</>
              )}
            </button>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e, "image")}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e, "video")}
            />
          </div>
        </div>
      )}

      {/* ── Settings Modal ────────────────────────────────────────────── */}
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
                  maxLength={160}
                  className="vibe-input w-full px-4 py-3 text-sm resize-none min-h-[80px]"
                />
                <div className="text-right text-xs text-white/30 mt-0.5">{newBio.length}/160</div>
              </div>
            </div>
            <div className="flex gap-3 mb-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/55 text-sm font-semibold">Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="flex-1 py-3 btn-gradient rounded-xl text-white text-sm font-bold disabled:opacity-40">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
            <button
              onClick={logOut}
              className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
