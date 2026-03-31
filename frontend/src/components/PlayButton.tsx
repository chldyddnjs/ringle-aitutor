interface PlayButtonProps {
  isPlaying: boolean;
  onClick: () => void;
  size?: number;
}

export function PlayButton({ isPlaying, onClick, size = 28 }: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      title={isPlaying ? "정지" : "재생"}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        border: `1px solid ${isPlaying ? "#7C3AED" : "#DDD6FE"}`,
        background: isPlaying ? "#7C3AED" : "#F5F3FF",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {isPlaying ? (
          <>
            <rect x="2" y="2" width="3" height="8" rx="1" fill={isPlaying ? "#fff" : "#7C3AED"} />
            <rect x="7" y="2" width="3" height="8" rx="1" fill={isPlaying ? "#fff" : "#7C3AED"} />
          </>
        ) : (
          <polygon points="2,1 10,6 2,11" fill="#7C3AED" />
        )}
      </svg>
    </button>
  );
}
