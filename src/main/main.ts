import { app, BrowserWindow, ipcMain, screen, dialog } from "electron";
import path from "path";
import { execSync } from "child_process";
import { XREALDevice, DisplayMode, IMUData } from "./xreal";

let mainWindow: BrowserWindow | null = null;
let xrealWindow: BrowserWindow | null = null;
let xrealDevice: XREALDevice | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  const isDev = process.argv.includes("--dev");
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createXREALWindow() {
  if (xrealWindow) {
    xrealWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  // Guess XREAL display by resolution (1920x1080 or 3840x1080 external)
  const xrealDisplay =
    displays.find(
      (d) =>
        d.bounds.width >= 1920 &&
        d.bounds.height === 1080 &&
        d.id !== screen.getPrimaryDisplay().id
    ) || displays.find((d) => d.bounds.width >= 1920 && d.bounds.height === 1080);

  const targetDisplay = xrealDisplay || screen.getPrimaryDisplay();

  xrealWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    kiosk: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.argv.includes("--dev");
  if (isDev) {
    xrealWindow.loadURL("http://localhost:5173#/player");
  } else {
    xrealWindow.loadFile(path.join(__dirname, "../renderer/index.html"), {
      hash: "player",
    });
  }

  xrealWindow.on("closed", () => {
    xrealWindow = null;
  });
}

function closeXREALWindow() {
  if (xrealWindow) {
    xrealWindow.close();
    xrealWindow = null;
  }
}

// XREAL IPC handlers
ipcMain.handle("xreal:connect", async () => {
  if (xrealDevice) return true;
  xrealDevice = new XREALDevice();
  if (!xrealDevice.connect()) {
    xrealDevice = null;
    return false;
  }

  xrealDevice.on("imu", (data: IMUData) => {
    mainWindow?.webContents.send("xreal:imu", data);
    xrealWindow?.webContents.send("xreal:imu", data);
  });

  return true;
});

ipcMain.handle("xreal:disconnect", async () => {
  if (xrealDevice) {
    xrealDevice.disconnect();
    xrealDevice = null;
  }
  return true;
});

ipcMain.handle("xreal:isConnected", async () => {
  return xrealDevice?.isConnected() ?? false;
});

ipcMain.handle("xreal:setDisplayMode", async (_event, mode: number) => {
  if (!xrealDevice) return false;
  return await xrealDevice.setDisplayMode(mode as DisplayMode);
});

ipcMain.handle("xreal:getDisplayMode", async () => {
  if (!xrealDevice) return null;
  return await xrealDevice.getDisplayMode();
});

ipcMain.handle("xreal:enableIMU", async (_event, enable: boolean) => {
  if (!xrealDevice) return false;
  return await xrealDevice.enableIMU(enable);
});

// Window IPC handlers
ipcMain.handle("window:openXREAL", () => {
  createXREALWindow();
});

ipcMain.handle("window:closeXREAL", () => {
  closeXREALWindow();
});

// Video probe
ipcMain.handle("video:probe", async (_event, videoPath: string) => {
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_streams "${videoPath}"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const data = JSON.parse(output);
    const videoStream = data.streams.find((s: any) => s.codec_type === "video");
    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      codec: videoStream?.codec_name || "unknown",
      duration: parseFloat(data.format?.duration || "0"),
      isSpatial: !!videoStream?.view_ids_available,
    };
  } catch (e) {
    return null;
  }
});

// Dialog IPC handlers
ipcMain.handle("dialog:openVideo", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "webm"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result.filePaths[0] || null;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (xrealDevice) {
    xrealDevice.disconnect();
    xrealDevice = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
