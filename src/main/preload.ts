import { contextBridge, ipcRenderer } from "electron";
import { IMUData } from "./xreal";

export interface ElectronAPI {
  xreal: {
    connect: () => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    isConnected: () => Promise<boolean>;
    setDisplayMode: (mode: number) => Promise<boolean>;
    getDisplayMode: () => Promise<number | null>;
    enableIMU: (enable: boolean) => Promise<boolean>;
    onIMU: (callback: (data: IMUData) => void) => () => void;
  };
  window: {
    openXREAL: () => Promise<void>;
    closeXREAL: () => Promise<void>;
  };
  video: {
    probe: (path: string) => Promise<any>;
  };
  dialog: {
    openVideo: () => Promise<string | null>;
  };
}

const api: ElectronAPI = {
  xreal: {
    connect: () => ipcRenderer.invoke("xreal:connect"),
    disconnect: () => ipcRenderer.invoke("xreal:disconnect"),
    isConnected: () => ipcRenderer.invoke("xreal:isConnected"),
    setDisplayMode: (mode: number) => ipcRenderer.invoke("xreal:setDisplayMode", mode),
    getDisplayMode: () => ipcRenderer.invoke("xreal:getDisplayMode"),
    enableIMU: (enable: boolean) => ipcRenderer.invoke("xreal:enableIMU", enable),
    onIMU: (callback: (data: IMUData) => void) => {
      const handler = (_event: any, data: IMUData) => callback(data);
      ipcRenderer.on("xreal:imu", handler);
      return () => ipcRenderer.off("xreal:imu", handler);
    },
  },
  window: {
    openXREAL: () => ipcRenderer.invoke("window:openXREAL"),
    closeXREAL: () => ipcRenderer.invoke("window:closeXREAL"),
  },
  video: {
    probe: (path: string) => ipcRenderer.invoke("video:probe", path),
  },
  dialog: {
    openVideo: () => ipcRenderer.invoke("dialog:openVideo"),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
