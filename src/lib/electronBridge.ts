/**
 * Electron Bridge
 *
 * Electron IPC API 래퍼
 * - 프린터 API
 * - 파일 시스템 API
 * - 비즈니스 API (Production, Stock, BOM, Material, LotTrace, Inspection, Line, Sequence)
 */

// ============================================
// Common Types
// ============================================

/**
 * API 응답 래퍼 타입
 * 모든 IPC 호출의 응답 형식
 */
export interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * API 호출 옵션
 */
export interface CallAPIOptions {
  /** 브라우저 환경에서 사용할 폴백 함수 */
  fallback?: () => Promise<unknown>
  /** 에러 발생 시 콘솔 로깅 여부 */
  logErrors?: boolean
}

// ============================================
// Printer & File Types
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
// Business API Input Types
// ============================================

/** Production API 입력 타입 */
export interface CreateLotInput {
  processCode: string
  productId: number
  targetQuantity: number
  lineId?: number
  workerId?: string
  inputMaterialDetails?: Array<{
    materialId: number
    materialCode: string
    materialName: string
    quantity: number
    lotNumber?: string
  }>
}

/** Stock API 입력 타입 */
export interface ReceiveStockInput {
  materialId: number
  quantity: number
  lotNumber?: string
  location?: string
  expiryDate?: Date
  supplierId?: number
}

export interface InputMaterial {
  materialId: number
  quantity: number
  lotNumber?: string
}

/** BOM API 입력 타입 */
export interface CreateBOMItemInput {
  productId: number
  materialId: number
  quantity: number
  processCode?: string
  unit?: string
}

export interface UpdateBOMItemInput {
  quantity?: number
  processCode?: string
  unit?: string
}

/** Material API 입력 타입 */
export interface CreateMaterialInput {
  code: string
  name: string
  spec?: string
  unit: string
  category?: string
  safeStock?: number
}

export interface UpdateMaterialInput {
  name?: string
  spec?: string
  unit?: string
  category?: string
  safeStock?: number
}

/** Inspection API 입력 타입 */
export interface CreateInspectionInput {
  lotId: number
  inspectorId?: string
  result: 'PASS' | 'FAIL' | 'PENDING'
  defectCount?: number
  defectType?: string
  notes?: string
}

// ============================================
// Business API Namespace Types
// ============================================

/** Production 네임스페이스 타입 */
export interface ProductionAPI {
  createLot: (input: CreateLotInput) => Promise<ApiResult<unknown>>
  startProduction: (lotId: number) => Promise<ApiResult<unknown>>
  completeProduction: (lotId: number, quantity: number) => Promise<ApiResult<unknown>>
  addMaterial: (lotId: number, materialId: number, quantity: number, lotNumber?: string) => Promise<ApiResult<unknown>>
  removeMaterial: (lotMaterialId: number) => Promise<ApiResult<unknown>>
  getLotById: (lotId: number) => Promise<ApiResult<unknown>>
  getLotByNumber: (lotNumber: string) => Promise<ApiResult<unknown>>
  getLotsByProcess: (processCode: string) => Promise<ApiResult<unknown[]>>
  getLotsByStatus: (status: string) => Promise<ApiResult<unknown[]>>
  updateLotQuantity: (lotId: number, quantity: number) => Promise<ApiResult<unknown>>
}

/** Stock API 공정별 재고 등록 입력 타입 */
export interface RegisterProcessStockInput {
  processCode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
}

/** Stock 네임스페이스 타입 */
export interface StockAPI {
  // 기본 재고 API
  receiveStock: (input: ReceiveStockInput) => Promise<ApiResult<unknown>>
  consumeStock: (stockId: number, quantity: number, lotId?: number) => Promise<ApiResult<void>>
  deductByBOM: (
    productId: number,
    processCode: string,
    productionQty: number,
    inputMaterials?: InputMaterial[],
    allowNegative?: boolean,
    productionLotId?: number
  ) => Promise<ApiResult<unknown>>
  getStockByMaterial: (materialId: number) => Promise<ApiResult<unknown[]>>
  getStockSummary: () => Promise<ApiResult<unknown[]>>
  getLowStock: () => Promise<ApiResult<unknown[]>>
  getAvailableQty: (materialId: number) => Promise<ApiResult<number>>
  getTodayReceivings: () => Promise<ApiResult<unknown[]>>

  // 전체 재고 조회
  getAllStocks: (options?: { materialCode?: string; showZero?: boolean }) => Promise<ApiResult<unknown[]>>

  // 공정별 재고 API
  registerProcessStock: (input: RegisterProcessStockInput) => Promise<ApiResult<unknown>>
  getStocksByProcess: (processCode: string, options?: { materialCode?: string; showZero?: boolean }) => Promise<ApiResult<unknown[]>>
  checkProcessStockStatus: (processCode: string, lotNumber: string) => Promise<ApiResult<unknown>>
  consumeProcessStock: (processCode: string, materialId: number, quantity: number, productionLotId?: number, allowNegative?: boolean) => Promise<ApiResult<unknown>>
  getProcessStockSummary: (processCode: string) => Promise<ApiResult<unknown>>
  getProcessAvailableQty: (processCode: string, materialId: number) => Promise<ApiResult<number>>
  getTodayProcessReceivings: (processCode?: string) => Promise<ApiResult<unknown[]>>

