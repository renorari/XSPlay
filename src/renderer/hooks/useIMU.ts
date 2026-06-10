import { useState, useEffect, useRef, useCallback } from "react";

export interface IMUConfig {
  yawSource: "x" | "y" | "z" | "none";
  pitchSource: "x" | "y" | "z" | "none";
  rollSource: "x" | "y" | "z" | "none";
  yawSign: 1 | -1;
  pitchSign: 1 | -1;
  rollSign: 1 | -1;
  yawScale: number;
  pitchScale: number;
  rollScale: number;
  deadzone: number;
  yawEnabled: boolean;
  pitchEnabled: boolean;
  rollEnabled: boolean;
}

export const DEFAULT_IMU_CONFIG: IMUConfig = {
  yawSource: "z",
  pitchSource: "x",
  rollSource: "y",
  yawSign: 1,
  pitchSign: -1,
  rollSign: 1,
  yawScale: 30,
  pitchScale: 30,
  rollScale: 0,
  deadzone: 0.02,
  yawEnabled: true,
  pitchEnabled: true,
  rollEnabled: false,
};

export function loadIMUConfig(): IMUConfig {
  try {
    const saved = localStorage.getItem("xsplay:imuConfig");
    if (saved) return { ...DEFAULT_IMU_CONFIG, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_IMU_CONFIG;
}

export interface EulerAngles {
  yaw: number;
  pitch: number;
  roll: number;
}

export function useIMU() {
  const [connected, setConnected] = useState(false);
  const [imuRaw, setImuRaw] = useState<any>(null);
  const [euler, setEuler] = useState<EulerAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const [transform, setTransform] = useState("");
  const [config, setConfig] = useState<IMUConfig>(loadIMUConfig);

  const eulerRef = useRef<EulerAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const lastTsRef = useRef<bigint | null>(null);
  const lastProcessedTsRef = useRef<bigint | null>(null);
  const imuUnsubRef = useRef<(() => void) | null>(null);

  const connect = useCallback(async () => {
    if (connected) return true;
    const ok = await window.electronAPI.xreal.connect();
    if (ok) {
      await window.electronAPI.xreal.enableIMU(true);
      imuUnsubRef.current = window.electronAPI.xreal.onIMU((data) => {
        setImuRaw(data);
        processIMU(data);
      });
      setConnected(true);
    }
    return ok;
  }, [connected]);

  const disconnect = useCallback(async () => {
    await window.electronAPI.xreal.disconnect();
    if (imuUnsubRef.current) {
      imuUnsubRef.current();
      imuUnsubRef.current = null;
    }
    setConnected(false);
  }, []);

  const reset = useCallback(() => {
    eulerRef.current = { yaw: 0, pitch: 0, roll: 0 };
    lastTsRef.current = null;
    lastProcessedTsRef.current = null;
    setEuler({ yaw: 0, pitch: 0, roll: 0 });
    setTransform("");
  }, []);

  const processIMU = useCallback((data: any) => {
    if (!data?.gyroscope || !data.timestamp) return;

    const ts = data.timestamp;
    if (lastProcessedTsRef.current !== null && ts === lastProcessedTsRef.current) return;
    lastProcessedTsRef.current = ts;

    const g = data.gyroscope;
    const cfg = config;

    if (lastTsRef.current !== null) {
      const dt = Number(ts - lastTsRef.current) / 1e9;
      if (dt > 0 && dt < 0.1) {
        const getVal = (source: string) => {
          if (source === "x") return g.x;
          if (source === "y") return g.y;
          if (source === "z") return g.z;
          return 0;
        };
        const dz = (v: number) => Math.abs(v) < cfg.deadzone ? 0 : v;

        const yawRate = cfg.yawEnabled ? dz(getVal(cfg.yawSource)) * cfg.yawSign : 0;
        const pitchRate = cfg.pitchEnabled ? dz(getVal(cfg.pitchSource)) * cfg.pitchSign : 0;
        const rollRate = cfg.rollEnabled ? dz(getVal(cfg.rollSource)) * cfg.rollSign : 0;

        eulerRef.current.yaw += yawRate * dt;
        eulerRef.current.pitch += pitchRate * dt;
        eulerRef.current.roll += rollRate * dt;
      }
    }
    lastTsRef.current = ts;

    const tx = -eulerRef.current.yaw * cfg.yawScale;
    const ty = -eulerRef.current.pitch * cfg.pitchScale;
    const tr = -eulerRef.current.roll * (180 / Math.PI) * (cfg.rollScale > 0 ? cfg.rollScale / 30 : 0);

    const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
    const ctx = clamp(tx, 120);
    const cty = clamp(ty, 90);

    setEuler({ ...eulerRef.current });
    setTransform(`translate(${ctx.toFixed(1)}px, ${cty.toFixed(1)}px) rotate(${tr.toFixed(1)}deg)`);
  }, [config]);

  const updateConfig = useCallback((patch: Partial<IMUConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...patch };
      localStorage.setItem("xsplay:imuConfig", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imuUnsubRef.current) imuUnsubRef.current();
    };
  }, []);

  return {
    connected,
    imuRaw,
    euler,
    transform,
    config,
    connect,
    disconnect,
    reset,
    updateConfig,
  };
}
