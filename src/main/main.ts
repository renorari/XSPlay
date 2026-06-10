import { app, BrowserWindow, ipcMain, screen, dialog } from "electron";
import path from "path";
import { execSync, spawn } from "child_process";
import { XREALDevice, DisplayMode } from "./xreal";

let mainWindow: BrowserWindow | null = null;
let xrealWindow: BrowserWindow | null = null;
let xrealDevice: XREALDevice | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: "XSPlay Control",
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
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (xrealWindow) {
      xrealWindow.close();
    }
  });
}

function createXREALWindow(videoPath?: string) {
  if (xrealWindow) {
    xrealWindow.close();
  }

  const displays = screen.getAllDisplays();
  const xrealDisplay =
    displays.find(
      (d) =>
        (d.bounds.width >= 1920 && d.bounds.height === 1080) &&
        d.id !== screen.getPrimaryDisplay().id
    ) || displays.find((d) => d.bounds.width >= 1920 && d.bounds.height === 1080);

  const target = xrealDisplay || screen.getPrimaryDisplay();

  xrealWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    kiosk: true,
    title: "XSPlay",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  const isDev = process.argv.includes("--dev");
  const url = isDev
    ? `http://localhost:5173?mode=player${videoPath ? "&video=" + encodeURIComponent(videoPath) : ""}`
    : undefined;

  if (url) {
    xrealWindow.loadURL(url);
  } else {
    xrealWindow.loadFile(path.join(__dirname, "../renderer/index.html"), {
      query: {
        mode: "player",
        video: videoPath || "",
      },
    });
  }

  xrealWindow.on("closed", () => {
    xrealWindow = null;
    mainWindow?.webContents.send("player:closed");
  });
}

// ===== IPC =====

ipcMain.handle("xreal:connect", async () => {
  if (xrealDevice) return true;
  xrealDevice = new XREALDevice();
  if (!xrealDevice.connect()) {
    xrealDevice = null;
    return false;
  }
  xrealDevice.on("imu", (data) => {
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

// Player window control
ipcMain.handle("player:open", async (_event, videoPath: string) => {
  createXREALWindow(videoPath);
});

ipcMain.handle("player:close", async () => {
  if (xrealWindow) {
    xrealWindow.close();
    xrealWindow = null;
  }
});

ipcMain.handle("player:control", async (_event, command: string, value?: any) => {
  xrealWindow?.webContents.send("player:command", command, value);
});

// Video file dialog
ipcMain.handle("dialog:openVideo", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "webm"] },
    ],
  });
  return result.filePaths[0] || null;
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
      isSBS: (videoStream?.width === 3840 && videoStream?.height === 1080) ||
             (videoStream?.width === 1920 && videoStream?.height === 1080),
      isSpatial: !!videoStream?.view_ids_available,
    };
  } catch (e) {
    return null;
  }
});

// Convert to full-SBS using spatial-split
ipcMain.handle("video:convertSBS", async (_event, inputPath: string, outputPath: string) => {
  return new Promise((resolve) => {
    const proc = spawn("spatial-split", [inputPath, "-s", outputPath, "--full-sbs", "--no-audio", "--crf", "23"], {
      stdio: "pipe",
    });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d; });
    proc.on("close", (code) => {
      resolve(code === 0);
    });
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 120000);
  });
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