  // 데이터 관리 API
  deleteStockItems: (ids: number[]) => Promise<ApiResult<unknown>>
  resetAllStockData: () => Promise<ApiResult<unknown>>
}

/** BOM 네임스페이스 타입 */
export interface BOMAPI {
  createBOMItem: (input: CreateBOMItemInput) => Promise<ApiResult<unknown>>
  updateBOMItem: (bomId: number, input: UpdateBOMItemInput) => Promise<ApiResult<unknown>>
  deleteBOMItem: (bomId: number) => Promise<ApiResult<unknown>>
  getBOMByProduct: (productId: number) => Promise<ApiResult<unknown[]>>
}

/** Material 네임스페이스 타입 */
export interface MaterialAPI {
  create: (input: CreateMaterialInput) => Promise<ApiResult<unknown>>
  getById: (materialId: number) => Promise<ApiResult<unknown>>
  update: (materialId: number, input: UpdateMaterialInput) => Promise<ApiResult<unknown>>
  delete: (materialId: number) => Promise<ApiResult<unknown>>
  getAll: () => Promise<ApiResult<unknown[]>>
}

/** LotTrace 네임스페이스 타입 */
export interface LotTraceAPI {
  traceForward: (lotId: number) => Promise<ApiResult<unknown[]>>
  traceBackward: (lotId: number) => Promise<ApiResult<unknown[]>>
  buildTraceTree: (lotId: number, direction: 'forward' | 'backward') => Promise<ApiResult<unknown>>
}

/** Inspection 네임스페이스 타입 */
export interface InspectionAPI {
  create: (input: CreateInspectionInput) => Promise<ApiResult<unknown>>
  getByLot: (lotId: number) => Promise<ApiResult<unknown[]>>
}

/** Line 네임스페이스 타입 */
export interface LineAPI {
  getAll: () => Promise<ApiResult<unknown[]>>
  getByProcess: (processCode: string) => Promise<ApiResult<unknown[]>>
}

/** Sequence 네임스페이스 타입 */
export interface SequenceAPI {
  getNext: (prefix: string) => Promise<ApiResult<{ prefix: string; dateKey: string; sequence: number; formatted: string }>>
  getNextBundle: (prefix: string) => Promise<ApiResult<{ prefix: string; dateKey: string; sequence: number; formatted: string }>>
}

/** Bundle API 입력 타입 */
export interface CreateBundleInput {
  processCode: string
  productId: number
  productCode: string
  setQuantity: number
}

export interface AddToBundleInput {
  bundleLotId: number
  productionLotId: number
  quantity: number
}

/** Bundle 네임스페이스 타입 */
export interface BundleAPI {
  create: (input: CreateBundleInput) => Promise<ApiResult<unknown>>
  addToBundle: (input: AddToBundleInput) => Promise<ApiResult<unknown>>
  removeFromBundle: (bundleItemId: number) => Promise<ApiResult<unknown>>
  complete: (bundleLotId: number) => Promise<ApiResult<unknown>>
  unbundle: (bundleLotId: number) => Promise<ApiResult<unknown>>
  delete: (bundleLotId: number) => Promise<ApiResult<unknown>>
  getById: (bundleLotId: number) => Promise<ApiResult<unknown>>
  getByNo: (bundleNo: string) => Promise<ApiResult<unknown>>
  getActive: () => Promise<ApiResult<unknown[]>>
  getAvailableLots: (productId: number) => Promise<ApiResult<unknown[]>>
  createSet: (items: Array<{ lotId: number; quantity: number }>) => Promise<ApiResult<unknown>>
  shipEntire: (bundleId: number) => Promise<ApiResult<unknown>>
}

/** Product API 입력 타입 */
export interface CreateProductInput {
  code: string
  name: string
  spec?: string
  processCode?: string
  bomLevel?: number
}

export interface UpdateProductInput {
  name?: string
  spec?: string
  processCode?: string
  bomLevel?: number
}

/** Product 네임스페이스 타입 */
export interface ProductAPI {
  getAll: () => Promise<ApiResult<unknown[]>>
  getById: (productId: number) => Promise<ApiResult<unknown>>
  create: (input: CreateProductInput) => Promise<ApiResult<unknown>>
  update: (productId: number, input: UpdateProductInput) => Promise<ApiResult<unknown>>
  delete: (productId: number) => Promise<ApiResult<unknown>>
}

// ============================================
// Electron API Detection
// ============================================

