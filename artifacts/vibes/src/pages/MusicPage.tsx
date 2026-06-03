import { useState, useEffect, useRef } from "react";
import { Search, Play, Pause, SkipBack, SkipForward, X, Music } from "lucide-react";

interface Track {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

const TRENDING_TERMS = ["pop", "hip hop", "vibes", "trending 2025"];

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [playing, setPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const term = TRENDING_TERMS[Math.floor(Math.random() * TRENDING_TERMS.length)];
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=20&media=music`)
      .then(r => r.json())
      .then(d => {
        setTrending((d.results || []).filter((t: Track) => t.previewUrl));
        setTrendingLoading(false);
      })
      .catch(() => setTrendingLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setTracks([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&media=music`)
        .then(r => r.json())
        .then(d => {
          setTracks((d.results || []).filter((t: Track) => t.previewUrl));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  function playTrack(track: Track) {
    if (!track.previewUrl) return;
    if (playing?.trackId === track.trackId) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
    setPlaying(track);
    setCurrentTime(0);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }

  function skipTrack(dir: "next" | "prev") {
    const list = query ? tracks : trending;
    const idx = list.findIndex(t => t.trackId === playing?.trackId);
    const next = dir === "next" ? list[idx + 1] : list[idx - 1];
    if (next) playTrack(next);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const displayList = query ? tracks : trending;

  return (
    <div className="bg-[#0d0d12] min-h-screen pb-36">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Music</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search songs, artists..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="vibe-input w-full pl-9 pr-4 py-3 text-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      {!query && (
        <div className="px-4 mb-3">
          <span className="text-xs font-bold text-white/30 tracking-widest uppercase">Trending Now</span>
        </div>
      )}

      {/* Track list */}
      {(loading || trendingLoading) ? (
        <div className="px-4 space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-white/8 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/8 rounded w-1/2" />
                <div className="h-2 bg-white/5 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-20">
          <Music size={44} className="mx-auto mb-3 text-white/10" />
          <p className="text-white/40 text-sm">No songs found</p>
        </div>
      ) : (
        <div className="px-4 space-y-0">
          {displayList.map((track, i) => {
            const isActive = playing?.trackId === track.trackId;
            return (
              <button
                key={track.trackId}
                onClick={() => playTrack(track)}
                className={`w-full flex items-center gap-3 py-3 px-2 rounded-xl transition-colors text-left ${isActive ? "bg-primary/10" : "hover:bg-white/4"}`}
              >
                <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/8">
                  {track.artworkUrl100 ? (
                    <img src={track.artworkUrl100} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music size={20} className="absolute inset-0 m-auto text-white/20" />
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm truncate ${isActive ? "text-primary" : "text-white"}`}>{track.trackName}</div>
                  <div className="text-xs text-white/40 truncate">{track.artistName}</div>
                </div>
                {!isActive && (
                  <Play size={16} className="text-white/20 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Mini Player */}
      {playing && (
        <div className="fixed bottom-16 left-0 right-0 z-50 px-3">
          <div className="bg-[#1a1825] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
            {/* Progress bar */}
            <div className="mb-3">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full btn-gradient rounded-full transition-all"
                  style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30">{fmt(currentTime)}</span>
                <span className="text-[10px] text-white/30">{fmt(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/8">
                {playing.artworkUrl100 && <img src={playing.artworkUrl100} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate">{playing.trackName}</div>
                <div className="text-xs text-white/40 truncate">{playing.artistName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => skipTrack("prev")} className="text-white/40 hover:text-white transition-colors">
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={() => playTrack(playing)}
                  className="w-9 h-9 btn-gradient rounded-full flex items-center justify-center text-white"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button onClick={() => skipTrack("next")} className="text-white/40 hover:text-white transition-colors">
                  <SkipForward size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
