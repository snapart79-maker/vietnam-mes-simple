import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync } from "node:fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname$1, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const isDev = !app.isPackaged;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("get-printers", async () => {
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault
    }));
  } catch (error) {
    console.error("프린터 목록 조회 오류:", error);
    return [];
  }
});
ipcMain.handle("print-pdf", async (_event, options) => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    const printOptions = {
      silent: options.silent ?? true,
      deviceName: options.printerName,
      copies: options.copies ?? 1
    };
    const success = await win.webContents.print(printOptions);
    return { success };
  } catch (error) {
    console.error("PDF 인쇄 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("print-to-pdf", async () => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: "output.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (!filePath) {
      return { success: false, error: "Cancelled" };
    }
    const data = await win.webContents.printToPDF({});
    writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error) {
    console.error("PDF 저장 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("print-label", async (_event, options) => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    if (options.zplData) {
      console.log("ZPL 라벨 인쇄 요청:", options.printerName);
      return { success: true, message: "ZPL 인쇄 대기중 (구현 예정)" };
    }
    if (options.pdfBase64) {
      const printOptions = {
        silent: true,
        deviceName: options.printerName,
        copies: 1
      };
      await win.webContents.print(printOptions);
      return { success: true };
    }
    return { success: false, error: "No print data provided" };
  } catch (error) {
    console.error("라벨 인쇄 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("save-file-dialog", async (_event, options) => {
  if (!win) return null;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: options.defaultPath,
    filters: options.filters
  });
  return result.filePath || null;
});
ipcMain.handle("open-file-dialog", async (_event, options) => {
  if (!win) return [];
  const result = await dialog.showOpenDialog(win, {
    filters: options.filters,
    properties: options.multiple ? ["openFile", "multiSelections"] : ["openFile"]
  });
  return result.filePaths;
});
ipcMain.handle("write-file", async (_event, options) => {
  try {
    writeFileSync(options.filePath, options.data);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const data = readFileSync(filePath);
    return { success: true, data: data.toString("base64") };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
