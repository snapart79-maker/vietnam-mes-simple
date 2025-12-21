/**
 * App Settings Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

export interface BusinessRules {
  allowNegativeStock: boolean
  enableSafetyStockWarning: boolean
  bomStrictMode: boolean
  enforceFifo: boolean
}

export interface PrinterSettings {
  labelPrinter: string
  reportPrinter: string
}

export interface LabelSettings {
  autoPrint: boolean
  copies: number
  xOffset: number
  yOffset: number
}

// Mock 설정 데이터
let mockBusinessRules: BusinessRules = {
  allowNegativeStock: false,
  enableSafetyStockWarning: true,
  bomStrictMode: false,
  enforceFifo: true,
}

let mockPrinterSettings: PrinterSettings = {
  labelPrinter: '',
  reportPrinter: '',
}

let mockLabelSettings: LabelSettings = {
  autoPrint: false,
  copies: 1,
  xOffset: 0,
  yOffset: 0,
}

/**
 * 비즈니스 규칙 조회
 */
export async function getBusinessRules(): Promise<BusinessRules> {
  await new Promise((r) => setTimeout(r, 100))
  return { ...mockBusinessRules }
}

/**
 * 비즈니스 규칙 저장
 */
export async function saveBusinessRules(rules: BusinessRules): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  mockBusinessRules = { ...rules }
}

/**
 * 프린터 설정 조회
 */
export async function getPrinterSettings(): Promise<PrinterSettings> {
  await new Promise((r) => setTimeout(r, 100))
  return { ...mockPrinterSettings }
}

/**
 * 프린터 설정 저장
 */
export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  mockPrinterSettings = { ...settings }
}

/**
 * 라벨 설정 조회
 */
export async function getLabelSettings(): Promise<LabelSettings> {
  await new Promise((r) => setTimeout(r, 100))
  return { ...mockLabelSettings }
}

/**
 * 라벨 설정 저장
 */
export async function saveLabelSettings(settings: LabelSettings): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  mockLabelSettings = { ...settings }
}
