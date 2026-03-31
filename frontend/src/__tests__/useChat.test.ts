import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChat } from "../hooks/useChat";
import * as client from "../api/client";

vi.mock("../api/client");

// URL.createObjectURL is not available in jsdom — stub it
vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
});

const AUDIO_BLOB      = new Blob(["audio"], { type: "audio/webm" });
const PLAY_BLOB       = new Blob(["play"],  { type: "audio/webm" });
const FAKE_AUDIO_BLOB = new Blob(["tts"],   { type: "audio/mpeg" });

function stubStream(chunks: string[] = ["Hello!"]) {
  vi.mocked(client.streamChat).mockImplementation((_msgs, onChunk, onDone) => {
    setTimeout(() => { chunks.forEach(c => onChunk(c)); onDone(); }, 0);
    return () => {};
  });
}

function stubStreamError(msg: string) {
  vi.mocked(client.streamChat).mockImplementation((_msgs, _chunk, _done, onError) => {
    setTimeout(() => onError(msg), 0);
    return () => {};
  });
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.synthesizeSpeech).mockResolvedValue(FAKE_AUDIO_BLOB);
  });

  // ── 초기 상태 ──────────────────────────────────────────────────

  it("starts with empty messages, no loading, no error", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── clearMessages ──────────────────────────────────────────────

  it("clearMessages resets messages and error to initial state", async () => {
    stubStream();
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    act(() => result.current.clearMessages());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  // ── sendMessage ────────────────────────────────────────────────

  it("sendMessage adds user message then assistant message in order", async () => {
    stubStream(["Hello!"]);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    const [user, assistant] = result.current.messages;
    expect(user.role).toBe("user");
    expect(user.content).toBe("Hi");
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).toBe("Hello!");
  });

  it("accumulates streamed chunks into assistant content", async () => {
    stubStream(["Hel", "lo", " world"]);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    expect(result.current.messages[1].content).toBe("Hello world");
  });

  it("includes the new user message in the history sent to API", async () => {
    stubStream();
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("First");
      await new Promise(r => setTimeout(r, 50));
    });

    let capturedMessages: { role: string; content: string }[] = [];
    vi.mocked(client.streamChat).mockImplementation((msgs, _chunk, onDone) => {
      capturedMessages = msgs as { role: string; content: string }[];
      setTimeout(onDone, 0);
      return () => {};
    });
    await act(async () => {
      result.current.sendMessage("Second");
      await new Promise(r => setTimeout(r, 50));
    });

    const contents = capturedMessages.map(m => m.content);
    expect(contents).toContain("First");
    expect(contents).toContain("Second");
  });

  it("ignores sendMessage when already loading", async () => {
    let resolveDone: () => void;
    vi.mocked(client.streamChat).mockImplementation((_msgs, _chunk, onDone) => {
      resolveDone = onDone;
      return () => {};
    });
    const { result } = renderHook(() => useChat());
    act(() => { result.current.sendMessage("First"); });
    act(() => { result.current.sendMessage("Second"); });
    await act(async () => { resolveDone!(); await new Promise(r => setTimeout(r, 10)); });
    const userMsgs = result.current.messages.filter(m => m.role === "user");
    expect(userMsgs).toHaveLength(1);
    expect(userMsgs[0].content).toBe("First");
  });

  it("does not send blank message", async () => {
    const { result } = renderHook(() => useChat());
    await act(async () => { result.current.sendMessage("   "); });
    expect(client.streamChat).not.toHaveBeenCalled();
  });

  it("sets error and removes empty placeholder when stream fails", async () => {
    stubStreamError("Network error");
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    expect(result.current.error).toBe("Network error");
    expect(result.current.isLoading).toBe(false);
    const emptyAssistant = result.current.messages.find(
      m => m.role === "assistant" && m.content === ""
    );
    expect(emptyAssistant).toBeUndefined();
  });

  it("attaches audioUrl to assistant message after TTS succeeds", async () => {
    stubStream(["Hi!"]);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hello");
      await new Promise(r => setTimeout(r, 50));
    });
    const assistant = result.current.messages.find(m => m.role === "assistant");
    expect(assistant?.audioUrl).toBe("blob:mock-url");
  });

  it("still shows assistant text even when TTS fails", async () => {
    stubStream(["Hi!"]);
    vi.mocked(client.synthesizeSpeech).mockRejectedValue(new Error("TTS error"));
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hello");
      await new Promise(r => setTimeout(r, 50));
    });
    const assistant = result.current.messages.find(m => m.role === "assistant");
    expect(assistant?.content).toBe("Hi!");
    expect(assistant?.audioUrl).toBeUndefined();
  });

  // ── dismissError ───────────────────────────────────────────────

  it("dismissError clears the error state", async () => {
    stubStreamError("Some error");
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  // ── sendAudio ──────────────────────────────────────────────────

  it("sendAudio transcribes sttBlob and sends resulting text", async () => {
    vi.mocked(client.transcribeAudio).mockResolvedValue("transcribed text");
    stubStream();
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB);
      await new Promise(r => setTimeout(r, 100));
    });
    expect(client.transcribeAudio).toHaveBeenCalledWith(AUDIO_BLOB);
    expect(result.current.messages[0]?.content).toBe("transcribed text");
  });

  it("sendAudio attaches playBlob URL (not sttBlob) to user message", async () => {
    vi.mocked(client.transcribeAudio).mockResolvedValue("hello");
    stubStream();
    const mockCreate = vi.fn()
      .mockReturnValueOnce("blob:play-url")
      .mockReturnValueOnce("blob:tts-url");
    vi.stubGlobal("URL", { createObjectURL: mockCreate, revokeObjectURL: vi.fn() });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB);
      await new Promise(r => setTimeout(r, 100));
    });
    const userMsg = result.current.messages.find(m => m.role === "user");
    expect(userMsg?.audioUrl).toBe("blob:play-url");
  });

  it("sets error when transcription returns empty or whitespace", async () => {
    vi.mocked(client.transcribeAudio).mockResolvedValue("   ");
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB);
      await new Promise(r => setTimeout(r, 50));
    });
    expect(result.current.error).toMatch(/인식되지 않았습니다/);
    expect(result.current.messages).toHaveLength(0);
  });

  it("sets error when transcribeAudio throws", async () => {
    vi.mocked(client.transcribeAudio).mockRejectedValue({ error: "STT service unavailable" });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB);
      await new Promise(r => setTimeout(r, 50));
    });
    expect(result.current.error).toBe("STT service unavailable");
  });

  it("ignores sendAudio when already loading", async () => {
    let resolveSTT: (v: string) => void;
    vi.mocked(client.transcribeAudio).mockReturnValue(
      new Promise(res => { resolveSTT = res; })
    );
    const { result } = renderHook(() => useChat());
    act(() => { result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB); });
    expect(result.current.isLoading).toBe(true);
    act(() => { result.current.sendAudio(AUDIO_BLOB, PLAY_BLOB); });
    await act(async () => { resolveSTT!("text"); await new Promise(r => setTimeout(r, 10)); });
    expect(client.transcribeAudio).toHaveBeenCalledTimes(1);
  });

  // ── triggerAiGreeting ──────────────────────────────────────────

  it("triggerAiGreeting adds only an assistant message (no user message)", async () => {
    stubStream(["Hello! Let's talk."]);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.triggerAiGreeting();
      await new Promise(r => setTimeout(r, 50));
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });

  it("triggerAiGreeting is ignored when messages already exist", async () => {
    stubStream();
    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.sendMessage("Hi");
      await new Promise(r => setTimeout(r, 50));
    });
    vi.clearAllMocks();
    await act(async () => {
      result.current.triggerAiGreeting();
      await new Promise(r => setTimeout(r, 50));
    });
    expect(client.streamChat).not.toHaveBeenCalled();
  });
});