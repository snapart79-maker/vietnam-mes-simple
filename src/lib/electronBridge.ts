/**
 * Electron Bridge
 *
 * Electron IPC API 래퍼
 * - 프린터 API
 * - 파일 시스템 API
 */

// ============================================
// Types
// ============================================

export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  status: number
  isDefault: boolean
}

export interface PrintOptions {
  printerName?: string
  silent?: boolean
  copies?: number
}

export interface LabelPrintOptions {
  printerName: string
  zplData?: string
  pdfBase64?: string
}

export interface SaveFileOptions {
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

export interface OpenFileOptions {
  filters?: { name: string; extensions: string[] }[]
  multiple?: boolean
}

export interface PrintResult {
  success: boolean
  error?: string
  message?: string
  filePath?: string
}

export interface FileResult {
  success: boolean
  error?: string
  data?: string
}

// ============================================
// Electron API Detection
// ============================================

declare global {
  interface Window {
    electronAPI?: {
      getPrinters: () => Promise<PrinterInfo[]>
      printPDF: (options: PrintOptions) => Promise<PrintResult>
      printToPDF: () => Promise<PrintResult>
      printLabel: (options: LabelPrintOptions) => Promise<PrintResult>
      saveFileDialog: (options: SaveFileOptions) => Promise<string | null>
      openFileDialog: (options: OpenFileOptions) => Promise<string[]>
      writeFile: (options: { filePath: string; data: string | Buffer }) => Promise<FileResult>
      readFile: (filePath: string) => Promise<FileResult>
    }
  }
}

/**
 * Electron 환경인지 확인
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}

// ============================================
// Printer API
// ============================================

/**
 * 시스템 프린터 목록 조회
 */
export async function getPrinters(): Promise<PrinterInfo[]> {
  if (!isElectron()) {
    console.warn('Electron API not available')
    return []
  }

  try {
    return await window.electronAPI!.getPrinters()
  } catch (error) {
    console.error('프린터 목록 조회 오류:', error)
    return []
  }
}

/**
 * 기본 프린터 조회
 */
export async function getDefaultPrinter(): Promise<PrinterInfo | null> {
  const printers = await getPrinters()
  return printers.find((p) => p.isDefault) || printers[0] || null
}

/**
 * PDF 인쇄
 */
export async function printPDF(options: PrintOptions = {}): Promise<PrintResult> {
  if (!isElectron()) {
    // 브라우저 환경에서는 window.print() 사용
    window.print()
    return { success: true }
  }

  try {
    return await window.electronAPI!.printPDF(options)
  } catch (error) {
    console.error('PDF 인쇄 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * PDF 파일로 저장
 */
export async function printToPDF(): Promise<PrintResult> {
  if (!isElectron()) {
    return { success: false, error: 'Electron API not available' }
  }

  try {
    return await window.electronAPI!.printToPDF()
  } catch (error) {
    console.error('PDF 저장 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 라벨 인쇄
 */
export async function printLabel(options: LabelPrintOptions): Promise<PrintResult> {
  if (!isElectron()) {
    return { success: false, error: 'Electron API not available' }
  }

  try {
    return await window.electronAPI!.printLabel(options)
  } catch (error) {
    console.error('라벨 인쇄 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 특정 프린터로 PDF 인쇄
 */
export async function printToPrinter(
  printerName: string,
  copies: number = 1
): Promise<PrintResult> {
  return printPDF({
    printerName,
    copies,
    silent: true,
  })
}

// ============================================
// File System API
// ============================================

/**
 * 파일 저장 다이얼로그
 */
export async function showSaveDialog(options: SaveFileOptions = {}): Promise<string | null> {
  if (!isElectron()) {
    return null
  }

  try {
    return await window.electronAPI!.saveFileDialog(options)
  } catch (error) {
    console.error('파일 저장 다이얼로그 오류:', error)
    return null
  }
}

/**
 * 파일 열기 다이얼로그
 */
export async function showOpenDialog(options: OpenFileOptions = {}): Promise<string[]> {
  if (!isElectron()) {
    return []
  }

  try {
    return await window.electronAPI!.openFileDialog(options)
  } catch (error) {
    console.error('파일 열기 다이얼로그 오류:', error)
    return []
  }
}

/**
 * 파일 쓰기
 */
export async function writeFile(filePath: string, data: string | Buffer): Promise<FileResult> {
  if (!isElectron()) {
    return { success: false, error: 'Electron API not available' }
  }

  try {
    return await window.electronAPI!.writeFile({ filePath, data })
  } catch (error) {
    console.error('파일 쓰기 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 파일 읽기
 */
export async function readFile(filePath: string): Promise<FileResult> {
  if (!isElectron()) {
    return { success: false, error: 'Electron API not available' }
  }

  try {
    return await window.electronAPI!.readFile(filePath)
  } catch (error) {
    console.error('파일 읽기 오류:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// Label Printing Utilities
// ============================================

/**
 * 라벨 데이터를 ZPL 형식으로 변환
 */
export function convertToZPL(data: {
  lotNumber: string
  productCode?: string
  productName?: string
  quantity: number
  date: string
}): string {
  // 기본 ZPL 템플릿
  const zpl = `
^XA
^FO50,50^A0N,30,30^FD${data.productCode || ''}^FS
^FO50,90^A0N,25,25^FD${data.productName || ''}^FS
^FO50,130^A0N,20,20^FDLOT: ${data.lotNumber}^FS
^FO50,160^A0N,20,20^FDQTY: ${data.quantity}^FS
^FO50,190^A0N,18,18^FD${data.date}^FS
^FO50,230^BY2^BCN,80,Y,N,N^FD${data.lotNumber}^FS
^XZ
`
  return zpl.trim()
}

/**
 * 라벨 프린터 찾기 (이름에 "Zebra", "Label" 포함)
 */
export async function findLabelPrinter(): Promise<PrinterInfo | null> {
  const printers = await getPrinters()
  const labelPrinter = printers.find(
    (p) =>
      p.name.toLowerCase().includes('zebra') ||
      p.name.toLowerCase().includes('label') ||
      p.name.toLowerCase().includes('tsc')
  )
  return labelPrinter || null
}

/**
 * 라벨 데이터로 직접 인쇄
 */
export async function printLabelData(data: {
  lotNumber: string
  productCode?: string
  productName?: string
  quantity: number
  date: string
}): Promise<PrintResult> {
  const labelPrinter = await findLabelPrinter()

  if (!labelPrinter) {
    // 라벨 프린터가 없으면 기본 프린터로
    const defaultPrinter = await getDefaultPrinter()
    if (!defaultPrinter) {
      return { success: false, error: '프린터를 찾을 수 없습니다' }
    }

    return printLabel({
      printerName: defaultPrinter.name,
    })
  }

  const zplData = convertToZPL(data)
  return printLabel({
    printerName: labelPrinter.name,
    zplData,
  })
}
