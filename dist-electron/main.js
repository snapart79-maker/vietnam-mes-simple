import { app as a, BrowserWindow as u, ipcMain as n, dialog as o } from "electron";
import i from "node:path";
import { fileURLToPath as p } from "node:url";
import { writeFileSync as d, readFileSync as h } from "node:fs";
const c = i.dirname(p(import.meta.url));
process.env.DIST = i.join(c, "../dist");
process.env.VITE_PUBLIC = a.isPackaged ? process.env.DIST : i.join(c, "../public");
let r;
const l = process.env.VITE_DEV_SERVER_URL, w = !a.isPackaged;
function f() {
  r = new u({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: i.join(c, "preload.js")
    }
  }), r.webContents.on("did-finish-load", () => {
    r?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), l ? r.loadURL(l) : w ? r.loadURL("http://localhost:5173") : r.loadFile(i.join(process.env.DIST, "index.html"));
}
a.on("window-all-closed", () => {
  process.platform !== "darwin" && a.quit();
});
a.on("activate", () => {
  u.getAllWindows().length === 0 && f();
});
a.whenReady().then(f);
n.handle("get-printers", async () => {
  if (!r) return [];
  try {
    return (await r.webContents.getPrintersAsync()).map((e) => ({
      name: e.name,
      displayName: e.displayName,
      description: e.description,
      status: e.status,
      isDefault: e.isDefault
    }));
  } catch (s) {
    return console.error("프린터 목록 조회 오류:", s), [];
  }
});
n.handle("print-pdf", async (s, e) => {
  if (!r) return { success: !1, error: "Window not found" };
  try {
    const t = {
      silent: e.silent ?? !0,
      deviceName: e.printerName,
      copies: e.copies ?? 1
    };
    return { success: await r.webContents.print(t) };
  } catch (t) {
    return console.error("PDF 인쇄 오류:", t), { success: !1, error: String(t) };
  }
});
n.handle("print-to-pdf", async () => {
  if (!r) return { success: !1, error: "Window not found" };
  try {
    const { filePath: s } = await o.showSaveDialog(r, {
      defaultPath: "output.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (!s)
      return { success: !1, error: "Cancelled" };
    const e = await r.webContents.printToPDF({});
    return d(s, e), { success: !0, filePath: s };
  } catch (s) {
    return console.error("PDF 저장 오류:", s), { success: !1, error: String(s) };
  }
});
n.handle("print-label", async (s, e) => {
  if (!r) return { success: !1, error: "Window not found" };
  try {
    if (e.zplData)
      return console.log("ZPL 라벨 인쇄 요청:", e.printerName), { success: !0, message: "ZPL 인쇄 대기중 (구현 예정)" };
    if (e.pdfBase64) {
      const t = {
        silent: !0,
        deviceName: e.printerName,
        copies: 1
      };
      return await r.webContents.print(t), { success: !0 };
    }
    return { success: !1, error: "No print data provided" };
  } catch (t) {
    return console.error("라벨 인쇄 오류:", t), { success: !1, error: String(t) };
  }
});
n.handle("save-file-dialog", async (s, e) => r && (await o.showSaveDialog(r, {
  defaultPath: e.defaultPath,
  filters: e.filters
})).filePath || null);
n.handle("open-file-dialog", async (s, e) => r ? (await o.showOpenDialog(r, {
  filters: e.filters,
  properties: e.multiple ? ["openFile", "multiSelections"] : ["openFile"]
})).filePaths : []);
n.handle("write-file", async (s, e) => {
  try {
    return d(e.filePath, e.data), { success: !0 };
  } catch (t) {
    return { success: !1, error: String(t) };
  }
});
n.handle("read-file", async (s, e) => {
  try {
    return { success: !0, data: h(e).toString("base64") };
  } catch (t) {
    return { success: !1, error: String(t) };
  }
});
