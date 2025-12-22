import { contextBridge as r, ipcRenderer as n } from "electron";
r.exposeInMainWorld("ipcRenderer", {
  on(...e) {
    const [i, o] = e;
    return n.on(i, (t, ...l) => o(t, ...l));
  },
  off(...e) {
    const [i, ...o] = e;
    return n.off(i, ...o);
  },
  send(...e) {
    const [i, ...o] = e;
    return n.send(i, ...o);
  },
  invoke(...e) {
    const [i, ...o] = e;
    return n.invoke(i, ...o);
  }
});
r.exposeInMainWorld("electronAPI", {
  // 프린터
  getPrinters: () => n.invoke("get-printers"),
  printPDF: (e) => n.invoke("print-pdf", e),
  printToPDF: () => n.invoke("print-to-pdf"),
  printLabel: (e) => n.invoke("print-label", e),
  // 파일 시스템
  saveFileDialog: (e) => n.invoke("save-file-dialog", e),
  openFileDialog: (e) => n.invoke("open-file-dialog", e),
  writeFile: (e) => n.invoke("write-file", e),
  readFile: (e) => n.invoke("read-file", e)
});
