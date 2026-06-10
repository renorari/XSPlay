import { useState, useEffect, useRef } from "react";
import { useIMU, DEFAULT_IMU_CONFIG } from "../hooks/useIMU";

export default function Calibrate() {
  const {
    connected,
    imuRaw,
    euler,
    config,
    connect,
    disconnect,
    reset,
    updateConfig,
  } = useIMU();
  const [history, setHistory] = useState<{ yaw: number; pitch: number; roll: number }[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ yaw: number; pitch: number; roll: number }[]>([]);

  // Update preview block directly via DOM
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const tx = -euler.yaw * config.yawScale;
    const ty = -euler.pitch * config.pitchScale;
    const tr = -euler.roll * (180 / Math.PI) * (config.rollScale > 0 ? config.rollScale / 30 : 0);
    const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
    el.style.transform = `translate(${clamp(tx, 80).toFixed(1)}px, ${clamp(ty, 60).toFixed(1)}px) rotate(${tr.toFixed(1)}deg)`;
  }, [euler, config]);

  // Throttled history update
  useEffect(() => {
    const interval = setInterval(() => {
      historyRef.current = [...historyRef.current.slice(-100), { ...euler }];
      setHistory(historyRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [euler]);

  const saveConfig = () => {
    localStorage.setItem("xsplay:imuConfig", JSON.stringify(config));
  };

  const loadConfig = () => {
    const saved = localStorage.getItem("xsplay:imuConfig");
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        updateConfig({ [k]: v } as any);
      });
    }
  };

  const resetConfig = () => {
    Object.entries(DEFAULT_IMU_CONFIG).forEach(([k, v]) => {
      updateConfig({ [k]: v } as any);
    });
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>IMU Calibration</h1>

      <div style={styles.section}>
        <button style={connected ? styles.btn : styles.btnPrimary} onClick={connected ? disconnect : connect}>
          {connected ? "Disconnect" : "Connect XREAL"}
        </button>
        {connected && <span style={styles.status}>✅ Connected</span>}
      </div>

      {imuRaw && (
        <div style={styles.grid}>
          {/* Raw values */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Raw Gyro (rad/s)</h3>
            <div style={styles.valRow}>
              <span>X</span>
              <span style={styles.mono}>{imuRaw.gyroscope.x.toFixed(3)}</span>
            </div>
            <div style={styles.valRow}>
              <span>Y</span>
              <span style={styles.mono}>{imuRaw.gyroscope.y.toFixed(3)}</span>
            </div>
            <div style={styles.valRow}>
              <span>Z</span>
              <span style={styles.mono}>{imuRaw.gyroscope.z.toFixed(3)}</span>
            </div>
          </div>

          {/* Mapping controls */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Axis Mapping</h3>
            {["yaw", "pitch", "roll"].map((axis) => (
              <div key={axis} style={styles.mapRow}>
                <label style={styles.label}>{axis.toUpperCase()}</label>
                <select
                  style={styles.select}
                  value={config[`${axis}Source` as keyof typeof config] as string}
                  onChange={(e) => updateConfig({ [`${axis}Source`]: e.target.value } as any)}
                >
                  <option value="none">None</option>
                  <option value="x">Gyro X</option>
                  <option value="y">Gyro Y</option>
                  <option value="z">Gyro Z</option>
                </select>
                <select
                  style={styles.selectSmall}
                  value={config[`${axis}Sign` as keyof typeof config] as number}
                  onChange={(e) => updateConfig({ [`${axis}Sign`]: parseInt(e.target.value) } as any)}
                >
                  <option value={1}>+</option>
                  <option value={-1}>-</option>
                </select>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={1}
                  value={config[`${axis}Scale` as keyof typeof config] as number}
                  onChange={(e) => updateConfig({ [`${axis}Scale`]: parseInt(e.target.value) } as any)}
                  style={styles.slider}
                />
                <span style={styles.val}>{config[`${axis}Scale` as keyof typeof config] as number}</span>
              </div>
            ))}
          </div>

          {/* Deadzone */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Deadzone</h3>
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.005}
              value={config.deadzone}
              onChange={(e) => updateConfig({ deadzone: parseFloat(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.val}>{config.deadzone.toFixed(3)} rad/s</span>
          </div>

          {/* Preview */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Preview Transform</h3>
            <div style={styles.previewBox}>
              <div ref={previewRef} style={styles.previewBlock} />
            </div>
            <p style={styles.mono}>
              Y{(euler.yaw * (180 / Math.PI)).toFixed(1)}°{" "}
              P{(euler.pitch * (180 / Math.PI)).toFixed(1)}°{" "}
              R{(euler.roll * (180 / Math.PI)).toFixed(1)}°
            </p>
          </div>

          {/* History graph */}
          <div style={{ ...styles.section, gridColumn: "1 / -1" }}>
            <h3 style={styles.sectionTitle}>Euler Angle History</h3>
            <svg width="100%" height="120" viewBox={`0 0 ${Math.max(history.length, 1)} 120`} preserveAspectRatio="none">
              {history.length > 1 && ["yaw", "pitch", "roll"].map((axis, idx) => {
                const color = ["#0f0", "#0af", "#f0f"][idx];
                const points = history.map((h, i) => {
                  const v = h[axis as keyof typeof h] * (180 / Math.PI);
                  const y = 60 - Math.max(-60, Math.min(60, v));
                  return `${i},${y}`;
                }).join(" ");
                return <polyline key={axis} points={points} fill="none" stroke={color} strokeWidth="1" />;
              })}
            </svg>
            <div style={styles.legend}>
              <span style={{ color: "#0f0" }}>■ Yaw</span>
              <span style={{ color: "#0af" }}>■ Pitch</span>
              <span style={{ color: "#f0f" }}>■ Roll</span>
            </div>
          </div>
        </div>
      )}

      <div style={styles.row}>
        <button style={styles.btn} onClick={reset}>Reset</button>
        <button style={styles.btnPrimary} onClick={saveConfig}>Save Config</button>
        <button style={styles.btn} onClick={loadConfig}>Load Config</button>
        <button style={styles.btn} onClick={resetConfig}>Reset to Default</button>
        <button style={styles.btn} onClick={() => window.location.hash = ""}>Back</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    fontFamily: "system-ui, sans-serif",
    background: "#0a0a0a",
    color: "#fff",
    minHeight: "100vh",
  },
  title: {
    fontSize: 28,
    marginBottom: 16,
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  section: {
    background: "#161616",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#888",
    marginBottom: 10,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
  },
  btn: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    color: "#000",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  status: {
    marginLeft: 12,
    fontSize: 14,
  },
  row: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  valRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    borderBottom: "1px solid #222",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  mapRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  label: {
    width: 50,
    fontSize: 12,
    fontWeight: 700,
  },
  select: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px",
    fontSize: 12,
    width: 90,
  },
  selectSmall: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px",
    fontSize: 12,
    width: 50,
  },
  slider: {
    flex: 1,
    minWidth: 60,
  },
  val: {
    width: 40,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: 12,
  },
  previewBox: {
    width: "100%",
    height: 120,
    background: "#000",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  previewBlock: {
    width: 80,
    height: 60,
    background: "linear-gradient(135deg, #00d2ff, #3a7bd5)",
    borderRadius: 6,
    willChange: "transform",
  },
  legend: {
    display: "flex",
    gap: 16,
    fontSize: 12,
    marginTop: 8,
  },
};
