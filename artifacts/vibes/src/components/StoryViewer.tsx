import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface Story {
  id: string;
  uid: string;
  displayName: string;
  avatarColor: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "text";
  textContent?: string;
  textBg?: string;
  createdAt: number;
  expiresAt: number;
}

export interface StoryGroup {
  uid: string;
  displayName: string;
  avatarColor: string;
  stories: Story[];
}

interface Props {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 5000;

export default function StoryViewer({ groups, startIndex, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function startTimer() {
    clearTimer();
    setProgress(0);
    const dur = story?.mediaType === "video" ? (videoRef.current?.duration || 10) * 1000 : STORY_DURATION;
    const step = 100 / (dur / 50);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearTimer();
          advance();
          return 100;
        }
        return p + step;
      });
    }, 50);
  }

  function advance() {
    if (storyIdx < (group?.stories.length ?? 0) - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(i => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }

  function back() {
    if (storyIdx > 0) setStoryIdx(i => i - 1);
    else if (groupIdx > 0) { setGroupIdx(i => i - 1); setStoryIdx(0); }
  }

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [story?.id]);

  if (!group || !story) return null;

  const textBgs: Record<string, string> = {
    purple: "linear-gradient(135deg,#7c4dff,#e040fb)",
    pink: "linear-gradient(135deg,#e91e63,#ff5722)",
    blue: "linear-gradient(135deg,#1565c0,#00bcd4)",
    dark: "linear-gradient(135deg,#1a1a2e,#16213e)",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-sm h-full max-h-screen overflow-hidden" style={{ maxHeight: "100dvh" }}>
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: `${group.avatarColor}33`, border: `2px solid ${group.avatarColor}`, color: group.avatarColor }}
            >
              {group.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white text-sm font-semibold drop-shadow">{group.displayName}</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>

        {/* Story content */}
        <div className="w-full h-full">
          {story.mediaType === "image" && (
            <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" />
          )}
          {story.mediaType === "video" && (
            <video
              ref={videoRef}
              src={story.mediaUrl}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => startTimer()}
              onEnded={advance}
            />
          )}
          {story.mediaType === "text" && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ background: textBgs[story.textBg || "purple"] }}
            >
              <p className="text-white text-2xl font-bold text-center leading-tight drop-shadow-lg">
                {story.textContent}
              </p>
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={back} />
        <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={advance} />
      </div>
    </div>
  );
}
