import { useState, useEffect, useRef } from "react";

export default function Main() {
  const [connected, setConnected] = useState(false);
  const [displayMode, setDisplayMode] = useState<number | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [imuData, setImuData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const imuUnsubRef = useRef<(() => void) | null>(null);

  const connect = async () => {
    const ok = await window.electronAPI.xreal.connect();
    setConnected(ok);
    if (ok) {
      const mode = await window.electronAPI.xreal.getDisplayMode();
      setDisplayMode(mode);
      await window.electronAPI.xreal.enableIMU(true);
      imuUnsubRef.current = window.electronAPI.xreal.onIMU((data) => {
        setImuData(data);
      });
    }
  };

  const disconnect = async () => {
    await window.electronAPI.xreal.disconnect();
    setConnected(false);
    setDisplayMode(null);
    if (imuUnsubRef.current) {
      imuUnsubRef.current();
      imuUnsubRef.current = null;
    }
  };

  const setSBSMode = async (mode: number) => {
    const ok = await window.electronAPI.xreal.setDisplayMode(mode);
    if (ok) {
      const current = await window.electronAPI.xreal.getDisplayMode();
      setDisplayMode(current);
    }
  };

  const selectVideo = async () => {
    const path = await window.electronAPI.dialog.openVideo();
    if (!path) return;
    setVideoPath(path);
    setLoading(true);
    const info = await window.electronAPI.video.probe(path);
    setVideoInfo(info);
    setLoading(false);

    // Auto-detect SBS and switch mode
    if (info && connected) {
      const isSBS = info.width === 3840 && info.height === 1080;
      if (isSBS) {
        await setSBSMode(0x03); // 3840x1080 60Hz SBS
      } else {
        await setSBSMode(0x01); // 2D 1920x1080 60Hz
      }
    }
  };

  const startPlayer = async () => {
    if (!videoPath) return;
    localStorage.setItem("xsplay:videoPath", videoPath);
    await window.electronAPI.window.openXREAL();
    window.location.hash = "player";
  };

  // Auto-play shortcut: if connected, video selected, and info loaded -> auto open XREAL window
  const autoPlay = async () => {
    if (!connected || !videoPath || !videoInfo) return;
    localStorage.setItem("xsplay:videoPath", videoPath);
    await window.electronAPI.window.openXREAL();
    window.location.hash = "player";
  };

  useEffect(() => {
    return () => {
      if (imuUnsubRef.current) {
        imuUnsubRef.current();
      }
    };
  }, []);

  const isSBS = videoInfo?.width === 3840 && videoInfo?.height === 1080;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>XSPlay</h1>
      <p style={styles.subtitle}>XREAL Air SBS Video Player</p>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>XREAL Glasses</h2>
        <div style={styles.row}>
          {connected ? (
            <button style={styles.btn} onClick={disconnect}>
              Disconnect
            </button>
          ) : (
            <button style={styles.btnPrimary} onClick={connect}>
              Connect
            </button>
          )}
          <span style={styles.status}>
            {connected ? "✅ Connected" : "❌ Disconnected"}
          </span>
        </div>

        {connected && (
          <>
            <div style={styles.row}>
              <span>Display Mode: {displayMode !== null ? `0x${displayMode.toString(16)}` : "-"}</span>
            </div>
            <div style={styles.row}>
              <button style={styles.btnSmall} onClick={() => setSBSMode(0x03)}>
                SBS 3840x1080 60Hz
              </button>
              <button style={styles.btnSmall} onClick={() => setSBSMode(0x04)}>
                SBS 3840x1080 72Hz
              </button>
              <button style={styles.btnSmall} onClick={() => setSBSMode(0x09)}>
                SBS 3840x1080 90Hz
              </button>
              <button style={styles.btnSmall} onClick={() => setSBSMode(0x01)}>
                2D 1920x1080 60Hz
              </button>
            </div>
          </>
        )}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Video</h2>
        <div style={styles.row}>
          <button style={styles.btn} onClick={selectVideo}>
            Select Video
          </button>
          <span style={styles.fileName}>
            {videoPath ? videoPath.split("/").pop() : "No file selected"}
          </span>
        </div>
        {loading && <p style={styles.hint}>Analyzing...</p>}
        {videoInfo && (
          <div style={styles.infoBox}>
            <p>{videoInfo.width}x{videoInfo.height} @ {videoInfo.codec}</p>
            <p>{isSBS ? "🟢 Detected as SBS" : "🔵 Standard 2D"}</p>
            {videoInfo.isSpatial && <p>📷 Spatial Video (MV-HEVC)</p>}
          </div>
        )}
        <div style={styles.row}>
          <button
            style={{
              ...styles.btnPrimary,
              opacity: connected && videoPath ? 1 : 0.5,
              cursor: connected && videoPath ? "pointer" : "not-allowed",
            }}
            onClick={startPlayer}
            disabled={!connected || !videoPath}
          >
            ▶ Play on XREAL
          </button>
          <button
            style={{
              ...styles.btnPrimary,
              opacity: connected && videoPath ? 1 : 0.5,
              cursor: connected && videoPath ? "pointer" : "not-allowed",
              background: "linear-gradient(90deg, #ff6b6b, #ee5a5a)",
            }}
            onClick={autoPlay}
            disabled={!connected || !videoPath}
          >
            ⚡ Auto Play
          </button>
        </div>
      </div>

      {connected && imuData && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>IMU Preview</h2>
          <pre style={styles.imuPre}>
            {JSON.stringify(
              {
                gyro: imuData.gyroscope,
                accel: imuData.accelerometer,
                temp: imuData.temperature,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 32,
    fontFamily: "system-ui, -apple-system, sans-serif",
    maxWidth: 640,
    margin: "0 auto",
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    marginBottom: 4,
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "#888",
    marginBottom: 24,
  },
  section: {
    background: "#111",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#666",
    marginBottom: 12,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    flexWrap: "wrap",
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
  btnSmall: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  status: {
    fontSize: 14,
  },
  fileName: {
    color: "#aaa",
    fontSize: 14,
  },
  hint: {
    color: "#666",
    fontSize: 12,
  },
  infoBox: {
    background: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
  },
  imuPre: {
    background: "#000",
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    overflow: "auto",
    maxHeight: 200,
  },
};
