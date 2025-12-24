/**
 * Production Context
 *
 * 생산 LOT 상태 관리 (Electron API + 브라우저 Mock 지원)
 * - Electron IPC를 통해 실제 DB 서비스 호출
 * - 브라우저 환경에서는 Mock 서비스 사용
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// Electron API 헬퍼 함수
import { hasBusinessAPI, getAPI } from '../../lib/electronBridge'

// 브라우저 모드용 Mock 서비스
import * as MockProductionService from '../../services/mock/productionService.mock'

// ============================================
// Types (로컬 정의 - Mock 서비스 의존성 제거)
// ============================================

export type LotStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface LotMaterial {
  id: number
  lotId: number
  materialId: number
  materialCode?: string
  materialName?: string
  quantity: number
  usedQty: number
  lotNumber?: string
  createdAt: string
}

export interface LotWithRelations {
  id: number
  lotNumber: string
  processCode: string
  productId: number | null
  productCode?: string
  productName?: string
  crimpCode?: string
  lineCode?: string
  workerId?: number
  status: LotStatus
  plannedQty: number
  completedQty: number
  defectQty: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  lotMaterials?: LotMaterial[]
}

// Input 타입 정의
export interface CreateLotInput {
  processCode: string
  productId?: number
  productCode?: string
  lineCode?: string
  plannedQty?: number
  workerId?: number
  // 스캔한 입력 바코드 목록 (자재/반제품) - 하위 호환성
  inputBarcodes?: string[]
  // 자재 상세 정보 (바코드, 코드, 이름 포함) - 전표 출력용
  inputMaterialDetails?: Array<{
    barcode: string
    materialCode?: string
    materialName?: string
    quantity?: number
  }>
  // CA 공정 절압착 품번
  crimpCode?: string
}

export interface CompleteLotInput {
  lotId: number
  completedQty: number
  defectQty?: number
  // 반제품 품번 (완료 시 LOT 번호 생성에 사용)
  semiProductCode?: string
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

  // LOT 생성 (Electron API + 브라우저 Mock)
  const createLot = useCallback(async (input: CreateLotInput): Promise<LotWithRelations> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[ProductionContext] Browser mode: Using mock createLot')
      setLoading(true)
      try {
        const result = await MockProductionService.createLot({
          processCode: input.processCode,
          productId: input.productId,
          productCode: input.productCode,
          lineCode: input.lineCode,
          plannedQty: input.plannedQty,
          workerId: input.workerId,
          crimpCode: input.crimpCode,
          inputMaterialDetails: input.inputMaterialDetails,
        })

        const lot = result as unknown as LotWithRelations

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
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.createLot({
        processCode: input.processCode,
        productId: input.productId || 0,
        targetQuantity: input.plannedQty || 0,
        lineId: input.lineCode ? parseInt(input.lineCode) : undefined,
        workerId: input.workerId?.toString(),
        inputMaterialDetails: input.inputMaterialDetails?.map(m => ({
          materialId: 0,
          materialCode: m.materialCode || '',
          materialName: m.materialName || '',
          quantity: m.quantity || 0,
          lotNumber: m.barcode,
        })),
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || 'LOT 생성 실패')
      }

      const lot = result.data as unknown as LotWithRelations

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

  // 작업 시작 (Electron API)
  const startProduction = useCallback(async (
    lotId: number,
    lineCode: string,
    workerId?: number
  ): Promise<LotWithRelations> => {
    if (!hasBusinessAPI()) {
      throw new Error('Electron API not available')
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.startProduction(lotId)

      if (!result.success || !result.data) {
        throw new Error(result.error || '작업 시작 실패')
      }

      const lot = result.data as unknown as LotWithRelations

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

  // 작업 완료 (Electron API + 브라우저 Mock)
  // 완료 시점에 최종 LOT 번호가 생성됨 (형식: {공정코드}{반제품품번}Q{완료수량}-{YYMMDD}-{일련번호})
  const completeProduction = useCallback(async (input: CompleteLotInput): Promise<LotWithRelations> => {
    // 브라우저 모드: Mock 서비스 사용
    if (!hasBusinessAPI()) {
      console.log('[ProductionContext] Browser mode: Using mock completeProduction')
      setLoading(true)
      try {
        const result = await MockProductionService.completeProduction({
          lotId: input.lotId,
          completedQty: input.completedQty,
          defectQty: input.defectQty,
          semiProductCode: input.semiProductCode,
        })

        const lot = result as unknown as LotWithRelations

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
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.completeProduction(input.lotId, input.completedQty)

      if (!result.success || !result.data) {
        throw new Error(result.error || '작업 완료 실패')
      }

      const lot = result.data as unknown as LotWithRelations

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

  // 자재 투입 (Electron API)
  const addMaterial = useCallback(async (input: AddMaterialInput): Promise<void> => {
    if (!hasBusinessAPI()) {
      throw new Error('Electron API not available')
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.addMaterial(
        input.lotId,
        input.materialId,
        input.quantity,
        input.materialBarcode
      )

      if (!result.success || !result.data) {
        throw new Error(result.error || '자재 투입 실패')
      }

      // addMaterial IPC는 LotMaterial을 반환하므로 LOT을 다시 조회
      const lotResult = await api!.production.getLotById(input.lotId)
      if (!lotResult.success || !lotResult.data) {
        throw new Error(lotResult.error || 'LOT 조회 실패')
      }

      const lot = lotResult.data as unknown as LotWithRelations

      setState((prev) => ({
        ...prev,
        currentLot: prev.currentLot?.id === input.lotId ? lot : prev.currentLot,
        todayLots: prev.todayLots.map((l) => (l.id === input.lotId ? lot : l)),
        isLoading: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : '자재 투입 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 자재 투입 취소 (Electron API)
  const removeMaterial = useCallback(async (lotMaterialId: number): Promise<void> => {
    if (!hasBusinessAPI()) {
      throw new Error('Electron API not available')
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.removeMaterial(lotMaterialId)

      if (!result.success) {
        throw new Error(result.error || '자재 투입 취소 실패')
      }

      // 현재 LOT 새로고침
      if (state.currentLot) {
        const lotResult = await api!.production.getLotById(state.currentLot.id)
        const lot = lotResult.success && lotResult.data
          ? (lotResult.data as unknown as LotWithRelations)
          : null

        if (lot) {
          setState((prev) => ({
            ...prev,
            currentLot: lot,
            todayLots: prev.todayLots.map((l) => (l.id === lot!.id ? lot! : l)),
            isLoading: false,
          }))
        } else {
          setLoading(false)
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

  // LOT 번호로 조회 (Electron API)
  const getLotByNumber = useCallback(async (lotNumber: string): Promise<LotWithRelations | null> => {
    if (!hasBusinessAPI()) {
      return null
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.getLotByNumber(lotNumber)
      const lot = result.success && result.data
        ? (result.data as unknown as LotWithRelations)
        : null

      setLoading(false)
      return lot
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // LOT 목록 새로고침 (Electron API)
  const refreshTodayLots = useCallback(async (): Promise<void> => {
    if (!hasBusinessAPI()) {
      console.log('[ProductionContext] Electron API not available, skipping refresh')
      return
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.getLotsByProcess(state.currentProcess)
      const lots = result.success && result.data
        ? (result.data as unknown as LotWithRelations[])
        : []

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

  // 공정별 LOT 조회 (Electron API)
  const getLotsByProcess = useCallback(async (
    processCode: string,
    status?: LotStatus
  ): Promise<LotWithRelations[]> => {
    if (!hasBusinessAPI()) {
      return []
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.getLotsByProcess(processCode)
      let lots = result.success && result.data
        ? (result.data as unknown as LotWithRelations[])
        : []

      // 상태 필터링 (클라이언트 측)
      if (status) {
        lots = lots.filter((l) => l.status === status)
      }

      setLoading(false)
      return lots
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 상태별 LOT 조회 (Electron API)
  const getLotsByStatus = useCallback(async (status: LotStatus): Promise<LotWithRelations[]> => {
    if (!hasBusinessAPI()) {
      return []
    }

    setLoading(true)
    try {
      const api = getAPI()
      const result = await api!.production.getLotsByStatus(status)
      let lots = result.success && result.data
        ? (result.data as unknown as LotWithRelations[])
        : []

      // 공정 필터링 (클라이언트 측)
      lots = lots.filter((l) => l.processCode === state.currentProcess)

      setLoading(false)
      return lots
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LOT 조회 실패'
      setError(message)
      throw err
    }
  }, [state.currentProcess, setLoading, setError])

  // LOT 수량 업데이트 (Electron API)
  const updateLotQuantity = useCallback(async (
    lotId: number,
    updates: {
      plannedQty?: number
      completedQty?: number
      defectQty?: number
    }
  ): Promise<LotWithRelations> => {
    if (!hasBusinessAPI()) {
      throw new Error('Electron API not available')
    }

    setLoading(true)
    try {
      const api = getAPI()
      const quantity = updates.completedQty ?? updates.plannedQty ?? 0
      const result = await api!.production.updateLotQuantity(lotId, quantity)

      if (!result.success || !result.data) {
        throw new Error(result.error || '수량 업데이트 실패')
      }

      const lot = result.data as unknown as LotWithRelations

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
