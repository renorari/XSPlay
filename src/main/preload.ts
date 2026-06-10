import { contextBridge, ipcRenderer } from "electron";

const api = {
  xreal: {
    connect: () => ipcRenderer.invoke("xreal:connect"),
    disconnect: () => ipcRenderer.invoke("xreal:disconnect"),
    isConnected: () => ipcRenderer.invoke("xreal:isConnected"),
    setDisplayMode: (mode: number) => ipcRenderer.invoke("xreal:setDisplayMode", mode),
    getDisplayMode: () => ipcRenderer.invoke("xreal:getDisplayMode"),
    enableIMU: (enable: boolean) => ipcRenderer.invoke("xreal:enableIMU", enable),
    onIMU: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("xreal:imu", handler);
      return () => ipcRenderer.off("xreal:imu", handler);
    },
  },
  player: {
    open: (videoPath: string) => ipcRenderer.invoke("player:open", videoPath),
    close: () => ipcRenderer.invoke("player:close"),
    control: (command: string, value?: any) => ipcRenderer.invoke("player:control", command, value),
    onCommand: (callback: (command: string, value: any) => void) => {
      const handler = (_event: any, cmd: string, val: any) => callback(cmd, val);
      ipcRenderer.on("player:command", handler);
      return () => ipcRenderer.off("player:command", handler);
    },
    onClosed: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("player:closed", handler);
      return () => ipcRenderer.off("player:closed", handler);
    },
  },
  dialog: {
    openVideo: () => ipcRenderer.invoke("dialog:openVideo"),
  },
  video: {
    probe: (path: string) => ipcRenderer.invoke("video:probe", path),
    convertSBS: (inputPath: string, outputPath: string) => ipcRenderer.invoke("video:convertSBS", inputPath, outputPath),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

declare global {
  interface Window {
    electronAPI: typeof api;
  }
}
