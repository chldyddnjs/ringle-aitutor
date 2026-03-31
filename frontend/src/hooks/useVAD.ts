import { useRef, useState, useCallback, useEffect } from "react";

export interface VADBlobResult {
  sttBlob: Blob;      // STT용: VAD로 무음 제거된 blob
  playBlob: Blob;     // 재생용: 전체 녹음 blob (seekable한 완전한 webm)
}

export interface VADState {
  isRecording: boolean;
  isSpeaking: boolean;
  waveformBars: number[];
  recordingSeconds: number;         // 오남용 방지용 녹음 경과 시간
  startRecording: () => Promise<void>;
  stopAndGetBlob: () => Promise<VADBlobResult | null>;
  cancelRecording: () => void;
}

/** RMS(Root Mean Square) 기반 음량 측정 */
function calcRMS(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

/**
 * useVAD — Voice Activity Detection Hook
 *
 * 요구사항:
 * 1. 마이크 버튼 누름 → MediaRecorder 시작 + AudioContext Analyser 연결
 * 2. 말하는 동안 Waveform 시각화 (20개 막대, 실시간 주파수 데이터)
 * 3. VAD: RMS 기반으로 무음 구간 감지 → 말소리 청크만 별도 저장
 * 4. 답변완료 버튼 → 녹음 중단 + 말소리 청크(무음 제거된)만 blob으로 반환
 * 5. 오남용 방지: MAX_RECORDING_SECONDS 초과 시 자동 중단
 */
export function useVAD(): VADState {
  const [isRecording,     setIsRecording]     = useState(false);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [waveformBars,    setWaveformBars]    = useState<number[]>(new Array(20).fill(0.04));
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recorderRef      = useRef<MediaRecorder | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const animFrameRef     = useRef<number | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VAD: 말소리가 감지된 청크만 저장
  const speechChunksRef  = useRef<Blob[]>([]);
  // VAD fallback: 말소리가 전혀 없을 경우 전체 오디오 사용
  const allChunksRef     = useRef<Blob[]>([]);
  // webm 컨테이너 헤더가 담긴 첫 번째 청크 (항상 Blob 앞에 포함해야 함)
  const headerChunkRef   = useRef<Blob | null>(null);
  const isSpeakingRef    = useRef(false);
  const mimeTypeRef      = useRef("audio/webm");

  // 오남용 방지: 최대 녹음 시간 (60초)
  const MAX_RECORDING_SECONDS = 60;
  const SILENCE_THRESHOLD     = 0.015;
  const BAR_COUNT             = 20;

  /** 모든 리소스 정리 */
  const cleanup = useCallback(() => {
    if (animFrameRef.current)  cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current)      clearInterval(timerRef.current);
    if (maxTimerRef.current)   clearTimeout(maxTimerRef.current);
    if (audioCtxRef.current)   { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (streamRef.current)     { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }

    animFrameRef.current  = null;
    timerRef.current      = null;
    maxTimerRef.current   = null;
    recorderRef.current   = null;  // ← 마이크 재사용을 위해 반드시 초기화

    setIsRecording(false);
    setIsSpeaking(false);
    setWaveformBars(new Array(BAR_COUNT).fill(0.04));
    setRecordingSeconds(0);
    isSpeakingRef.current = false;
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => () => { cleanup(); }, [cleanup]);

  const startRecording = useCallback(async () => {
    // 이미 녹음 중이면 무시
    if (recorderRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;

    // AudioContext + Analyser 설정
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    mimeTypeRef.current     = mimeType;
    allChunksRef.current    = [];
    speechChunksRef.current = [];
    headerChunkRef.current  = null;

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    // 100ms 단위 청크 수집
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size === 0) return;
      allChunksRef.current.push(e.data);

      // 첫 번째 청크는 webm 컨테이너 헤더를 포함하므로 항상 보존
      if (headerChunkRef.current === null) {
        headerChunkRef.current = e.data;
      }

      // VAD: 현재 말하고 있는 순간의 청크만 별도 저장
      if (isSpeakingRef.current) {
        speechChunksRef.current.push(e.data);
      }
    };

    recorder.start(100);
    setIsRecording(true);

    // ── 경과 시간 카운터 (오남용 방지 UI 표시용) ──────────────────────────
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1);
    }, 1000);

    // ── 오남용 방지: MAX_RECORDING_SECONDS 후 자동 중단 ───────────────────
    maxTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
        cleanup();
      }
    }, MAX_RECORDING_SECONDS * 1000);

    // ── Waveform + VAD 분석 루프 ──────────────────────────────────────────
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Waveform: 주파수 도메인 데이터로 막대 높이 계산
      const step = Math.floor(freqData.length / BAR_COUNT);
      const bars = Array.from(
        { length: BAR_COUNT },
        (_, i) => Math.max(freqData[i * step] / 255, 0.04)
      );
      setWaveformBars(bars);

      // VAD: 시간 도메인 데이터의 RMS로 음성 감지
      const rms      = calcRMS(timeData);
      const speaking = rms > SILENCE_THRESHOLD;
      isSpeakingRef.current = speaking;
      setIsSpeaking(speaking);

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [cleanup]);

  /**
   * 답변완료 버튼에서 호출.
   * 녹음을 중단하고 VAD로 공백이 제거된 Blob을 반환합니다.
   *
   * - 말소리 청크(speechChunks)가 있으면 그것만 사용 → 무음 구간 제거
   * - 말소리 청크가 없으면 전체 오디오 사용 (fallback)
   * - 아무 데이터도 없으면 null 반환
   */
  const stopAndGetBlob = useCallback((): Promise<VADBlobResult | null> => {
    return new Promise(resolve => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const allChunks = allChunksRef.current;
        const vadChunks = speechChunksRef.current;
        const header    = headerChunkRef.current;

        if (allChunks.length === 0) { cleanup(); resolve(null); return; }

        // 재생용: 전체 녹음 blob (완전한 webm — seekable하여 Audio로 재생 가능)
        const playBlob = new Blob(allChunks, { type: mimeTypeRef.current });

        // STT용: VAD로 무음 제거된 blob. 말소리 청크가 없으면 전체를 fallback
        let sttChunks: Blob[];
        if (vadChunks.length > 0 && header) {
          const firstIsSame = vadChunks[0] === header;
          sttChunks = firstIsSame ? vadChunks : [header, ...vadChunks];
        } else {
          sttChunks = allChunks;
        }
        const sttBlob = new Blob(sttChunks, { type: mimeTypeRef.current });

        cleanup();
        resolve({ sttBlob, playBlob });
      };
      recorder.stop();
    });
  }, [cleanup]);

  /**
   * 녹음 취소 (데이터 버림)
   */
  const cancelRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null; // onstop 콜백 제거해서 resolve 방지
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isSpeaking,
    waveformBars,
    recordingSeconds,
    startRecording,
    stopAndGetBlob,
    cancelRecording,
  };
}