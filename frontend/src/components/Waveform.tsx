interface WaveformProps {
  bars: number[];
  active: boolean;
}

export function Waveform({ bars, active }: WaveformProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "44px" }}>
      {bars.map((v, i) => (
        <div
          key={i}
          style={{
            width: "3px",
            borderRadius: "2px",
            height: `${Math.max(4, v * 40)}px`,
            background: active ? "#7C3AED" : "#C4B5FD",
            transition: "height 60ms ease",
          }}
        />
      ))}
    </div>
  );
}
