/**
 * Stock Context
 *
 * 재고 관리 상태 (Electron API + 브라우저 Mock 지원)
 * - Electron IPC를 통해 실제 DB 서비스 호출
 * - 브라우저 환경에서는 Mock 서비스 사용
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

// Electron API 헬퍼 함수
import { hasBusinessAPI, getAPI } from '../../lib/electronBridge'

// 브라우저 모드용 Mock 서비스
import * as MockStockService from '../../services/mock/stockService.mock'

// ============================================
// Types (로컬 정의 - Mock 서비스 의존성 제거)
// ============================================

// Phase 5: 재고 위치 타입 (StockItem보다 먼저 정의)
export type StockLocation = 'warehouse' | 'production' | 'process'

export interface StockItem {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  usedQty: number
  availableQty: number
  unit?: string  // 선택적 (stockService.mock과 호환)
  location?: StockLocation  // Phase 5: 재고 위치
  processCode?: string
  expiryDate?: string
  receivedAt: string
  updatedAt?: string
}

export interface ReceiveStockInput {
  materialId: number
  materialCode?: string
  materialName?: string
  quantity: number
  lotNumber?: string
  location?: string
  expiryDate?: Date
  supplierId?: number
}

export interface ReceiveStockResult {
  success: boolean
  id: number
  stock?: StockItem
  error?: string
}

export interface ReceivingRecord {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  unit: string
  receivedAt: string
}

export interface DeductionResult {
  success: boolean
  deductedItems: Array<{
    materialId: number
    materialCode: string
    requiredQty: number
    deductedQty: number
    lots: Array<{ lotNumber: string; usedQty: number }>
  }>
  errors: string[]
}

export interface ProcessStockInput {
  processCode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
}

export interface ProcessStockResult {
  success: boolean
  id: number
  stock?: StockItem
  isNewEntry: boolean
  error?: string
}

export interface ProcessStockStatus {
  exists: boolean
  lotNumber: string
  processCode: string
  quantity: number
  usedQty: number
  availableQty: number
  isExhausted: boolean
  canRegister: boolean
}

export interface ProcessReceivingRecord {
  id: number
  processCode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  receivedAt: string
}

export interface MaterialInput {
  materialId: number
  quantity?: number
  lotNumber?: string
}

// ============================================
// Phase 5: 3단계 재고 관리 Types
// ============================================

export interface IssueToProductionInput {
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
}

export interface IssueToProductionResult {
  success: boolean
  warehouseStock?: StockItem
  productionStock?: StockItem
  issuedQty: number
  error?: string
}

export interface IssuingRecord {
  id: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  availableQty: number
  issuedAt: string
}

export interface ScanToProcessInput {
  processCode: string
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
}

export interface ScanToProcessResult {
  success: boolean
  productionStock?: StockItem
  processStock?: StockItem
  scannedQty: number
  error?: string
}

export interface CancelIssueResult {
  success: boolean
  cancelledQty: number
  error?: string
}

// ============================================
// Types
// ============================================

interface StockSummary {
  totalLots: number
  totalQuantity: number
  totalAvailable: number
  totalUsed: number
  materialCount: number
}

interface StockState {
  // 전체 재고 목록
  stocks: StockItem[]
  // 재고 요약
  summary: StockSummary | null
  // 금일 입고 내역
  todayReceivings: ReceivingRecord[]
  // 로딩 상태
  isLoading: boolean
  // 에러 메시지
  error: string | null
}

interface StockContextValue extends StockState {
  // ============================================
  // 기본 재고 함수
  // ============================================

  // 자재 입고
  receiveStock: (input: ReceiveStockInput) => Promise<ReceiveStockResult>
  // 재고 차감 (FIFO)
  consumeStock: (stockId: number, quantity: number, lotId?: number) => Promise<void>
  // BOM 기반 자재 차감
  deductByBOM: (
    productId: number,
    processCode: string,
    productionQty: number,
    inputMaterials?: MaterialInput[],
    allowNegative?: boolean,
    productionLotId?: number
  ) => Promise<DeductionResult>
  // BOM 차감 롤백 (LOT 취소 시)
  rollbackBOMDeduction: (lotId: number) => Promise<number>
  // 자재별 재고 조회
  getStockByMaterial: (materialId: number) => Promise<StockItem[]>
  // 전체 재고 조회
  getAllStocks: (options?: { materialCode?: string; showZero?: boolean }) => Promise<StockItem[]>
  // 재고 요약 조회
  getStockSummary: () => Promise<StockSummary>
  // 금일 입고 내역 조회
  getTodayReceivings: () => Promise<ReceivingRecord[]>
  // 자재별 가용 재고 수량 조회
  getAvailableQty: (materialId: number) => Promise<number>

  // ============================================
  // 공정별 재고 함수
  // ============================================

  // 공정에 자재 등록
  registerProcessStock: (input: ProcessStockInput) => Promise<ProcessStockResult>
  // 공정별 재고 조회
  getStocksByProcess: (
    processCode: string,
    options?: { materialCode?: string; showZero?: boolean }
  ) => Promise<StockItem[]>
  // 공정+LOT로 재고 조회
  getProcessStockByLot: (processCode: string, lotNumber: string) => Promise<StockItem | null>
  // 공정+LOT 상태 확인
  checkProcessStockStatus: (processCode: string, lotNumber: string) => Promise<ProcessStockStatus>
  // 공정별 FIFO 재고 차감
  consumeProcessStock: (
    processCode: string,
    materialId: number,
    quantity: number,
    productionLotId?: number,
    allowNegative?: boolean
  ) => Promise<{ lots: Array<{ lotNumber: string; usedQty: number }>; deductedQty: number; remainingQty: number }>
  // 공정별 재고 요약
  getProcessStockSummary: (processCode: string) => Promise<StockSummary>
  // 공정별 가용 재고 수량
  getProcessAvailableQty: (processCode: string, materialId: number) => Promise<number>
  // 공정별 금일 스캔 내역
  getTodayProcessReceivings: (processCode?: string) => Promise<ProcessReceivingRecord[]>

  // ============================================
  // Phase 5: 3단계 재고 관리 함수
  // ============================================

  // 자재 불출 (자재창고 → 생산창고)
  issueToProduction: (input: IssueToProductionInput) => Promise<IssueToProductionResult>
  // 공정 자재 스캔 (생산창고 → 공정재고)
  scanToProcess: (input: ScanToProcessInput) => Promise<ScanToProcessResult>
  // 금일 불출 내역 조회
  getTodayIssuings: () => Promise<IssuingRecord[]>
  // 위치별 재고 조회
  getStocksByLocation: (
    location: StockLocation,
    options?: { processCode?: string; materialCode?: string; showZero?: boolean }
  ) => Promise<StockItem[]>
  // 위치별 재고 요약
  getLocationStockSummary: (location: StockLocation) => Promise<StockSummary>
  // 불출 취소
  cancelIssue: (stockId: number) => Promise<CancelIssueResult>
  // 생산창고 재고 상세 조회
  getProductionStockById: (stockId: number) => Promise<StockItem | null>

  // ============================================
  // 데이터 관리 함수
  // ============================================

  // 선택한 LOT 재고 삭제
  deleteStockItems: (ids: number[]) => Promise<number>
  // 선택한 공정 입고 이력 삭제
  deleteProcessReceivings: (ids: number[]) => Promise<number>
  // 전체 재고 및 입고 이력 초기화
  resetAllStockData: () => Promise<{ stocks: number; receivings: number; lotMaterials: number }>
  // 재고 데이터 새로고침
  refreshStocks: () => Promise<void>
  // 에러 초기화
  clearError: () => void
}

// ============================================
// Context
// ============================================

const StockContext = createContext<StockContextValue | undefined>(undefined)

// ============================================
// Provider
// ============================================

interface StockProviderProps {
  children: ReactNode
}

export function StockProvider({ children }: StockProviderProps) {
  const [state, setState] = useState<StockState>({
    stocks: [],
    summary: null,
    todayReceivings: [],
    isLoading: false,
    error: null,
  })

  // 로딩 상태 설정
  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }))
  }, [])

  // 에러 설정
  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isLoading: false }))
  }, [])

  // 에러 초기화
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  // ============================================
  // 기본 재고 함수 (Electron API)
  // ============================================

  // 자재 입고
  const receiveStock = useCallback(async (input: ReceiveStockInput): Promise<ReceiveStockResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock receiveStock')
      setLoading(true)
      try {
        const mockInput = {
          materialId: input.materialId,
          materialCode: input.materialCode || '',
          materialName: input.materialName,
          lotNumber: input.lotNumber || '',
          quantity: input.quantity,
        }
        const result = await MockStockService.receiveStock(mockInput)
        setLoading(false)
        return result as ReceiveStockResult
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : '자재 입고 실패'
        return { success: false, id: 0, error: message }
      }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const apiResult = await api!.stock.receiveStock({
        materialId: input.materialId,
        quantity: input.quantity,
        lotNumber: input.lotNumber,
      })

      if (!apiResult.success) {
        throw new Error(apiResult.error || '입고 실패')
      }

      const result: ReceiveStockResult = {
        success: true,
        id: (apiResult.data as { id: number })?.id || 0,
        stock: apiResult.data as ReceiveStockResult['stock'],
      }

      setLoading(false)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : '입고 실패'
      setError(message)
      return { success: false, id: 0, error: message }
    }
  }, [setLoading, setError])

  // 재고 차감
  const consumeStock = useCallback(async (
    stockId: number,
    quantity: number,
    lotId?: number
  ): Promise<void> => {
    if (!hasBusinessAPI()) {
      throw new Error('Electron API not available')
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.stock.consumeStock(stockId, quantity, lotId)
      if (!result.success) {
        throw new Error(result.error || '차감 실패')
      }
      setLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '차감 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // BOM 기반 자재 차감
  const deductByBOM = useCallback(async (
    productId: number,
    processCode: string,
    productionQty: number,
    inputMaterials: MaterialInput[] = [],
    allowNegative: boolean = true,
    productionLotId?: number
  ): Promise<DeductionResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock deductByBOM')
      setLoading(true)
      try {
        const result = await MockStockService.deductByBOM(
          productId,
          processCode,
          productionQty,
          inputMaterials.map(m => ({
            materialId: m.materialId,
            quantity: m.quantity || 0,
            lotNumber: m.lotNumber,
          })),
          allowNegative,
          productionLotId
        )
        setLoading(false)
        // 타입 변환 (브라우저 모드에서는 UI 표시용으로 충분)
        return result as unknown as DeductionResult
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : 'BOM 차감 실패'
        return { success: false, deductedItems: [], errors: [message] }
      }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const apiResult = await api!.stock.deductByBOM(
        productId,
        processCode,
        productionQty,
        inputMaterials.map(m => ({
          materialId: m.materialId,
          quantity: m.quantity || 0,
          lotNumber: m.lotNumber,
        })),
        allowNegative,
        productionLotId
      )

      if (!apiResult.success) {
        throw new Error(apiResult.error || 'BOM 차감 실패')
      }

      setLoading(false)
      return apiResult.data as DeductionResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BOM 차감 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // BOM 차감 롤백 (LOT 취소 시) - API 미구현으로 스텁
  const rollbackBOMDeduction = useCallback(async (lotId: number): Promise<number> => {
    // TODO: Electron API에 rollback 기능 추가 후 구현
    console.warn('[StockContext] rollbackBOMDeduction: API not implemented, returning 0', { lotId })
    return 0
  }, [])

  // 자재별 재고 조회
  const getStockByMaterial = useCallback(async (materialId: number): Promise<StockItem[]> => {
    if (!hasBusinessAPI()) {
      return []
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getStockByMaterial(materialId)
      if (!result.success) {
        throw new Error(result.error || '재고 조회 실패')
      }
      return (result.data as StockItem[]) || []
    } catch (err) {
      console.error('[StockContext] getStockByMaterial error:', err)
      return []
    }
  }, [])

  // 전체 재고 조회
  const getAllStocks = useCallback(async (
    options?: { materialCode?: string; showZero?: boolean }
  ): Promise<StockItem[]> => {
    if (!hasBusinessAPI()) {
      return []
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getAllStocks(options)
      if (!result.success) {
        throw new Error(result.error || '전체 재고 조회 실패')
      }
      const stocks = (result.data as StockItem[]) || []
      setState((prev) => ({ ...prev, stocks }))
      return stocks
    } catch (err) {
      console.error('[StockContext] getAllStocks error:', err)
      return []
    }
  }, [])

  // 재고 요약 조회
  const getStockSummary = useCallback(async (): Promise<StockSummary> => {
    if (!hasBusinessAPI()) {
      return { totalLots: 0, totalQuantity: 0, totalAvailable: 0, totalUsed: 0, materialCount: 0 }
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getStockSummary()
      if (!result.success) {
        throw new Error(result.error || '재고 요약 조회 실패')
      }
      const summary = result.data as unknown as StockSummary
      setState((prev) => ({ ...prev, summary }))
      return summary
    } catch (err) {
      console.error('[StockContext] getStockSummary error:', err)
      return { totalLots: 0, totalQuantity: 0, totalAvailable: 0, totalUsed: 0, materialCount: 0 }
    }
  }, [])

  // 금일 입고 내역 조회
  const getTodayReceivings = useCallback(async (): Promise<ReceivingRecord[]> => {
    if (!hasBusinessAPI()) {
      return []
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getTodayReceivings()
      if (!result.success) {
        throw new Error(result.error || '입고 내역 조회 실패')
      }
      const receivings = (result.data as ReceivingRecord[]) || []
      setState((prev) => ({ ...prev, todayReceivings: receivings }))
      return receivings
    } catch (err) {
      console.error('[StockContext] getTodayReceivings error:', err)
      return []
    }
  }, [])

  // 자재별 가용 재고 수량 조회
  const getAvailableQty = useCallback(async (materialId: number): Promise<number> => {
    if (!hasBusinessAPI()) {
      return 0
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getAvailableQty(materialId)
      if (!result.success) {
        throw new Error(result.error || '가용 수량 조회 실패')
      }
      return result.data ?? 0
    } catch (err) {
      console.error('[StockContext] getAvailableQty error:', err)
      return 0
    }
  }, [])

  // ============================================
  // 공정별 재고 함수 (Electron API)
  // ============================================

  // 공정에 자재 등록
  const registerProcessStock = useCallback(async (input: ProcessStockInput): Promise<ProcessStockResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock registerProcessStock')
      setLoading(true)
      try {
        const result = await MockStockService.registerProcessStock(input)
        setLoading(false)
        return result as ProcessStockResult
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : '공정 재고 등록 실패'
        return { success: false, id: 0, isNewEntry: false, error: message }
      }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.stock.registerProcessStock(input)

      if (!result.success) {
        throw new Error(result.error || '공정 재고 등록 실패')
      }

      setLoading(false)
      return {
        success: true,
        id: (result.data as { id: number })?.id || 0,
        stock: result.data as ProcessStockResult['stock'],
        isNewEntry: (result.data as { isNewEntry?: boolean })?.isNewEntry ?? true,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '공정 재고 등록 실패'
      setError(message)
      return { success: false, id: 0, isNewEntry: false, error: message }
    }
  }, [setLoading, setError])

  // 공정별 재고 조회
  const getStocksByProcess = useCallback(async (
    processCode: string,
    options?: { materialCode?: string; showZero?: boolean }
  ): Promise<StockItem[]> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getStocksByProcess')
      const result = await MockStockService.getStocksByProcess(processCode, options)
      return result as StockItem[]
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getStocksByProcess(processCode, options)
      if (!result.success) {
        throw new Error(result.error || '공정별 재고 조회 실패')
      }
      return (result.data as StockItem[]) || []
    } catch (err) {
      console.error('[StockContext] getStocksByProcess error:', err)
      return []
    }
  }, [])

  // 공정+LOT로 재고 조회
  const getProcessStockByLot = useCallback(async (
    processCode: string,
    lotNumber: string
  ): Promise<StockItem | null> => {
    if (!hasBusinessAPI()) {
      return null
    }

    try {
      // getStocksByProcess를 사용하여 해당 공정의 재고를 가져온 후 LOT로 필터링
      const stocks = await getStocksByProcess(processCode)
      return stocks.find(s => s.lotNumber === lotNumber) || null
    } catch (err) {
      console.error('[StockContext] getProcessStockByLot error:', err)
      return null
    }
  }, [getStocksByProcess])

  // 공정+LOT 상태 확인
  const checkProcessStockStatus = useCallback(async (
    processCode: string,
    lotNumber: string
  ): Promise<ProcessStockStatus> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock checkProcessStockStatus')
      return MockStockService.checkProcessStockStatus(processCode, lotNumber)
    }

    try {
      const api = getAPI()
      const result = await api!.stock.checkProcessStockStatus(processCode, lotNumber)
      if (!result.success) {
        throw new Error(result.error || '상태 확인 실패')
      }
      return result.data as ProcessStockStatus
    } catch (err) {
      console.error('[StockContext] checkProcessStockStatus error:', err)
      return {
        exists: false,
        lotNumber,
        processCode,
        quantity: 0,
        usedQty: 0,
        availableQty: 0,
        isExhausted: false,
        canRegister: true,
      }
    }
  }, [])

  // 공정별 FIFO 재고 차감
  const consumeProcessStock = useCallback(async (
    processCode: string,
    materialId: number,
    quantity: number,
    productionLotId?: number,
    allowNegative: boolean = true
  ): Promise<{ lots: Array<{ lotNumber: string; usedQty: number }>; deductedQty: number; remainingQty: number }> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock consumeProcessStock')
      setLoading(true)
      try {
        const result = await MockStockService.consumeProcessStock(
          processCode,
          materialId,
          quantity,
          productionLotId,
          allowNegative
        )
        setLoading(false)
        return result
      } catch (err) {
        setLoading(false)
        throw err
      }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.stock.consumeProcessStock(
        processCode,
        materialId,
        quantity,
        productionLotId,
        allowNegative
      )

      if (!result.success) {
        throw new Error(result.error || '공정 재고 차감 실패')
      }

      setLoading(false)
      return result.data as { lots: Array<{ lotNumber: string; usedQty: number }>; deductedQty: number; remainingQty: number }
    } catch (err) {
      const message = err instanceof Error ? err.message : '공정 재고 차감 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 공정별 재고 요약
  const getProcessStockSummary = useCallback(async (processCode: string): Promise<StockSummary> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getProcessStockSummary')
      return MockStockService.getProcessStockSummary(processCode)
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getProcessStockSummary(processCode)
      if (!result.success) {
        throw new Error(result.error || '공정별 재고 요약 조회 실패')
      }
      return result.data as StockSummary
    } catch (err) {
      console.error('[StockContext] getProcessStockSummary error:', err)
      return { totalLots: 0, totalQuantity: 0, totalAvailable: 0, totalUsed: 0, materialCount: 0 }
    }
  }, [])

  // 공정별 가용 재고 수량
  const getProcessAvailableQty = useCallback(async (
    processCode: string,
    materialId: number
  ): Promise<number> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getProcessAvailableQty')
      return MockStockService.getProcessAvailableQty(processCode, materialId)
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getProcessAvailableQty(processCode, materialId)
      if (!result.success) {
        throw new Error(result.error || '공정별 가용 수량 조회 실패')
      }
      return result.data ?? 0
    } catch (err) {
      console.error('[StockContext] getProcessAvailableQty error:', err)
      return 0
    }
  }, [])

  // 공정별 금일 스캔 내역
  const getTodayProcessReceivings = useCallback(async (
    processCode?: string
  ): Promise<ProcessReceivingRecord[]> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getTodayProcessReceivings')
      const result = await MockStockService.getTodayProcessReceivings(processCode)
      // 타입이 완전히 일치하지 않지만 브라우저 모드에서는 UI 표시용으로 충분함
      return result as unknown as ProcessReceivingRecord[]
    }

    try {
      const api = getAPI()
      const result = await api!.stock.getTodayProcessReceivings(processCode)
      if (!result.success) {
        throw new Error(result.error || '공정별 금일 스캔 내역 조회 실패')
      }
      return (result.data as ProcessReceivingRecord[]) || []
    } catch (err) {
      console.error('[StockContext] getTodayProcessReceivings error:', err)
      return []
    }
  }, [])

  // ============================================
  // Phase 5: 3단계 재고 관리 함수 구현
  // ============================================

  // 자재 불출 (자재창고 → 생산창고)
  const issueToProduction = useCallback(async (
    input: IssueToProductionInput
  ): Promise<IssueToProductionResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock issueToProduction')
      setLoading(true)
      try {
        const result = await MockStockService.issueToProduction(input)
        setLoading(false)
        return result
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : '자재 불출 실패'
        return { success: false, issuedQty: 0, error: message }
      }
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    console.warn('[StockContext] issueToProduction: Electron API not implemented, using mock')
    setLoading(true)
    try {
      const result = await MockStockService.issueToProduction(input)
      setLoading(false)
      return result
    } catch (err) {
      setLoading(false)
      const message = err instanceof Error ? err.message : '자재 불출 실패'
      return { success: false, issuedQty: 0, error: message }
    }
  }, [setLoading])

  // 공정 자재 스캔 (생산창고 → 공정재고)
  const scanToProcess = useCallback(async (
    input: ScanToProcessInput
  ): Promise<ScanToProcessResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock scanToProcess')
      setLoading(true)
      try {
        const result = await MockStockService.scanToProcess(input)
        setLoading(false)
        return result
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : '공정 스캔 실패'
        return { success: false, scannedQty: 0, error: message }
      }
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    console.warn('[StockContext] scanToProcess: Electron API not implemented, using mock')
    setLoading(true)
    try {
      const result = await MockStockService.scanToProcess(input)
      setLoading(false)
      return result
    } catch (err) {
      setLoading(false)
      const message = err instanceof Error ? err.message : '공정 스캔 실패'
      return { success: false, scannedQty: 0, error: message }
    }
  }, [setLoading])

  // 금일 불출 내역 조회
  const getTodayIssuings = useCallback(async (): Promise<IssuingRecord[]> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getTodayIssuings')
      return MockStockService.getTodayIssuings()
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    return MockStockService.getTodayIssuings()
  }, [])

  // 위치별 재고 조회
  const getStocksByLocation = useCallback(async (
    location: StockLocation,
    options?: { processCode?: string; materialCode?: string; showZero?: boolean }
  ): Promise<StockItem[]> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getStocksByLocation')
      const result = await MockStockService.getStocksByLocation(location, options)
      return result as StockItem[]
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    const result = await MockStockService.getStocksByLocation(location, options)
    return result as StockItem[]
  }, [])

  // 위치별 재고 요약
  const getLocationStockSummary = useCallback(async (
    location: StockLocation
  ): Promise<StockSummary> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getLocationStockSummary')
      return MockStockService.getLocationStockSummary(location)
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    return MockStockService.getLocationStockSummary(location)
  }, [])

  // 불출 취소
  const cancelIssue = useCallback(async (stockId: number): Promise<CancelIssueResult> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock cancelIssue')
      setLoading(true)
      try {
        const result = await MockStockService.cancelIssue(stockId)
        setLoading(false)
        return result
      } catch (err) {
        setLoading(false)
        const message = err instanceof Error ? err.message : '불출 취소 실패'
        return { success: false, cancelledQty: 0, error: message }
      }
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    console.warn('[StockContext] cancelIssue: Electron API not implemented, using mock')
    setLoading(true)
    try {
      const result = await MockStockService.cancelIssue(stockId)
      setLoading(false)
      return result
    } catch (err) {
      setLoading(false)
      const message = err instanceof Error ? err.message : '불출 취소 실패'
      return { success: false, cancelledQty: 0, error: message }
    }
  }, [setLoading])

  // 생산창고 재고 상세 조회
  const getProductionStockById = useCallback(async (stockId: number): Promise<StockItem | null> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock getProductionStockById')
      const result = await MockStockService.getProductionStockById(stockId)
      return result as StockItem | null
    }

    // Electron 모드: API 호출 (미구현 시 Mock 사용)
    const result = await MockStockService.getProductionStockById(stockId)
    return result as StockItem | null
  }, [])

  // ============================================
  // 데이터 관리 함수
  // ============================================

  // 선택한 LOT 재고 삭제
  const deleteStockItems = useCallback(async (ids: number[]): Promise<number> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock deleteStockItems')
      setLoading(true)
      try {
        const deletedCount = MockStockService.deleteStockItems(ids)
        setLoading(false)
        return deletedCount
      } catch (err) {
        setLoading(false)
        console.error('[StockContext] deleteStockItems error:', err)
        return 0
      }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.stock.deleteStockItems(ids)

      if (!result.success) {
        throw new Error(result.error || '삭제 실패')
      }

      // 상태 새로고침
      const stocksResult = await api!.stock.getAllStocks()
      if (stocksResult.success) {
        setState((prev) => ({
          ...prev,
          stocks: (stocksResult.data as StockItem[]) || [],
          isLoading: false
        }))
      } else {
        setLoading(false)
      }

      return result.data as number
    } catch (err) {
      const message = err instanceof Error ? err.message : '삭제 실패'
      setError(message)
      return 0
    }
  }, [setLoading, setError])

  // 선택한 공정 입고 이력 삭제
  const deleteProcessReceivings = useCallback(async (ids: number[]): Promise<number> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Browser mode: Using mock deleteReceivingRecords')
      setLoading(true)
      try {
        const deletedCount = MockStockService.deleteReceivingRecords(ids)
        setLoading(false)
        return deletedCount
      } catch (err) {
        setLoading(false)
        console.error('[StockContext] deleteProcessReceivings error:', err)
        return 0
      }
    }

    // Electron 모드: API 사용 (현재 미구현이므로 경고 후 0 반환)
    console.warn('[StockContext] deleteProcessReceivings: Electron API not implemented')
    return 0
  }, [setLoading])

  // 전체 재고 및 입고 이력 초기화
  const resetAllStockData = useCallback(async (): Promise<{
    stocks: number
    receivings: number
    lotMaterials: number
  }> => {
    if (!hasBusinessAPI()) {
      return { stocks: 0, receivings: 0, lotMaterials: 0 }
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.stock.resetAllStockData()

      if (!result.success) {
        throw new Error(result.error || '초기화 실패')
      }

      setState((prev) => ({
        ...prev,
        stocks: [],
        summary: null,
        todayReceivings: [],
        isLoading: false,
      }))

      return result.data as { stocks: number; receivings: number; lotMaterials: number }
    } catch (err) {
      const message = err instanceof Error ? err.message : '초기화 실패'
      setError(message)
      return { stocks: 0, receivings: 0, lotMaterials: 0 }
    }
  }, [setLoading, setError])

  // 재고 데이터 새로고침
  const refreshStocks = useCallback(async (): Promise<void> => {
    if (!hasBusinessAPI()) {
      console.log('[StockContext] Electron API not available, skipping refresh')
      return
    }

    setLoading(true)
    try {
      const api = getAPI()

      const [stocksResult, summaryResult, receivingsResult] = await Promise.all([
        api!.stock.getAllStocks(),
        api!.stock.getStockSummary(),
        api!.stock.getTodayReceivings(),
      ])

      setState((prev) => ({
        ...prev,
        stocks: stocksResult.success ? (stocksResult.data as StockItem[]) || [] : prev.stocks,
        summary: summaryResult.success ? (summaryResult.data as unknown as StockSummary) : prev.summary,
        todayReceivings: receivingsResult.success ? (receivingsResult.data as ReceivingRecord[]) || [] : prev.todayReceivings,
        isLoading: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : '새로고침 실패'
      setError(message)
    }
  }, [setLoading, setError])

  // 초기 데이터 로드
  useEffect(() => {
    refreshStocks()
  }, [refreshStocks])

  const value: StockContextValue = {
    ...state,
    // 기본 재고 함수
    receiveStock,
    consumeStock,
    deductByBOM,
    rollbackBOMDeduction,
    getStockByMaterial,
    getAllStocks,
    getStockSummary,
    getTodayReceivings,
    getAvailableQty,
    // 공정별 재고 함수
    registerProcessStock,
    getStocksByProcess,
    getProcessStockByLot,
    checkProcessStockStatus,
    consumeProcessStock,
    getProcessStockSummary,
    getProcessAvailableQty,
    getTodayProcessReceivings,
    // Phase 5: 3단계 재고 관리 함수
    issueToProduction,
    scanToProcess,
    getTodayIssuings,
    getStocksByLocation,
    getLocationStockSummary,
    cancelIssue,
    getProductionStockById,
    // 데이터 관리 함수
    deleteStockItems,
    deleteProcessReceivings,
    resetAllStockData,
    refreshStocks,
    clearError,
  }

  return (
    <StockContext.Provider value={value}>
      {children}
    </StockContext.Provider>
  )
}

// ============================================
// Hook
// ============================================

export function useStock(): StockContextValue {
  const context = useContext(StockContext)
  if (!context) {
    throw new Error('useStock must be used within a StockProvider')
  }
  return context
}

export default StockContext
