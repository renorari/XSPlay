import { useState, useEffect, useRef, useCallback } from "react";

interface EulerAngles {
  yaw: number;
  pitch: number;
  roll: number;
}

export default function Player() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [imuData, setImuData] = useState<any>(null);
  const [showHud, setShowHud] = useState(true);
  const [trackMode, setTrackMode] = useState<"fixed" | "smooth">("fixed");
  const [smoothing, setSmoothing] = useState(0.1);
  const [scale, setScale] = useState(1.2);
  const imuUnsubRef = useRef<(() => void) | null>(null);

  // Head tracking state
  const eulerRef = useRef<EulerAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const smoothedEulerRef = useRef<EulerAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const lastTsRef = useRef<bigint | null>(null);
  const transformRef = useRef<string>("");
  const [transform, setTransform] = useState("");

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

    imuUnsubRef.current = window.electronAPI.xreal.onIMU((data) => {
      setImuData(data);
      updateHeadTracking(data);
    });

    return () => {
      if (imuUnsubRef.current) {
        imuUnsubRef.current();
      }
    };
  }, []);

  const updateHeadTracking = useCallback((data: any) => {
    if (!data || !data.gyroscope || !data.timestamp) return;

    const gyro = data.gyroscope;
    const ts = data.timestamp;

    if (lastTsRef.current !== null) {
      const dt = Number(ts - lastTsRef.current) / 1e9; // nanoseconds to seconds
      if (dt > 0 && dt < 0.1) {
        // Integrate gyro to get relative rotation
        eulerRef.current.yaw += gyro.z * dt;
        eulerRef.current.pitch += gyro.x * dt;
        eulerRef.current.roll += gyro.y * dt;
      }
    }
    lastTsRef.current = ts;

    // Smoothing
    const alpha = smoothing;
    smoothedEulerRef.current.yaw += (eulerRef.current.yaw - smoothedEulerRef.current.yaw) * alpha;
    smoothedEulerRef.current.pitch += (eulerRef.current.pitch - smoothedEulerRef.current.pitch) * alpha;
    smoothedEulerRef.current.roll += (eulerRef.current.roll - smoothedEulerRef.current.roll) * alpha;

    // Calculate translation
    // Fixed mode: inverse rotation -> translate video to cancel head movement
    const tx = -smoothedEulerRef.current.yaw * 400; // scale factor
    const ty = -smoothedEulerRef.current.pitch * 300;
    const tr = -smoothedEulerRef.current.roll * (180 / Math.PI);

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const ctx = clamp(tx, -300, 300);
    const cty = clamp(ty, -200, 200);

    const t = `translate(${ctx}px, ${cty}px) rotate(${tr}deg) scale(${scale})`;
    transformRef.current = t;
    setTransform(t);
  }, [smoothing, scale]);

  const resetTracking = () => {
    eulerRef.current = { yaw: 0, pitch: 0, roll: 0 };
    smoothedEulerRef.current = { yaw: 0, pitch: 0, roll: 0 };
    lastTsRef.current = null;
    setTransform(`scale(${scale})`);
  };

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
          style={{
            ...styles.video,
            transform: transform || `scale(${scale})`,
            transition: trackMode === "smooth" ? "transform 0.05s linear" : "none",
          }}
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
              <span>Track Mode</span>
              <select
                style={styles.select}
                value={trackMode}
                onChange={(e) => setTrackMode(e.target.value as any)}
              >
                <option value="fixed">Fixed (inverse)</option>
                <option value="smooth">Smooth follow</option>
              </select>
            </div>
            <div style={styles.controlRow}>
              <span>Smoothing</span>
              <input
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={smoothing}
                onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.val}>{smoothing.toFixed(2)}</span>
            </div>
            <div style={styles.controlRow}>
              <span>Scale</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.val}>{scale.toFixed(2)}x</span>
            </div>
            <button style={styles.hudBtn} onClick={resetTracking}>
              ↺ Reset
            </button>
          </div>

          {imuData && (
            <div style={styles.imuPanel}>
              <div style={styles.imuRow}>
                <span>Gyro</span>
                <span>
                  {imuData.gyroscope.x.toFixed(1)} {" "}
                  {imuData.gyroscope.y.toFixed(1)} {" "}
                  {imuData.gyroscope.z.toFixed(1)}
                </span>
              </div>
              <div style={styles.imuRow}>
                <span>Euler</span>
                <span>
                  Y{(smoothedEulerRef.current.yaw * (180 / Math.PI)).toFixed(0)}°{" "}
                  P{(smoothedEulerRef.current.pitch * (180 / Math.PI)).toFixed(0)}°{" "}
                  R{(smoothedEulerRef.current.roll * (180 / Math.PI)).toFixed(0)}°
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
    maxWidth: 320,
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
  select: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 12,
  },
  slider: {
    flex: 1,
  },
  val: {
    width: 40,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
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
