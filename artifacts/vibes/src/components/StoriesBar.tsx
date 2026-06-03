import { useState, useEffect, useRef } from "react";
import { ref as dbRef, push, set, onValue, off, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { uploadMedia } from "@/lib/storage";
import { Plus, X, Type, Image as ImageIcon } from "lucide-react";
import StoryViewer, { type Story, type StoryGroup } from "@/components/StoryViewer";

const TEXT_BG_OPTIONS = [
  { key: "purple", label: "Purple", style: "linear-gradient(135deg,#7c4dff,#e040fb)" },
  { key: "pink",   label: "Pink",   style: "linear-gradient(135deg,#e91e63,#ff5722)" },
  { key: "blue",   label: "Blue",   style: "linear-gradient(135deg,#1565c0,#00bcd4)" },
  { key: "dark",   label: "Dark",   style: "linear-gradient(135deg,#1a1a2e,#16213e)" },
];

export default function StoriesBar() {
  const { currentUser, userProfile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"choose" | "text">("choose");
  const [textContent, setTextContent] = useState("");
  const [textBg, setTextBg] = useState("purple");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storiesRef = dbRef(db, "stories");
    const unsub = onValue(storiesRef, snap => {
      const data = snap.val();
      const now = Date.now();
      const groupMap: Record<string, StoryGroup> = {};

      if (data) {
        Object.entries(data).forEach(([uid, userStories]: any) => {
          const storyList: Story[] = Object.entries(userStories)
            .map(([id, val]: any) => ({ id, ...val }))
            .filter((s: Story) => s.expiresAt > now)
            .sort((a: Story, b: Story) => a.createdAt - b.createdAt);

          if (storyList.length > 0) {
            groupMap[uid] = {
              uid,
              displayName: storyList[0].displayName,
              avatarColor: storyList[0].avatarColor,
              stories: storyList,
            };
          }
        });
      }

      // current user always first
      const sorted = Object.values(groupMap).sort((a, b) => {
        if (a.uid === currentUser?.uid) return -1;
        if (b.uid === currentUser?.uid) return 1;
        const aLast = a.stories[a.stories.length - 1].createdAt;
        const bLast = b.stories[b.stories.length - 1].createdAt;
        return bLast - aLast;
      });
      setGroups(sorted);
    });
    return () => off(storiesRef, "value", unsub);
  }, [currentUser?.uid]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !userProfile) return;
    e.target.value = "";
    setUploading(true);
    setUploadPct(0);
    try {
      const ext = file.name.split(".").pop();
      const path = `stories/${currentUser.uid}/${Date.now()}.${ext}`;
      const url = await uploadMedia(file, path, pct => setUploadPct(pct));
      const isVideo = file.type.startsWith("video/");
      const storyRef = dbRef(db, `stories/${currentUser.uid}`);
      await push(storyRef, {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        avatarColor: userProfile.avatarColor,
        mediaUrl: url,
        mediaType: isVideo ? "video" : "image",
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("Story upload failed", err);
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function postTextStory() {
    if (!textContent.trim() || !currentUser || !userProfile) return;
    setUploading(true);
    try {
      await push(dbRef(db, `stories/${currentUser.uid}`), {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        avatarColor: userProfile.avatarColor,
        mediaUrl: "",
        mediaType: "text",
        textContent: textContent.trim(),
        textBg,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      setTextContent("");
      setShowAddModal(false);
      setAddMode("choose");
    } finally {
      setUploading(false);
    }
  }

  const myGroup = groups.find(g => g.uid === currentUser?.uid);
  const otherGroups = groups.filter(g => g.uid !== currentUser?.uid);

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {/* Add story button */}
        <button
          onClick={() => { setShowAddModal(true); setAddMode("choose"); }}
          className="flex flex-col items-center gap-1.5 flex-shrink-0"
        >
          <div className="relative">
            {myGroup ? (
              <div className="story-ring p-[2px] rounded-full">
                <div
                  className="w-[56px] h-[56px] rounded-full flex items-center justify-center font-black text-lg"
                  style={{ background: "#0d0d12", color: userProfile?.avatarColor || "#e040fb", border: `2px solid #0d0d12` }}
                >
                  {userProfile?.displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="w-[60px] h-[60px] rounded-full bg-white/6 border-2 border-dashed border-white/20 flex items-center justify-center">
                <Plus size={22} className="text-white/40" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full btn-gradient flex items-center justify-center border-2 border-[#0d0d12]">
              <Plus size={10} className="text-white" />
            </div>
          </div>
          <span className="text-[10px] text-white/40">
            {myGroup ? "Your Story" : "Add Story"}
          </span>
        </button>

        {/* Other user stories */}
        {otherGroups.map(group => {
          const idx = groups.indexOf(group);
          return (
            <button
              key={group.uid}
              onClick={() => setViewingIndex(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="story-ring p-[2px] rounded-full">
                <div
                  className="w-[56px] h-[56px] rounded-full flex items-center justify-center font-black text-lg"
                  style={{ background: "#0d0d12", color: group.avatarColor, border: `2px solid #0d0d12` }}
                >
                  {group.displayName.charAt(0).toUpperCase()}
                </div>
              </div>
              <span className="text-[10px] text-white/50 truncate w-14 text-center">
                {group.displayName.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story Viewer */}
      {viewingIndex !== null && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          startIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
        />
      )}

      {/* Add Story Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#16151f] rounded-t-3xl p-6 pb-8 fade-in">
            {addMode === "choose" ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-lg text-white">Add to Story</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                {uploading && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-white/40 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full btn-gradient rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex flex-col items-center gap-3 bg-white/5 hover:bg-white/8 rounded-2xl p-5 transition-colors disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-2xl btn-gradient flex items-center justify-center">
                      <ImageIcon size={22} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-white">Photo / Video</span>
                    <span className="text-xs text-white/40 text-center">From camera or gallery</span>
                  </button>
                  <button
                    onClick={() => setAddMode("text")}
                    className="flex flex-col items-center gap-3 bg-white/5 hover:bg-white/8 rounded-2xl p-5 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <Type size={22} className="text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-white">Text</span>
                    <span className="text-xs text-white/40 text-center">Write something</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setAddMode("choose")} className="text-white/40 hover:text-white">
                    <X size={18} />
                  </button>
                  <h3 className="font-bold text-lg text-white">Text Story</h3>
                </div>
                {/* Preview */}
                <div
                  className="w-full h-36 rounded-2xl flex items-center justify-center mb-4 p-4"
                  style={{ background: TEXT_BG_OPTIONS.find(b => b.key === textBg)?.style }}
                >
                  <p className="text-white text-xl font-bold text-center leading-tight">
                    {textContent || "Your story text here..."}
                  </p>
                </div>
                {/* BG picker */}
                <div className="flex gap-2 mb-3">
                  {TEXT_BG_OPTIONS.map(b => (
                    <button
                      key={b.key}
                      onClick={() => setTextBg(b.key)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${textBg === b.key ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: b.style }}
                    />
                  ))}
                </div>
                <textarea
                  placeholder="What's on your mind?"
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  autoFocus
                  className="vibe-input w-full px-4 py-3 text-sm resize-none min-h-[80px] mb-4"
                />
                <button
                  onClick={postTextStory}
                  disabled={!textContent.trim() || uploading}
                  className="w-full py-3 btn-gradient rounded-2xl text-white font-bold text-sm disabled:opacity-40"
                >
                  {uploading ? "Posting..." : "Share Story"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
