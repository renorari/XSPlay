import { useState, useEffect, useRef, useCallback } from "react";

export default function Control() {
  const [connected, setConnected] = useState(false);
  const [displayMode, setDisplayMode] = useState<number | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imuData, setImuData] = useState<any>(null);
  const [status, setStatus] = useState("Ready");
  const imuUnsubRef = useRef<(() => void) | null>(null);
  const playerClosedUnsubRef = useRef<(() => void) | null>(null);

  const connect = async () => {
    setStatus("Connecting...");
    const ok = await window.electronAPI.xreal.connect();
    setConnected(ok);
    if (ok) {
      const mode = await window.electronAPI.xreal.getDisplayMode();
      setDisplayMode(mode);
      await window.electronAPI.xreal.enableIMU(true);
      imuUnsubRef.current = window.electronAPI.xreal.onIMU((data) => setImuData(data));
      setStatus("Connected");
    } else {
      setStatus("Connection failed");
    }
  };

  const disconnect = async () => {
    await window.electronAPI.xreal.disconnect();
    setConnected(false);
    setDisplayMode(null);
    imuUnsubRef.current?.();
    imuUnsubRef.current = null;
    setStatus("Disconnected");
  };

  const selectVideo = async () => {
    const path = await window.electronAPI.dialog.openVideo();
    if (!path) return;
    setVideoPath(path);
    setStatus("Analyzing...");
    const info = await window.electronAPI.video.probe(path);
    setVideoInfo(info);

    if (info && connected) {
      const isFullSBS = info.width === 3840 && info.height === 1080;
      if (isFullSBS) {
        await window.electronAPI.xreal.setDisplayMode(0x03);
        setStatus("SBS 3840x1080 set");
      } else if (info.isSpatial) {
        setStatus("Spatial video detected - convert to SBS first");
      } else {
        await window.electronAPI.xreal.setDisplayMode(0x01);
        setStatus("2D 1920x1080 set");
      }
    }
  };

  const play = async () => {
    if (!videoPath || !connected) return;
    await window.electronAPI.player.open(videoPath);
    setIsPlaying(true);
    setStatus("Playing on XREAL");
  };

  const stop = async () => {
    await window.electronAPI.player.close();
    setIsPlaying(false);
    setStatus("Stopped");
  };

  const sendCommand = (cmd: string, val?: any) => {
    window.electronAPI.player.control(cmd, val);
  };

  useEffect(() => {
    playerClosedUnsubRef.current = window.electronAPI.player.onClosed(() => {
      setIsPlaying(false);
      setStatus("Player closed");
    });
    return () => {
      imuUnsubRef.current?.();
      playerClosedUnsubRef.current?.();
    };
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>XSPlay</h1>

      {/* Status */}
      <div style={styles.statusBar}>{status}</div>

      {/* XREAL Section */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>XREAL Glasses</h2>
        <button
          style={connected ? styles.btnRed : styles.btnPrimary}
          onClick={connected ? disconnect : connect}
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
        {connected && displayMode !== null && (
          <span style={styles.badge}>Mode: 0x{displayMode.toString(16)}</span>
        )}
      </div>

      {/* Video Section */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Video</h2>
        <button style={styles.btn} onClick={selectVideo}>
          📁 Select Video
        </button>
        {videoPath && (
          <p style={styles.fileName}>{videoPath.split("/").pop()}</p>
        )}
        {videoInfo && (
          <p style={styles.info}>
            {videoInfo.width}×{videoInfo.height} | {videoInfo.codec}
            {videoInfo.width === 3840 ? " | Full SBS ✅" : ""}
            {videoInfo.isSpatial ? " | Spatial Video" : ""}
          </p>
        )}
        <div style={styles.row}>
          <button
            style={styles.btnPrimary}
            onClick={play}
            disabled={!connected || !videoPath}
          >
            ▶ Play
          </button>
          <button
            style={styles.btn}
            onClick={stop}
            disabled={!isPlaying}
          >
            ⏹ Stop
          </button>
        </div>
        {isPlaying && (
          <div style={styles.row}>
            <button style={styles.btnSmall} onClick={() => sendCommand("pause")}>⏯</button>
            <button style={styles.btnSmall} onClick={() => sendCommand("seek", -10)}>⏪ 10s</button>
            <button style={styles.btnSmall} onClick={() => sendCommand("seek", 10)}>⏩ 10s</button>
          </div>
        )}
      </div>

      {/* IMU Preview */}
      {connected && imuData && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>IMU</h2>
          <pre style={styles.pre}>
Gyro:  {imuData.gyroscope.x.toFixed(2)} {imuData.gyroscope.y.toFixed(2)} {imuData.gyroscope.z.toFixed(2)}
Accel: {imuData.accelerometer.x.toFixed(2)} {imuData.accelerometer.y.toFixed(2)} {imuData.accelerometer.z.toFixed(2)}
Temp:  {imuData.temperature.toFixed(1)}°C
          </pre>
        </div>
      )}

      <button
        style={styles.linkBtn}
        onClick={() => window.location.href = "?mode=calibrate"}
      >
        🔧 Open IMU Calibrator
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    fontFamily: "system-ui, sans-serif",
    background: "#0a0a0a",
    color: "#fff",
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 12,
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  statusBar: {
    background: "#161616",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 12,
    fontSize: 13,
    color: "#888",
  },
  card: {
    background: "#161616",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#666",
    marginBottom: 12,
  },
  row: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  btn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  btnPrimary: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    color: "#000",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  btnRed: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#c44",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  btnSmall: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  badge: {
    marginLeft: 10,
    fontSize: 12,
    color: "#0f0",
  },
  fileName: {
    marginTop: 8,
    fontSize: 13,
    color: "#aaa",
    wordBreak: "break-all",
  },
  info: {
    marginTop: 6,
    fontSize: 12,
    color: "#888",
  },
  pre: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#0f0",
    margin: 0,
  },
  linkBtn: {
    marginTop: 12,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #333",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
    width: "100%",
  },
};
