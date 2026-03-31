import { useState, useCallback, useRef } from "react";
import { streamChat, synthesizeSpeech, transcribeAudio } from "../api/client";
import type { ChatMessage } from "../types";

/**
 * useChat
 *
 * 채팅 세션 상태를 관리합니다.
 * - sendMessage: 텍스트 전송 → SSE 스트리밍 → TTS 자동 재생
 * - sendAudio: blob → STT(Whisper) → sendMessage
 * - triggerAiGreeting: 유저 메시지 없이 AI 첫 인사만 요청 (히스토리에 트리거 메시지 남기지 않음)
 */
export function useChat() {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const abortRef     = useRef<(() => void) | null>(null);
  const messagesRef  = useRef<ChatMessage[]>([]);

  // messages와 ref를 동기화 (streamChat 콜백 내 클로저 stale 방지)
  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages(prev => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  /** AI 응답 스트리밍 공통 로직 */
  const streamAiResponse = useCallback((
    historyForApi: { role: string; content: string }[]
  ): Promise<void> => {
    return new Promise((resolve) => {
      // AI placeholder 추가
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "assistant",
        content: "", timestamp: new Date(),
      };
      updateMessages(prev => [...prev, assistantMsg]);
      setIsLoading(true);
      setError(null);

      let fullText = "";

      const abort = streamChat(
        historyForApi,
        // onChunk: 스트리밍 토큰 누적
        (chunk) => {
          fullText += chunk;
          updateMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: fullText };
            return next;
          });
        },
        // onDone: TTS 요청 후 자동재생
        async () => {
          setIsLoading(false);
          if (!fullText) { resolve(); return; }

          try {
            const audioBlob = await synthesizeSpeech(fullText);
            const audioUrl  = URL.createObjectURL(audioBlob);
            updateMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], audioUrl };
              return next;
            });
            // AI 응답 자동 재생
            new Audio(audioUrl).play().catch(() => {});
          } catch {
            // TTS 실패는 조용히 무시 — 텍스트는 이미 표시됨
          }
          resolve();
        },
        // onError
        (err) => {
          setIsLoading(false);
          setError(err);
          // 빈 placeholder 제거
          updateMessages(prev => {
            const last = prev[prev.length - 1];
            return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
          });
          resolve();
        },
      );
      abortRef.current = abort;
    });
  }, [updateMessages]);

  /**
   * AI 첫 인사 트리거
   * - 유저 메시지를 대화 목록에 추가하지 않음
   * - API에는 시스템 프롬프트로만 전달 (히스토리 없음)
   */
  const triggerAiGreeting = useCallback(async () => {
    if (isLoading || messagesRef.current.length > 0) return;
    await streamAiResponse([
      { role: "user", content: "(Start the conversation now.)" }
    ]);
  }, [isLoading, streamAiResponse]);

  /**
   * 유저 텍스트 메시지 전송
   * @param userText 전송할 텍스트
   * @param userAudioUrl 재생 버튼용 원본 오디오 URL (STT로 생성된 경우)
   */
  const sendMessage = useCallback(async (userText: string, userAudioUrl?: string) => {
    if (!userText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user",
      content: userText.trim(), audioUrl: userAudioUrl, timestamp: new Date(),
    };

    // 유저 메시지를 먼저 추가
    updateMessages(prev => [...prev, userMsg]);

    // API용 히스토리 구성: setState는 비동기이므로 messagesRef 대신
    // 현재 ref + userMsg를 직접 합쳐서 사용 (stale 방지)
    const history = [...messagesRef.current, userMsg].map(m => ({
      role: m.role, content: m.content,
    }));

    await streamAiResponse(history);
  }, [isLoading, updateMessages, streamAiResponse]);

  /**
   * 음성 blob → Whisper STT → sendMessage
   * VAD로 공백이 제거된 blob을 받아 처리합니다.
   */
  const sendAudio = useCallback(async (
    sttBlob: Blob,
    playBlob: Blob,
  ): Promise<void> => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    let text: string;
    try {
      text = await transcribeAudio(sttBlob);
    } catch (e: unknown) {
      setIsLoading(false);
      setError((e as { error?: string })?.error ?? "음성 인식에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    if (!text.trim()) {
      setIsLoading(false);
      setError("음성이 인식되지 않았습니다. 마이크에 더 가까이 말씀해 주세요.");
      return;
    }

    setIsLoading(false);

    // 재생용으로는 완전한 webm인 playBlob 사용 → 깨짐 없이 재생 가능
    const audioUrl = URL.createObjectURL(playBlob);
    await sendMessage(text, audioUrl);
  }, [isLoading, sendMessage]);

  const cancelStream = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    error,
    triggerAiGreeting,
    sendMessage,
    sendAudio,
    cancelStream,
    clearMessages,
    dismissError,
  };
}