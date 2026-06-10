import { useState, useEffect, useRef } from "react";

interface PlayerProps {
  initialVideoPath?: string;
}

export default function Player({ initialVideoPath }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPath, setVideoPath] = useState<string | undefined>(initialVideoPath);
  const [showHud, setShowHud] = useState(false);

  // Head tracking state (mutable refs for performance)
  const pitchRef = useRef(0);
  const yawRef = useRef(0);
  const smoothPitchRef = useRef(0);
  const smoothYawRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Get video from query param if not passed as prop
    if (!videoPath) {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("video");
      if (v) setVideoPath(v);
    }
  }, [videoPath]);

  useEffect(() => {
    if (!videoPath) return;
    const url = "file://" + encodeURI(videoPath);
    const v = videoRef.current;
    if (v) {
      v.src = url;
      v.play().catch(() => {});
    }
  }, [videoPath]);

  // IMU handling
  useEffect(() => {
    const unsub = window.electronAPI.xreal.onIMU((data) => {
      if (!data?.accelerometer) return;

      const a = data.accelerometer;

      // Calculate pitch/roll from accelerometer (gravity direction)
      // pitch = atan2(-ax, sqrt(ay^2 + az^2))
      // roll = atan2(ay, az)
      const pitch = Math.atan2(-a.x, Math.sqrt(a.y * a.y + a.z * a.z));
      const roll = Math.atan2(a.y, a.z);

      // We use pitch for vertical movement, roll for horizontal (since device orientation)
      // But typically for head tracking:
      // - Looking up/down = pitch
      // - Looking left/right = we don't have yaw from accel alone
      // So we use gyro Z for yaw (relative)
      const gyro = data.gyroscope;
      yawRef.current += gyro.z * 0.008; // simple integration with fixed dt

      pitchRef.current = pitch;

      // Smoothing
      const alpha = 0.08;
      smoothPitchRef.current += (pitchRef.current - smoothPitchRef.current) * alpha;
      smoothYawRef.current += (yawRef.current - smoothYawRef.current) * alpha;

      // Apply transform
      // Fixed mode: move video opposite to head rotation
      const moveScaleX = 40; // px per rad
      const moveScaleY = 30;
      const tx = -smoothYawRef.current * moveScaleX;
      const ty = -smoothPitchRef.current * moveScaleY;

      const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = videoRef.current;
        if (!el) return;
        el.style.transform = `translate(${clamp(tx, 80).toFixed(1)}px, ${clamp(ty, 60).toFixed(1)}px) scale(1.15)`;
      });
    });

    return () => {
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Mouse activity detection for HUD
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const onMove = () => {
      setShowHud(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowHud(false), 3000);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(timer);
    };
  }, []);

  // Player commands from control window
  useEffect(() => {
    const unsub = window.electronAPI.player.onCommand((cmd, val) => {
      const v = videoRef.current;
      if (!v) return;
      switch (cmd) {
        case "pause":
          v.paused ? v.play() : v.pause();
          break;
        case "seek":
          v.currentTime += val;
          break;
      }
    });
    return unsub;
  }, []);

  return (
    <div style={styles.container}>
      <video
        ref={videoRef}
        style={styles.video}
        muted
        loop
        playsInline
        onClick={() => {
          const v = videoRef.current;
          if (v) v.paused ? v.play() : v.pause();
        }}
      />

      {showHud && (
        <div style={styles.hud}>
          <div style={styles.hudRow}>
            <span style={styles.hudText}>XSPlay</span>
            <button style={styles.hudBtn} onClick={() => window.electronAPI.player.close()}>
              ✕ Close
            </button>
          </div>
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
    overflow: "hidden",
    cursor: "none",
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
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "auto",
  },
  hudRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  hudText: {
    fontSize: 14,
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
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
  },
};
