import { useState, useEffect, useRef } from "react";
import { useIMU } from "../hooks/useIMU";

export default function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [showHud, setShowHud] = useState(true);
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

  useEffect(() => {
    const path = localStorage.getItem("xsplay:videoPath");
    if (path) {
      setVideoPath(path);
      const url = "file://" + encodeURI(path);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.play().catch(() => {});
      }
    }
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Auto-hide HUD
  const [mouseActive, setMouseActive] = useState(true);
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onMouseMove = () => {
      setMouseActive(true);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => setMouseActive(false), 3000);
    };
    window.addEventListener("mousemove", onMouseMove);
    onMouseMove();
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const exitPlayer = () => {
    window.location.hash = "";
    window.electronAPI.window.closeXREAL();
  };

  return (
    <div style={styles.container} onDoubleClick={togglePlay}>
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          style={styles.video}
          muted
          loop
          playsInline
          onClick={togglePlay}
        />
      </div>

      {showHud && mouseActive && (
        <div style={styles.hud}>
          <div style={styles.hudTop}>
            <button style={styles.hudBtn} onClick={exitPlayer}>
              ✕ Close
            </button>
            <span style={styles.hudText}>XSPlay</span>
            <button style={styles.hudBtn} onClick={() => setShowHud(false)}>
              Hide HUD
            </button>
          </div>

          <div style={styles.controlPanel}>
            <div style={styles.controlRow}>
              <span>Yaw</span>
              <select
                style={styles.selectSmall}
                value={config.yawSource}
                onChange={(e) => updateConfig({ yawSource: e.target.value as any })}
              >
                <option value="none">None</option>
                <option value="x">Gyro X</option>
                <option value="y">Gyro Y</option>
                <option value="z">Gyro Z</option>
              </select>
              <select
                style={styles.selectSmall}
                value={config.yawSign}
                onChange={(e) => updateConfig({ yawSign: parseInt(e.target.value) as 1 | -1 })}
              >
                <option value={1}>+</option>
                <option value={-1}>-</option>
              </select>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={config.yawScale}
                onChange={(e) => updateConfig({ yawScale: parseInt(e.target.value) })}
                style={styles.slider}
              />
              <span style={styles.val}>{config.yawScale}</span>
            </div>
            <div style={styles.controlRow}>
              <span>Pitch</span>
              <select
                style={styles.selectSmall}
                value={config.pitchSource}
                onChange={(e) => updateConfig({ pitchSource: e.target.value as any })}
              >
                <option value="none">None</option>
                <option value="x">Gyro X</option>
                <option value="y">Gyro Y</option>
                <option value="z">Gyro Z</option>
              </select>
              <select
                style={styles.selectSmall}
                value={config.pitchSign}
                onChange={(e) => updateConfig({ pitchSign: parseInt(e.target.value) as 1 | -1 })}
              >
                <option value={1}>+</option>
                <option value={-1}>-</option>
              </select>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={config.pitchScale}
                onChange={(e) => updateConfig({ pitchScale: parseInt(e.target.value) })}
                style={styles.slider}
              />
              <span style={styles.val}>{config.pitchScale}</span>
            </div>
            <div style={styles.controlRow}>
              <span>Roll</span>
              <select
                style={styles.selectSmall}
                value={config.rollSource}
                onChange={(e) => updateConfig({ rollSource: e.target.value as any })}
              >
                <option value="none">None</option>
                <option value="x">Gyro X</option>
                <option value="y">Gyro Y</option>
                <option value="z">Gyro Z</option>
              </select>
              <select
                style={styles.selectSmall}
                value={config.rollSign}
                onChange={(e) => updateConfig({ rollSign: parseInt(e.target.value) as 1 | -1 })}
              >
                <option value={1}>+</option>
                <option value={-1}>-</option>
              </select>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={config.rollScale}
                onChange={(e) => updateConfig({ rollScale: parseInt(e.target.value) })}
                style={styles.slider}
              />
              <span style={styles.val}>{config.rollScale}</span>
            </div>
            <div style={styles.controlRow}>
              <span>Deadzone</span>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.005}
                value={config.deadzone}
                onChange={(e) => updateConfig({ deadzone: parseFloat(e.target.value) })}
                style={styles.slider}
              />
              <span style={styles.val}>{config.deadzone.toFixed(3)}</span>
            </div>
            <div style={styles.row}>
              <button style={styles.hudBtn} onClick={reset}>↺ Reset</button>
              <button style={styles.hudBtn} onClick={() => window.location.hash = "calibrate"}>🔧 Full Calibrate</button>
            </div>
          </div>

          {imuRaw && (
            <div style={styles.imuPanel}>
              <div style={styles.imuRow}>
                <span>Gyro</span>
                <span>
                  {imuRaw.gyroscope.x.toFixed(1)}{" "}
                  {imuRaw.gyroscope.y.toFixed(1)}{" "}
                  {imuRaw.gyroscope.z.toFixed(1)}
                </span>
              </div>
              <div style={styles.imuRow}>
                <span>Euler</span>
                <span>
                  Y{(euler.yaw * (180 / Math.PI)).toFixed(0)}°{" "}
                  P{(euler.pitch * (180 / Math.PI)).toFixed(0)}°{" "}
                  R{(euler.roll * (180 / Math.PI)).toFixed(0)}°
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {!showHud && mouseActive && (
        <div style={styles.hudHint}>
          <button style={styles.hudBtn} onClick={() => setShowHud(true)}>
            Show HUD
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    background: "#000",
    position: "relative",
    overflow: "hidden",
    cursor: "default",
  },
  videoWrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    willChange: "transform",
    transform: "scale(1.15)",
  },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 20,
  },
  hudTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "auto",
  },
  hudText: {
    fontSize: 14,
    fontWeight: 700,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  hudBtn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    pointerEvents: "auto",
  },
  controlPanel: {
    background: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    color: "#fff",
    maxWidth: 420,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  row: {
    display: "flex",
    gap: 8,
    pointerEvents: "auto",
  },
  selectSmall: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px",
    fontSize: 12,
    width: 70,
  },
  slider: {
    flex: 1,
    minWidth: 60,
  },
  val: {
    width: 36,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: 12,
  },
  imuPanel: {
    background: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#0f0",
    maxWidth: 320,
    pointerEvents: "auto",
  },
  imuRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  hudHint: {
    position: "absolute",
    top: 20,
    right: 20,
  },
};
