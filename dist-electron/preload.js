import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  }
});
contextBridge.exposeInMainWorld("electronAPI", {
  // 프린터
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printPDF: (options) => ipcRenderer.invoke("print-pdf", options),
  printToPDF: () => ipcRenderer.invoke("print-to-pdf"),
  printLabel: (options) => ipcRenderer.invoke("print-label", options),
  // 파일 시스템
  saveFileDialog: (options) => ipcRenderer.invoke("save-file-dialog", options),
  openFileDialog: (options) => ipcRenderer.invoke("open-file-dialog", options),
  writeFile: (options) => ipcRenderer.invoke("write-file", options),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath)
});