declare global {
  interface Window {
    electronAPI?: {
      // Printer API
      getPrinters: () => Promise<PrinterInfo[]>
      printPDF: (options: PrintOptions) => Promise<PrintResult>
      printToPDF: () => Promise<PrintResult>
      printLabel: (options: LabelPrintOptions) => Promise<PrintResult>
      // File System API
      saveFileDialog: (options: SaveFileOptions) => Promise<string | null>
      openFileDialog: (options: OpenFileOptions) => Promise<string[]>
      writeFile: (options: { filePath: string; data: string | Buffer }) => Promise<FileResult>
      readFile: (filePath: string) => Promise<FileResult>
      // Business API Namespaces
      production: ProductionAPI
      stock: StockAPI
      bom: BOMAPI
      material: MaterialAPI
      lotTrace: LotTraceAPI
      inspection: InspectionAPI
      line: LineAPI
      sequence: SequenceAPI
      bundle: BundleAPI
      product: ProductAPI
    }
  }
}

/**
 * Electron 환경인지 확인
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}

/**
 * 비즈니스 API가 사용 가능한지 확인
 * Electron 환경이고 비즈니스 네임스페이스가 존재하는지 확인
 */
export function hasBusinessAPI(): boolean {
  return (
    isElectron() &&
    window.electronAPI !== undefined &&
    window.electronAPI.production !== undefined &&
    window.electronAPI.stock !== undefined &&
    window.electronAPI.bom !== undefined &&
    window.electronAPI.material !== undefined &&
    window.electronAPI.lotTrace !== undefined &&
    window.electronAPI.inspection !== undefined &&
    window.electronAPI.line !== undefined &&
    window.electronAPI.sequence !== undefined
  )
}

/**
 * 특정 비즈니스 네임스페이스가 사용 가능한지 확인
 */
export function hasNamespace(namespace: keyof Pick<
  NonNullable<typeof window.electronAPI>,
  'production' | 'stock' | 'bom' | 'material' | 'lotTrace' | 'inspection' | 'line' | 'sequence' | 'bundle' | 'product'
>): boolean {
  return isElectron() && window.electronAPI !== undefined && window.electronAPI[namespace] !== undefined
}

/**
 * 안전한 API 호출 래퍼
 * Electron 환경에서는 IPC 호출, 브라우저 환경에서는 폴백 사용
 *
 * @param apiCall - Electron API 호출 함수
 * @param options - 호출 옵션 (폴백, 에러 로깅 등)
 * @returns API 응답 또는 에러
 *
 * @example
 * // Electron 환경
 * const result = await callAPI(
 *   () => window.electronAPI!.production.getLotById(123),
 *   { logErrors: true }
 * )
 *
 * @example
 * // 브라우저 폴백
 * const result = await callAPI(
 *   () => window.electronAPI!.material.getAll(),
 *   { fallback: () => mockMaterialService.getAll() }
 * )
 */
export async function callAPI<T>(
  apiCall: () => Promise<ApiResult<T>>,
  options: CallAPIOptions = {}
): Promise<ApiResult<T>> {
  const { fallback, logErrors = true } = options

  // Electron 환경이 아니면 폴백 사용
  if (!isElectron()) {
    if (fallback) {
      try {
        const data = await fallback() as T
        return { success: true, data }
      } catch (error) {
        if (logErrors) {
          console.error('Fallback API 호출 오류:', error)
        }
        return { success: false, error: String(error) }
      }
    }
    return { success: false, error: 'Electron API not available' }
  }

  // Electron 환경에서 API 호출
  try {
    const result = await apiCall()
    return result
  } catch (error) {
    if (logErrors) {
      console.error('Electron API 호출 오류:', error)
    }
    return { success: false, error: String(error) }
  }
}

/**
 * 네임스페이스별 API 호출 래퍼
 * 타입 안전한 네임스페이스 접근 제공
 * Electron API가 없을 경우 안전한 Proxy 객체를 반환하여 렌더링 충돌 방지
 */
export function getAPI() {
  if (isElectron() && window.electronAPI) {
    return {
      production: window.electronAPI.production,
      stock: window.electronAPI.stock,
      bom: window.electronAPI.bom,
      material: window.electronAPI.material,
      lotTrace: window.electronAPI.lotTrace,
      inspection: window.electronAPI.inspection,
      line: window.electronAPI.line,
      sequence: window.electronAPI.sequence,
      bundle: window.electronAPI.bundle,
      product: window.electronAPI.product,
    }
  }

  // 안전 장치: API가 없으면 Proxy 객체 반환 (모든 함수 호출을 가로채서 에러 방지)
  console.warn('[ElectronBridge] API not found. Using safe proxy to prevent crash.');
  return new Proxy({}, {
    get: (_target, prop) => {
      return new Proxy({}, {
        get: (_t, p) => async () => {
          console.error(`[ElectronBridge] API Call Failed: ${String(prop)}.${String(p)} - Electron API not loaded`);
          return { success: false, error: 'Electron API not available (Safe Proxy)' };
        }
      });
    }
  }) as any;
}

/**
 * 비즈니스 API 사용 가능 여부에 따른 분기 처리
 * Phase 4 Context 마이그레이션에서 사용
 */
export async function withBusinessAPI<T>(
  electronCall: () => Promise<ApiResult<T>>,
  browserFallback: () => Promise<T>
): Promise<T> {
  if (hasBusinessAPI()) {
    const result = await electronCall()
    if (result.success && result.data !== undefined) {
      return result.data
    }
    throw new Error(result.error || 'API 호출 실패')
  }

  return browserFallback()
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
