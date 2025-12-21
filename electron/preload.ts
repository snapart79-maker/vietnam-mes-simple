import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Printer API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // 프린터
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printPDF: (options: {
    printerName?: string
    silent?: boolean
    copies?: number
  }) => ipcRenderer.invoke('print-pdf', options),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  printLabel: (options: {
    printerName: string
    zplData?: string
    pdfBase64?: string
  }) => ipcRenderer.invoke('print-label', options),

  // 파일 시스템
  saveFileDialog: (options: {
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => ipcRenderer.invoke('save-file-dialog', options),
  openFileDialog: (options: {
    filters?: { name: string; extensions: string[] }[]
    multiple?: boolean
  }) => ipcRenderer.invoke('open-file-dialog', options),
  writeFile: (options: { filePath: string; data: string | Buffer }) =>
    ipcRenderer.invoke('write-file', options),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
})
