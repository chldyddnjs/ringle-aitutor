import type { ChatMessage } from "../types";
import { PlayButton } from "./PlayButton";

interface MessageBubbleProps {
  message: ChatMessage;
  isPlaying: boolean;
  onPlay: (id: string, url: string) => void;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isPlaying, onPlay, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: "16px",
    }}>
      {/* 말풍선 */}
      <div style={{
        maxWidth: "75%",
        padding: "12px 16px",
        borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        background: isUser ? "#7C3AED" : "#F5F3FF",
        color: isUser ? "#fff" : "#1F1735",
        fontSize: "15px",
        lineHeight: "1.65",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {message.content}
        {/* 스트리밍 커서 */}
        {isStreaming && !message.content && (
          <span style={{ display: "inline-block", width: "2px", height: "16px",
            background: "#7C3AED", marginLeft: "2px", verticalAlign: "middle",
            animation: "blink 0.8s step-end infinite" }} />
        )}
        {isStreaming && message.content && (
          <span style={{ display: "inline-block", width: "2px", height: "14px",
            background: isUser ? "#EDE9FE" : "#7C3AED", marginLeft: "3px",
            verticalAlign: "middle", animation: "blink 0.8s step-end infinite" }} />
        )}
      </div>

      {/* 재생 버튼 */}
      {message.audioUrl && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px", marginTop: "5px",
          paddingLeft: isUser ? 0 : "4px",
          paddingRight: isUser ? "4px" : 0,
        }}>
          <PlayButton
            isPlaying={isPlaying}
            onClick={() => message.audioUrl && onPlay(message.id, message.audioUrl)}
          />
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
            {isPlaying ? "재생 중..." : "다시 듣기"}
          </span>
        </div>
      )}

      <span style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px" }}>
        {message.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
