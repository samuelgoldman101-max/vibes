import { useState, useEffect } from "react";
import { ref, onValue, off, get, set, remove, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, MessageCircle, Edit2, Check, X, LogOut, Send, Trash2 } from "lucide-react";

interface Post {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
  content: string;
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
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function CommentSection({ postId, currentUser, userProfile }: { postId: string; currentUser: any; userProfile: any }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const commRef = ref(db, `comments/${postId}`);
    const unsub = onValue(commRef, snap => {
      const data = snap.val();
      const list: Comment[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => a.createdAt - b.createdAt)
        : [];
      setComments(list);
    });
    return () => off(commRef, "value", unsub);
  }, [postId]);

  async function sendComment() {
    if (!text.trim() || !currentUser || !userProfile) return;
    setSending(true);
    try {
      await set(ref(db, `comments/${postId}/${Date.now()}`), {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
        avatarColor: userProfile.avatarColor,
        text: text.trim(),
        createdAt: Date.now(),
      });
      const countRef = ref(db, `posts/${postId}/commentsCount`);
      const snap = await get(countRef);
      await set(countRef, (snap.val() || 0) + 1);
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(commentId: string) {
    await remove(ref(db, `comments/${postId}/${commentId}`));
    const countRef = ref(db, `posts/${postId}/commentsCount`);
    const snap = await get(countRef);
    await set(countRef, Math.max(0, (snap.val() || 1) - 1));
  }

  return (
    <div className="border-t border-border mt-3 pt-3 space-y-3">
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-2">No comments yet. Be first!</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2 group">
            <Avatar name={c.displayName} color={c.avatarColor} size={28} />
            <div className="flex-1 min-w-0">
              <div className="bg-muted rounded-xl px-3 py-1.5">
                <span className="font-semibold text-xs text-foreground">{c.displayName} </span>
                <span className="text-xs text-foreground/90">{c.text}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-2">{timeAgo(c.createdAt)}</span>
            </div>
            {currentUser?.uid === c.uid && (
              <button
                onClick={() => deleteComment(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {currentUser && userProfile && (
        <div className="flex items-center gap-2">
          <Avatar name={userProfile.displayName} color={userProfile.avatarColor} size={28} />
          <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
            <input
              type="text"
              placeholder="Write a comment..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={sendComment} disabled={!text.trim() || sending} className="text-primary hover:text-primary/80 disabled:opacity-40 transition-colors">
              <Send size={14} />
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
  const [editing, setEditing] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [postLikeCounts, setPostLikeCounts] = useState<Record<string, number>>({});
  const [postCommentCounts, setPostCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;
    const postsRef = ref(db, "posts");
    const unsub = onValue(postsRef, snap => {
      const data = snap.val();
      const list: Post[] = data
        ? Object.entries(data)
            .map(([id, val]: any) => ({ id, ...val }))
            .filter((p: Post) => p.uid === currentUser.uid)
            .sort((a, b) => b.createdAt - a.createdAt)
        : [];
      setPosts(list);
    });
    return () => off(postsRef, "value", unsub);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || posts.length === 0) return;
    const unsubscribers: (() => void)[] = [];
    posts.forEach(post => {
      const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
      const unsub1 = onValue(likeRef, snap => {
        setLikedPostIds(prev => {
          const next = new Set(prev);
          if (snap.exists()) next.add(post.id); else next.delete(post.id);
          return next;
        });
      });
      const likesCountRef = ref(db, `posts/${post.id}/likesCount`);
      const unsub2 = onValue(likesCountRef, snap => {
        setPostLikeCounts(prev => ({ ...prev, [post.id]: snap.val() || 0 }));
      });
      const commentsCountRef = ref(db, `posts/${post.id}/commentsCount`);
      const unsub3 = onValue(commentsCountRef, snap => {
        setPostCommentCounts(prev => ({ ...prev, [post.id]: snap.val() || 0 }));
      });
      unsubscribers.push(() => off(likeRef, "value", unsub1));
      unsubscribers.push(() => off(likesCountRef, "value", unsub2));
      unsubscribers.push(() => off(commentsCountRef, "value", unsub3));
    });
    return () => unsubscribers.forEach(fn => fn());
  }, [currentUser, posts]);

  async function toggleLike(post: Post) {
    if (!currentUser) return;
    const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
    const postLikesRef = ref(db, `posts/${post.id}/likesCount`);
    const isLiked = likedPostIds.has(post.id);
    const count = postLikeCounts[post.id] || 0;
    if (isLiked) {
      await remove(likeRef);
      await set(postLikesRef, Math.max(0, count - 1));
    } else {
      await set(likeRef, true);
      await set(postLikesRef, count + 1);
    }
  }

  async function deletePost(postId: string) {
    await remove(ref(db, `posts/${postId}`));
    await remove(ref(db, `comments/${postId}`));
    await remove(ref(db, `likes/${postId}`));
  }

  function startEdit() {
    setNewBio(userProfile?.bio || "");
    setNewDisplayName(userProfile?.displayName || "");
    setEditing(true);
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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!currentUser || !userProfile) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Sign in to view profile</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Profile card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="story-ring">
            <div
              className="flex items-center justify-center rounded-full text-white font-black"
              style={{
                width: 72,
                height: 72,
                background: `${userProfile.avatarColor}22`,
                border: `3px solid ${userProfile.avatarColor}`,
                fontSize: 28,
                color: userProfile.avatarColor,
              }}
            >
              {userProfile.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <button onClick={startEdit} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={logOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive border border-border rounded-lg px-3 py-1.5 transition-colors">
                  <LogOut size={12} /> Sign out
                </button>
              </>
            ) : (
              <>
                <button onClick={saveProfile} disabled={saving} className="flex items-center gap-1.5 text-xs text-green-400 border border-green-400/30 rounded-lg px-3 py-1.5 hover:bg-green-400/10 transition-colors">
                  <Check size={12} /> {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
                  <X size={12} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Display Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                className="vibe-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bio</label>
              <textarea
                value={newBio}
                onChange={e => setNewBio(e.target.value)}
                placeholder="Tell people about yourself..."
                maxLength={150}
                className="vibe-input w-full px-3 py-2 text-sm resize-none min-h-[70px]"
              />
              <div className="text-xs text-muted-foreground text-right mt-0.5">{newBio.length}/150</div>
            </div>
          </div>
        ) : (
          <>
            <div className="font-bold text-lg">{userProfile.displayName}</div>
            <div className="text-sm text-muted-foreground mb-2">@{userProfile.username}</div>
            {userProfile.bio && <p className="text-sm text-foreground/80">{userProfile.bio}</p>}
          </>
        )}

        <div className="flex gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="font-bold text-lg">{posts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">📝</div>
            <p className="font-medium">No posts yet</p>
            <p className="text-sm">Share your first vibe on the feed!</p>
          </div>
        ) : (
          posts.map(post => {
            const liked = likedPostIds.has(post.id);
            const likesCount = postLikeCounts[post.id] ?? post.likesCount;
            const commentsCount = postCommentCounts[post.id] ?? post.commentsCount;
            const showComments = openComments.has(post.id);
            return (
              <div key={post.id} className="bg-card border border-border rounded-2xl p-4 fade-in">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={post.displayName} color={userProfile.avatarColor} size={36} />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</div>
                  </div>
                  <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">{post.content}</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5 text-sm group">
                    <Heart
                      size={18}
                      className={`transition-all ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground group-hover:text-red-400"}`}
                    />
                    <span className={`font-medium ${liked ? "text-red-500" : "text-muted-foreground"}`}>
                      {likesCount > 0 ? likesCount : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => setOpenComments(prev => {
                      const next = new Set(prev);
                      if (next.has(post.id)) next.delete(post.id); else next.add(post.id);
                      return next;
                    })}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle size={18} />
                    <span className="font-medium">{commentsCount > 0 ? commentsCount : ""}</span>
                  </button>
                </div>
                {showComments && (
                  <CommentSection postId={post.id} currentUser={currentUser} userProfile={userProfile} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
