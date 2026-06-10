import { useState, useEffect, useRef } from "react";
import { DEFAULT_IMU_CONFIG, loadIMUConfig } from "../hooks/useIMU";

export default function Calibrate() {
  const [connected, setConnected] = useState(false);
  const [imuRaw, setImuRaw] = useState<any>(null);
  const [config, setConfig] = useState(loadIMUConfig);
  const [euler, setEuler] = useState({ yaw: 0, pitch: 0, roll: 0 });

  const eulerRef = useRef({ yaw: 0, pitch: 0, roll: 0 });
  const lastTsRef = useRef<bigint | null>(null);
  const imuUnsubRef = useRef<(() => void) | null>(null);
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = async () => {
    const ok = await window.electronAPI.xreal.connect();
    setConnected(ok);
    if (ok) {
      await window.electronAPI.xreal.enableIMU(true);
      imuUnsubRef.current = window.electronAPI.xreal.onIMU((data) => {
        processIMU(data);
      });
    }
  };

  const disconnect = async () => {
    await window.electronAPI.xreal.disconnect();
    setConnected(false);
    imuUnsubRef.current?.();
  };

  const processIMU = (data: any) => {
    if (!data?.gyroscope || !data.timestamp) return;

    const ts = data.timestamp;
    const g = data.gyroscope;

    if (lastTsRef.current !== null) {
      const dt = Number(ts - lastTsRef.current) / 1e9;
      if (dt > 0 && dt < 0.1) {
        const dz = (v: number) => Math.abs(v) < config.deadzone ? 0 : v;
        eulerRef.current.yaw += dz(g.z) * dt * config.yawSign;
        eulerRef.current.pitch += dz(g.x) * dt * config.pitchSign;
        eulerRef.current.roll += dz(g.y) * dt * config.rollSign;
      }
    }
    lastTsRef.current = ts;

    if (displayTimerRef.current) return;
    displayTimerRef.current = setTimeout(() => {
      displayTimerRef.current = null;
      setImuRaw(data);
      setEuler({ ...eulerRef.current });
    }, 100);
  };

  const reset = () => {
    eulerRef.current = { yaw: 0, pitch: 0, roll: 0 };
    lastTsRef.current = null;
    setEuler({ yaw: 0, pitch: 0, roll: 0 });
  };

  const save = () => {
    localStorage.setItem("xsplay:imuConfig", JSON.stringify(config));
  };

  useEffect(() => {
    return () => {
      imuUnsubRef.current?.();
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    };
  }, []);

  const update = (patch: Partial<typeof config>) => {
    setConfig((c) => ({ ...c, ...patch }));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>IMU Calibration</h1>

      <div style={styles.card}>
        <button style={connected ? styles.btnRed : styles.btnPrimary} onClick={connected ? disconnect : connect}>
          {connected ? "Disconnect" : "Connect XREAL"}
        </button>
      </div>

      {imuRaw && (
        <>
          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Raw Gyro</h3>
              <p style={styles.mono}>X: {imuRaw.gyroscope.x.toFixed(3)}</p>
              <p style={styles.mono}>Y: {imuRaw.gyroscope.y.toFixed(3)}</p>
              <p style={styles.mono}>Z: {imuRaw.gyroscope.z.toFixed(3)}</p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Settings</h3>
              {["yaw", "pitch", "roll"].map((axis) => (
                <div key={axis} style={styles.row}>
                  <span style={styles.label}>{axis}</span>
                  <select
                    style={styles.select}
                    value={config[`${axis}Source` as keyof typeof config] as string}
                    onChange={(e) => update({ [`${axis}Source`]: e.target.value } as any)}
                  >
                    <option value="none">None</option>
                    <option value="x">Gyro X</option>
                    <option value="y">Gyro Y</option>
                    <option value="z">Gyro Z</option>
                  </select>
                  <select
                    style={styles.selectSmall}
                    value={config[`${axis}Sign` as keyof typeof config] as number}
                    onChange={(e) => update({ [`${axis}Sign`]: parseInt(e.target.value) } as any)}
                  >
                    <option value={1}>+</option>
                    <option value={-1}>-</option>
                  </select>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={config[`${axis}Scale` as keyof typeof config] as number}
                    onChange={(e) => update({ [`${axis}Scale`]: parseInt(e.target.value) } as any)}
                    style={styles.slider}
                  />
                  <span style={styles.val}>{config[`${axis}Scale` as keyof typeof config] as number}</span>
                </div>
              ))}
              <div style={styles.row}>
                <span style={styles.label}>Deadzone</span>
                <input
                  type="range"
                  min={0}
                  max={0.2}
                  step={0.005}
                  value={config.deadzone}
                  onChange={(e) => update({ deadzone: parseFloat(e.target.value) })}
                  style={styles.slider}
                />
                <span style={styles.val}>{config.deadzone.toFixed(3)}</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Euler Angles</h3>
              <p style={styles.mono}>Yaw: {(euler.yaw * (180 / Math.PI)).toFixed(1)}°</p>
              <p style={styles.mono}>Pitch: {(euler.pitch * (180 / Math.PI)).toFixed(1)}°</p>
              <p style={styles.mono}>Roll: {(euler.roll * (180 / Math.PI)).toFixed(1)}°</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={styles.btn} onClick={reset}>Reset</button>
            <button style={styles.btnPrimary} onClick={save}>Save</button>
            <button style={styles.btn} onClick={() => {
              setConfig(DEFAULT_IMU_CONFIG);
              localStorage.removeItem("xsplay:imuConfig");
            }}>Default</button>
            <button style={styles.btn} onClick={() => window.location.href = "/"}>Back</button>
          </div>
        </>
      )}
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
    maxWidth: 600,
    margin: "0 auto",
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  card: {
    background: "#161616",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#666",
    marginBottom: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  label: {
    width: 50,
    fontSize: 11,
  },
  select: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "3px",
    fontSize: 11,
    width: 70,
  },
  selectSmall: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "3px",
    fontSize: 11,
    width: 40,
  },
  slider: {
    flex: 1,
  },
  val: {
    width: 32,
    textAlign: "right",
    fontSize: 11,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 12,
    margin: "2px 0",
  },
  btn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  btnPrimary: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "linear-gradient(90deg, #00d2ff, #3a7bd5)",
    color: "#000",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  btnRed: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#c44",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
};
