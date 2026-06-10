import { useState, useEffect, useRef } from "react";

interface PlayerProps {
  initialVideoPath?: string;
}

export default function Player({ initialVideoPath }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPath, setVideoPath] = useState<string | undefined>(initialVideoPath);
  const [showHud, setShowHud] = useState(false);

  useEffect(() => {
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
