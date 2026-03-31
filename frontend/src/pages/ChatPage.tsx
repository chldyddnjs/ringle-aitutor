import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useVAD } from "../hooks/useVAD";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { fetchActiveMembership } from "../api/client";
import { MessageBubble } from "../components/MessageBubble";
import { Waveform } from "../components/Waveform";

type PageState = "checking" | "no_membership" | "ready" | "error";

const MAX_RECORDING_SECONDS = 60;

export function ChatPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [micError,  setMicError]  = useState<string | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const greetedRef  = useRef(false);

  const {
    messages, isLoading, error,
    triggerAiGreeting, sendMessage, sendAudio,
    dismissError,
  } = useChat();

  const { playingId, play } = useAudioPlayer();

  const vad = useVAD();

  // ── 1. 멤버십 체크 ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActiveMembership()
      .then(res => {
        const ok = res.active && res.membership?.plan.features.includes("conversation");
        setPageState(ok ? "ready" : "no_membership");
      })
      .catch(() => setPageState("error"));
  }, []);

  // ── 2. AI가 먼저 대화 시작 ─────────────────────────────────────────────────
  // triggerAiGreeting은 유저 메시지를 대화 목록에 남기지 않음
  useEffect(() => {
    if (pageState !== "ready" || greetedRef.current) return;
    greetedRef.current = true;
    triggerAiGreeting();
  }, [pageState, triggerAiGreeting]);

  // ── 3. 메시지 추가될 때 자동 스크롤 ───────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── 4. 마이크 버튼 ────────────────────────────────────────────────────────
  const handleMicClick = useCallback(async () => {
    if (isLoading || vad.isRecording) return;
    setMicError(null);
    dismissError();
    try {
      await vad.startRecording();
    } catch {
      setMicError("마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.");
    }
  }, [isLoading, vad, dismissError]);

  // ── 5. 답변완료 버튼 ──────────────────────────────────────────────────────
  // VAD가 무음 구간을 제거한 blob을 받아 STT → AI 응답 순서로 처리
  const handleSubmit = useCallback(async () => {
    if (!vad.isRecording || isLoading) return;
    setMicError(null);

    const result = await vad.stopAndGetBlob();
    if (!result) {
      setMicError("녹음된 음성이 없습니다. 마이크 버튼을 누른 뒤 말씀해 주세요.");
      return;
    }
    await sendAudio(result.sttBlob, result.playBlob);
  }, [vad, isLoading, sendAudio]);

  // ── 6. 취소 ───────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    vad.cancelRecording();
    setMicError(null);
  }, [vad]);

  // ── 7. 오남용 방지: 최대 녹음 시간 초과 경고 ──────────────────────────────
  const isNearLimit  = vad.isRecording && vad.recordingSeconds >= MAX_RECORDING_SECONDS - 10;
  const isAtLimit    = vad.isRecording && vad.recordingSeconds >= MAX_RECORDING_SECONDS;

  // ── 렌더링 분기 ──────────────────────────────────────────────────────────
  if (pageState === "checking") {
    return (
      <Center>
        <Spinner />
        <p style={{ color: "#9CA3AF", marginTop: "12px", fontSize: "14px" }}>멤버십 확인 중...</p>
      </Center>
    );
  }

  if (pageState === "no_membership") {
    return (
      <Center>
        <div style={{
          background: "#fff", borderRadius: "20px", padding: "40px 36px",
          textAlign: "center", border: "1px solid #E5E7EB", maxWidth: "380px",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontWeight: 700, marginBottom: "8px", color: "#1F1735", fontSize: "18px" }}>
            대화 기능이 없습니다
          </h2>
          <p style={{ color: "#6B7280", marginBottom: "24px", fontSize: "14px", lineHeight: "1.6" }}>
            AI 대화를 이용하려면<br />대화 기능이 포함된 멤버십이 필요합니다.
          </p>
          <button onClick={() => navigate("/")} style={primaryBtn}>멤버십 구매하기</button>
        </div>
      </Center>
    );
  }

  if (pageState === "error") {
    return (
      <Center>
        <p style={{ color: "#DC2626", marginBottom: "16px", fontSize: "14px" }}>
          멤버십 정보를 불러오지 못했습니다.
        </p>
        <button onClick={() => navigate("/")} style={primaryBtn}>홈으로 돌아가기</button>
      </Center>
    );
  }

  // ── 메인 채팅 화면 ────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#FAFAF9" }}>

      {/* 헤더 */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "0 20px", height: "56px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => navigate("/")}
          aria-label="뒤로 가기"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", padding: "4px 8px" }}
        >
          ←
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🤖</span>
          <span style={{ fontWeight: 600, color: "#1F1735", fontSize: "15px" }}>Alex (AI Tutor)</span>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: isLoading ? "#F59E0B" : "#10B981",
            display: "inline-block", transition: "background 0.3s",
          }} />
        </div>
        <div style={{ width: "44px" }} />
      </header>

      {/* 메시지 목록 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>

        {/* 첫 로딩 스피너 (AI 인사 생성 중) */}
        {messages.length === 0 && isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "16px" }}>
            <div style={{
              background: "#F5F3FF", borderRadius: "20px 20px 20px 4px",
              padding: "12px 18px", display: "flex", gap: "5px", alignItems: "center",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: "7px", height: "7px", borderRadius: "50%", background: "#7C3AED",
                  animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isPlaying={playingId === msg.id}
            onPlay={play}
            isStreaming={isLoading && idx === messages.length - 1 && msg.role === "assistant"}
          />
        ))}

        {/* 에러 표시 */}
        {(error || micError) && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px",
            padding: "10px 14px", color: "#DC2626", fontSize: "13px", margin: "8px 0",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          }}>
            <span>⚠️ {micError || error}</span>
            <button
              onClick={() => { setMicError(null); dismissError(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: "16px", padding: "0 2px" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 하단 입력 영역 */}
      <div style={{
        background: "#fff", borderTop: "1px solid #E5E7EB",
        padding: "12px 16px 28px", flexShrink: 0,
      }}>

        {/* ── 녹음 중 UI ─────────────────────────────────────────────────── */}
        {vad.isRecording ? (
          <>
            {/* 오남용 방지: 최대 시간 임박 경고 */}
            {isNearLimit && (
              <div style={{
                fontSize: "12px", color: isAtLimit ? "#DC2626" : "#F59E0B",
                textAlign: "center", marginBottom: "8px", fontWeight: 500,
              }}>
                {isAtLimit
                  ? "최대 녹음 시간에 도달했습니다."
                  : `녹음 시간이 ${MAX_RECORDING_SECONDS - vad.recordingSeconds}초 남았습니다.`
                }
              </div>
            )}

            {/* Waveform + 상태 */}
            <div style={{
              background: "#F5F3FF", borderRadius: "14px",
              padding: "10px 16px", marginBottom: "10px",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <Waveform bars={vad.waveformBars} active={vad.isSpeaking} />
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "13px", color: "#7C3AED", fontWeight: 600 }}>
                  {vad.isSpeaking ? "말하는 중..." : "듣고 있어요"}
                </div>
                <div style={{ fontSize: "11px", color: "#A78BFA", marginTop: "2px" }}>
                  {vad.recordingSeconds}s / {MAX_RECORDING_SECONDS}s
                </div>
              </div>
            </div>

            {/* 답변완료 + 취소 */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                style={{
                  flex: 1, padding: "14px",
                  background: isLoading ? "#E5E7EB" : "#7C3AED",
                  color: isLoading ? "#9CA3AF" : "#fff",
                  border: "none", borderRadius: "14px",
                  fontWeight: 700, fontSize: "16px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "background 0.15s",
                }}
              >
                {isLoading ? (
                  <><Spinner size={16} color="#9CA3AF" /> 처리 중...</>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    답변완료
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: "14px 20px",
                  background: "#F5F3FF", color: "#7C3AED",
                  border: "1.5px solid #DDD6FE",
                  borderRadius: "14px", fontWeight: 600, fontSize: "15px",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          </>
        ) : (
          /* ── 기본 UI: 마이크 버튼 ──────────────────────────────────────── */
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              flex: 1, background: "#F9FAFB",
              border: "1.5px solid #E5E7EB", borderRadius: "14px",
              padding: "14px 16px", color: "#9CA3AF", fontSize: "14px",
              userSelect: "none",
            }}>
              {isLoading
                ? <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Spinner size={14} color="#C4B5FD" /> Alex가 답변 중입니다...
                  </span>
                : "마이크 버튼을 눌러 말씀해 주세요"
              }
            </div>

            {/* 마이크 버튼 */}
            <button
              onClick={handleMicClick}
              disabled={isLoading}
              aria-label="마이크 시작"
              title={isLoading ? "AI 답변 중..." : "마이크 시작"}
              style={{
                width: "56px", height: "56px", borderRadius: "50%",
                border: "none",
                background: isLoading ? "#F3F4F6" : "#EDE9FE",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3"
                  fill={isLoading ? "#D1D5DB" : "#7C3AED"} />
                <path d="M5 10a7 7 0 0014 0"
                  stroke={isLoading ? "#D1D5DB" : "#7C3AED"}
                  strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21"
                  stroke={isLoading ? "#D1D5DB" : "#7C3AED"}
                  strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21"
                  stroke={isLoading ? "#D1D5DB" : "#7C3AED"}
                  strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────────────────────
function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", background: "#FAFAF9", padding: "24px",
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 20, color = "#7C3AED" }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 28px", background: "#7C3AED", color: "#fff",
  border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "15px", cursor: "pointer",
};