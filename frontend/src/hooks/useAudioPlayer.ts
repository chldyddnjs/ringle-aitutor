import { useRef, useState, useCallback } from "react";

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((id: string, url: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === id) { setPlayingId(null); return; }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    audio.onerror = () => { setPlayingId(null); audioRef.current = null; };
    audio.play().catch(() => setPlayingId(null));
  }, [playingId]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  return { playingId, play, stop };
}
