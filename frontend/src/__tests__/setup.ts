// Vitest 전용 setup 파일 (빌드에서 제외됨 — tsconfig.json exclude 참고)
import "@testing-library/jest-dom";

// MediaRecorder mock
class MockMediaRecorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start(_timeslice?: number) { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
  static isTypeSupported(_mime: string) { return true; }
}

// AudioContext mock
class MockAudioContext {
  createAnalyser() {
    return {
      fftSize: 512,
      frequencyBinCount: 256,
      getByteFrequencyData: (_arr: Uint8Array) => {},
      getByteTimeDomainData: (_arr: Uint8Array) => {},
      connect: () => {},
    };
  }
  createMediaStreamSource(_stream: unknown) { return { connect: () => {} }; }
  close() {}
}

// @ts-expect-error mock
globalThis.MediaRecorder = MockMediaRecorder;
// @ts-expect-error mock
globalThis.AudioContext = MockAudioContext;

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: () => {} }],
    }),
  },
});
