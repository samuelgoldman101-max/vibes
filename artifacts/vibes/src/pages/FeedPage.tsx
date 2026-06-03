import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, off, set, get, remove, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, MessageCircle, Send, X, Trash2, ImageIcon } from "lucide-react";

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

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: `${color}33`, border: `2px solid ${color}66`, fontSize: size * 0.38, color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CommentSection({ postId, currentUser, userProfile }: { postId: string; currentUser: any; userProfile: any }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const commRef = ref(db, `comments/${postId}`);
      await push(commRef, {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
        avatarColor: userProfile.avatarColor,
        text: text.trim(),
        createdAt: Date.now(),
      });
      // Update comment count
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
      {/* Comment list */}
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

      {/* Comment input */}
      {currentUser && userProfile && (
        <div className="flex items-center gap-2">
          <Avatar name={userProfile.displayName} color={userProfile.avatarColor} size={28} />
          <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
            <input
              ref={inputRef}
              type="text"
              placeholder="Write a comment..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={sendComment}
              disabled={!text.trim() || sending}
              className="text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, currentUser, userProfile }: { post: Post; currentUser: any; userProfile: any }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);

  useEffect(() => {
    if (!currentUser) return;
    const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
    const unsub = onValue(likeRef, snap => setLiked(snap.exists()));
    return () => off(likeRef, "value", unsub);
  }, [post.id, currentUser]);

  useEffect(() => {
    const postRef = ref(db, `posts/${post.id}/likesCount`);
    const unsub = onValue(postRef, snap => setLikesCount(snap.val() || 0));
    return () => off(postRef, "value", unsub);
  }, [post.id]);

  useEffect(() => {
    const postRef = ref(db, `posts/${post.id}/commentsCount`);
    const unsub = onValue(postRef, snap => setCommentsCount(snap.val() || 0));
    return () => off(postRef, "value", unsub);
  }, [post.id]);

  async function toggleLike() {
    if (!currentUser) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 300);
    const likeRef = ref(db, `likes/${post.id}/${currentUser.uid}`);
    const postLikesRef = ref(db, `posts/${post.id}/likesCount`);
    if (liked) {
      await remove(likeRef);
      await set(postLikesRef, Math.max(0, likesCount - 1));
    } else {
      await set(likeRef, true);
      await set(postLikesRef, likesCount + 1);
    }
  }

  async function deletePost() {
    await remove(ref(db, `posts/${post.id}`));
    await remove(ref(db, `comments/${post.id}`));
    await remove(ref(db, `likes/${post.id}`));
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 card-hover fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={post.displayName} color={post.avatarColor} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{post.displayName}</div>
          <div className="text-xs text-muted-foreground">@{post.username} · {timeAgo(post.createdAt)}</div>
        </div>
        {currentUser?.uid === post.uid && (
          <button onClick={deletePost} className="text-muted-foreground hover:text-destructive transition-colors p-1">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-80 mb-3" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLike}
          className="flex items-center gap-1.5 text-sm transition-all duration-200 group"
        >
          <Heart
            size={18}
            className={`transition-all ${likeAnimating ? "like-pop" : ""} ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground group-hover:text-red-400"}`}
          />
          <span className={`font-medium ${liked ? "text-red-500" : "text-muted-foreground group-hover:text-red-400"}`}>
            {likesCount > 0 ? likesCount : ""}
          </span>
        </button>

        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
        >
          <MessageCircle size={18} className="group-hover:text-primary" />
          <span className="font-medium">{commentsCount > 0 ? commentsCount : ""}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentSection postId={post.id} currentUser={currentUser} userProfile={userProfile} />
      )}
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

export default function FeedPage() {
  const { currentUser, userProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    const postsRef = ref(db, "posts");
    const unsub = onValue(postsRef, snap => {
      const data = snap.val();
      const list: Post[] = data
        ? Object.entries(data).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.createdAt - a.createdAt)
        : [];
      setPosts(list);
      setLoadingPosts(false);
    });
    return () => off(postsRef, "value", unsub);
  }, []);

  async function createPost() {
    if (!newPost.trim() || !currentUser || !userProfile) return;
    setPosting(true);
    try {
      await push(ref(db, "posts"), {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
        avatarColor: userProfile.avatarColor,
        content: newPost.trim(),
        createdAt: Date.now(),
        likesCount: 0,
        commentsCount: 0,
      });
      setNewPost("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Composer */}
      {currentUser && userProfile && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Avatar name={userProfile.displayName} color={userProfile.avatarColor} size={40} />
            <div className="flex-1">
              <textarea
                placeholder="What's your vibe today?"
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                className="vibe-input w-full px-3 py-2.5 text-sm resize-none min-h-[80px]"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) createPost();
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{newPost.length}/500</span>
                <button
                  onClick={createPost}
                  disabled={!newPost.trim() || posting || newPost.length > 500}
                  className="btn-gradient px-4 py-1.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Send size={14} />
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      {loadingPosts ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-2 bg-muted rounded w-1/4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">✨</div>
          <p className="font-medium">No posts yet</p>
          <p className="text-sm">Be the first to share your vibe!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUser={currentUser} userProfile={userProfile} />
          ))}
        </div>
      )}
    </div>
  );
}
