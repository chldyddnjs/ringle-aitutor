import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageBubble } from "../components/MessageBubble";
import type { ChatMessage } from "../types";

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "msg-1",
  role: "assistant",
  content: "Hello, how are you?",
  timestamp: new Date("2024-01-01T09:00:00"),
  ...overrides,
});

describe("MessageBubble", () => {
  it("renders assistant message content", () => {
    render(<MessageBubble message={makeMsg()} isPlaying={false} onPlay={() => {}} />);
    expect(screen.getByText("Hello, how are you?")).toBeTruthy();
  });

  it("renders user message on the right", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ role: "user", content: "Hi!" })} isPlaying={false} onPlay={() => {}} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.alignItems).toBe("flex-end");
  });

  it("renders assistant message on the left", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ role: "assistant" })} isPlaying={false} onPlay={() => {}} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.alignItems).toBe("flex-start");
  });

  it("shows play button when audioUrl is present", () => {
    render(
      <MessageBubble
        message={makeMsg({ audioUrl: "blob:http://localhost/test" })}
        isPlaying={false}
        onPlay={() => {}}
      />
    );
    expect(screen.getByTitle("재생")).toBeTruthy();
  });

  it("calls onPlay with message id and url when play button clicked", () => {
    const onPlay = vi.fn();
    const msg = makeMsg({ audioUrl: "blob:http://localhost/audio" });
    render(<MessageBubble message={msg} isPlaying={false} onPlay={onPlay} />);
    fireEvent.click(screen.getByTitle("재생"));
    expect(onPlay).toHaveBeenCalledWith("msg-1", "blob:http://localhost/audio");
  });

  it("shows 정지 title when isPlaying", () => {
    render(
      <MessageBubble
        message={makeMsg({ audioUrl: "blob:http://localhost/audio" })}
        isPlaying={true}
        onPlay={() => {}}
      />
    );
    expect(screen.getByTitle("정지")).toBeTruthy();
  });

  it("does not show play button when no audioUrl", () => {
    render(<MessageBubble message={makeMsg({ audioUrl: undefined })} isPlaying={false} onPlay={() => {}} />);
    expect(screen.queryByTitle("재생")).toBeNull();
  });

  it("shows streaming cursor when isStreaming and content is empty", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ content: "" })} isPlaying={false} onPlay={() => {}} isStreaming />
    );
    // 커서 span이 렌더됨
    const cursor = container.querySelector("span[style*='blink']");
    expect(cursor).toBeTruthy();
  });
});
