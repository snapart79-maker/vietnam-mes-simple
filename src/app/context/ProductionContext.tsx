/**
 * Production Context
 *
 * 생산 LOT 상태 관리 (Mock 버전 - 브라우저용)
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import * as productionService from '../../services/mock/productionService.mock'
import type { LotWithRelations, LotStatus } from '../../services/mock/productionService.mock'

// Input 타입 정의
export interface CreateLotInput {
  processCode: string
  productId?: number
  productCode?: string
  lineCode?: string
  plannedQty?: number
  workerId?: number
  // 스캔한 입력 바코드 목록 (자재/반제품)
  inputBarcodes?: string[]
}

export interface CompleteLotInput {
  lotId: number
  completedQty: number
  defectQty?: number
}

export interface AddMaterialInput {
  lotId: number
  materialBarcode: string
  materialId: number
  quantity: number
}

// ============================================
// Types
// ============================================

interface ProductionState {
  // 현재 작업 LOT
  currentLot: LotWithRelations | null
  // 오늘의 LOT 목록
  todayLots: LotWithRelations[]
  // 현재 공정 코드
  currentProcess: string
  // 로딩 상태
  isLoading: boolean
  // 에러 메시지
  error: string | null
}

interface ProductionContextValue extends ProductionState {
  // LOT 생성
  createLot: (input: CreateLotInput) => Promise<LotWithRelations>
  // 작업 시작
  startProduction: (lotId: number, lineCode: string, workerId?: number) => Promise<LotWithRelations>
  // 작업 완료
  completeProduction: (input: CompleteLotInput) => Promise<LotWithRelations>
  // 자재 투입
  addMaterial: (input: AddMaterialInput) => Promise<void>
  // 자재 투입 취소
  removeMaterial: (lotMaterialId: number) => Promise<void>
  // LOT 조회
  getLotByNumber: (lotNumber: string) => Promise<LotWithRelations | null>
  // 현재 LOT 설정
  setCurrentLot: (lot: LotWithRelations | null) => void
  // 공정 변경
  setCurrentProcess: (processCode: string) => void
  // 오늘의 LOT 새로고침
  refreshTodayLots: () => Promise<void>
  // 공정별 LOT 조회
  getLotsByProcess: (processCode: string, status?: LotStatus) => Promise<LotWithRelations[]>
  // 상태별 LOT 조회
  getLotsByStatus: (status: LotStatus) => Promise<LotWithRelations[]>
  // LOT 수량 업데이트
  updateLotQuantity: (lotId: number, updates: {
    plannedQty?: number
    completedQty?: number
    defectQty?: number
  }) => Promise<LotWithRelations>
  // 에러 초기화
  clearError: () => void
  // 생산 데이터 초기화 (Context 상태)
  resetProduction: () => number
}

// ============================================
// Context
// ============================================

const ProductionContext = createContext<ProductionContextValue | undefined>(undefined)

// ============================================
// Provider
// ============================================

interface ProductionProviderProps {
  children: ReactNode
}

export function ProductionProvider({ children }: ProductionProviderProps) {
  const [state, setState] = useState<ProductionState>({
    currentLot: null,
    todayLots: [],
    currentProcess: 'CA',
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

  // 현재 LOT 설정
  const setCurrentLot = useCallback((lot: LotWithRelations | null) => {
    setState((prev) => ({ ...prev, currentLot: lot }))
  }, [])

  // 공정 변경
  const setCurrentProcess = useCallback((processCode: string) => {
    setState((prev) => ({ ...prev, currentProcess: processCode }))
  }, [])

  // LOT 생성
  const createLot = useCallback(async (input: CreateLotInput): Promise<LotWithRelations> => {
    setLoading(true)
    try {
      const lot = await productionService.createLot(input)
      setState((prev) => ({
        ...prev,
        currentLot: lot,
        todayLots: [lot, ...prev.todayLots],
        isLoading: false,
      }))
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 생성 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 작업 시작
  const startProduction = useCallback(async (
    lotId: number,
    lineCode: string,
    workerId?: number
  ): Promise<LotWithRelations> => {
    setLoading(true)
    try {
      const lot = await productionService.startProduction(lotId, lineCode, workerId)
      setState((prev) => ({
        ...prev,
        currentLot: lot,
        todayLots: prev.todayLots.map((l) => (l.id === lotId ? lot : l)),
        isLoading: false,
      }))
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : '작업 시작 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 작업 완료
  const completeProduction = useCallback(async (input: CompleteLotInput): Promise<LotWithRelations> => {
    setLoading(true)
    try {
      const lot = await productionService.completeProduction(input)
      setState((prev) => ({
        ...prev,
        currentLot: null, // 완료 후 현재 LOT 해제
        todayLots: prev.todayLots.map((l) => (l.id === input.lotId ? lot : l)),
        isLoading: false,
      }))
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : '작업 완료 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 자재 투입
  const addMaterial = useCallback(async (input: AddMaterialInput): Promise<void> => {
    setLoading(true)
    try {
      const result = await productionService.addMaterial(input)
      setState((prev) => ({
        ...prev,
        currentLot: prev.currentLot?.id === input.lotId ? result.lot : prev.currentLot,
        todayLots: prev.todayLots.map((l) => (l.id === input.lotId ? result.lot : l)),
        isLoading: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : '자재 투입 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 자재 투입 취소
  const removeMaterial = useCallback(async (lotMaterialId: number): Promise<void> => {
    setLoading(true)
    try {
      await productionService.removeMaterial(lotMaterialId)
      // 현재 LOT 새로고침
      if (state.currentLot) {
        const lot = await productionService.getLotById(state.currentLot.id)
        if (lot) {
          setState((prev) => ({
            ...prev,
            currentLot: lot,
            todayLots: prev.todayLots.map((l) => (l.id === lot.id ? lot : l)),
            isLoading: false,
          }))
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '자재 투입 취소 실패'
      setError(message)
      throw err
    }
  }, [state.currentLot, setLoading, setError])

  // LOT 번호로 조회
  const getLotByNumber = useCallback(async (lotNumber: string): Promise<LotWithRelations | null> => {
    setLoading(true)
    try {
      const lot = await productionService.getLotByNumber(lotNumber)
      setLoading(false)
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 오늘의 LOT 새로고침
  const refreshTodayLots = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const lots = await productionService.getTodayLots(state.currentProcess)
      setState((prev) => ({
        ...prev,
        todayLots: lots,
        isLoading: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 목록 조회 실패'
      setError(message)
      throw err
    }
  }, [state.currentProcess, setLoading, setError])

  // 공정별 LOT 조회
  const getLotsByProcess = useCallback(async (
    processCode: string,
    status?: LotStatus
  ): Promise<LotWithRelations[]> => {
    setLoading(true)
    try {
      const lots = await productionService.getLotsByProcess(processCode, { status })
      setLoading(false)
      return lots
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 상태별 LOT 조회
  const getLotsByStatus = useCallback(async (status: LotStatus): Promise<LotWithRelations[]> => {
    setLoading(true)
    try {
      const lots = await productionService.getLotsByStatus(status, {
        processCode: state.currentProcess,
      })
      setLoading(false)
      return lots
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [state.currentProcess, setLoading, setError])

  // LOT 수량 업데이트
  const updateLotQuantity = useCallback(async (
    lotId: number,
    updates: {
      plannedQty?: number
      completedQty?: number
      defectQty?: number
    }
  ): Promise<LotWithRelations> => {
    setLoading(true)
    try {
      const lot = await productionService.updateLotQuantity(lotId, updates)
      setState((prev) => ({
        ...prev,
        currentLot: prev.currentLot?.id === lotId ? lot : prev.currentLot,
        todayLots: prev.todayLots.map((l) => (l.id === lotId ? lot : l)),
        isLoading: false,
      }))
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : '수량 업데이트 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 생산 데이터 초기화 (Context 상태)
  const resetProduction = useCallback(() => {
    const count = state.todayLots.length
    setState({
      currentLot: null,
      todayLots: [],
      currentProcess: 'CA',
      isLoading: false,
      error: null,
    })
    return count
  }, [state.todayLots.length])

  const value: ProductionContextValue = {
    ...state,
    createLot,
    startProduction,
    completeProduction,
    addMaterial,
    removeMaterial,
    getLotByNumber,
    setCurrentLot,
    setCurrentProcess,
    refreshTodayLots,
    getLotsByProcess,
    getLotsByStatus,
    updateLotQuantity,
    clearError,
    resetProduction,
  }

  return (
    <ProductionContext.Provider value={value}>
      {children}
    </ProductionContext.Provider>
  )
}

// ============================================
// Hook
// ============================================

export function useProduction(): ProductionContextValue {
  const context = useContext(ProductionContext)
  if (!context) {
    throw new Error('useProduction must be used within a ProductionProvider')
  }
  return context
}

export default ProductionContext
