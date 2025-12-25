/**
 * Purchase Order Context
 *
 * 발주서(일일 생산계획) 상태 관리 (Electron API + 브라우저 Mock 지원)
 * - Electron IPC를 통해 실제 DB 서비스 호출
 * - 브라우저 환경에서는 Mock 서비스 사용
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

// Electron API 헬퍼 함수
import { hasBusinessAPI } from '../../lib/electronBridge'

// 브라우저 모드용 Mock 서비스
import * as MockPurchaseOrderService from '../../services/mock/purchaseOrderService.mock'

// ============================================
// Types
// ============================================

export type PurchaseOrderStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type PurchaseOrderItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: number
  purchaseOrderId: number
  barcode: string
  productId: number
  productCode?: string
  productName?: string
  processCode: string
  plannedQty: number
  completedQty: number
  defectQty: number
  status: PurchaseOrderItemStatus
  crimpCode?: string
  lineCode?: string
  lineName?: string
  startedAt?: string
  completedAt?: string
  workerId?: number
  workerName?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrder {
  id: number
  orderNo: string
  orderDate: string
  status: PurchaseOrderStatus
  description?: string
  createdById?: number
  createdByName?: string
  createdAt: string
  updatedAt: string
  items?: PurchaseOrderItem[]
  // 완제품별 계획 수량 (완제품코드 → 계획수량)
  finishedProductQty?: Record<string, number>
}

// Input Types
export interface CreatePurchaseOrderInput {
  orderDate: Date
  description?: string
  createdById?: number
  // 완제품별 계획 수량 (완제품코드 → 계획수량)
  finishedProductQty?: Record<string, number>
}

export interface AddPurchaseOrderItemInput {
  purchaseOrderId: number
  productId: number
  productCode: string
  productName?: string
  processCode: string
  plannedQty: number
  crimpCode?: string
  lineCode?: string
  lineName?: string
}

export interface UpdateItemProgressInput {
  itemId: number
  completedQty: number
  defectQty?: number
}

// Progress Types
export interface ProcessProgress {
  processCode: string
  processName: string
  totalPlanned: number
  totalCompleted: number
  totalDefect: number
  progressPercent: number
  itemCount: number
  completedItems: number
}

// ============================================
// State
// ============================================

interface PurchaseOrderState {
  // 오늘의 발주서 목록
  todayOrders: PurchaseOrder[]
  // 선택된 발주서
  selectedOrder: PurchaseOrder | null
  // 공정별 진행률
  processProgress: ProcessProgress[]
  // 로딩 상태
  isLoading: boolean
  // 에러 메시지
  error: string | null
}

interface PurchaseOrderContextValue extends PurchaseOrderState {
  // 발주서 생성
  createPurchaseOrder: (input: CreatePurchaseOrderInput) => Promise<PurchaseOrder>
  // 발주서 아이템 추가
  addPurchaseOrderItem: (input: AddPurchaseOrderItemInput) => Promise<PurchaseOrderItem>
  // 발주서 조회 (ID)
  getPurchaseOrderById: (id: number) => Promise<PurchaseOrder | null>
  // 발주서 조회 (주문번호)
  getPurchaseOrderByNo: (orderNo: string) => Promise<PurchaseOrder | null>
  // 오늘의 발주서 조회
  getTodayPurchaseOrders: () => Promise<PurchaseOrder[]>
  // 기간별 발주서 조회
  getPurchaseOrdersByDateRange: (startDate: Date, endDate: Date) => Promise<PurchaseOrder[]>
  // 상태별 발주서 조회
  getPurchaseOrdersByStatus: (status: PurchaseOrderStatus) => Promise<PurchaseOrder[]>
  // 바코드로 아이템 조회
  getPurchaseOrderItemByBarcode: (barcode: string) => Promise<PurchaseOrderItem | null>
  // 아이템 작업 시작
  startPurchaseOrderItem: (itemId: number, workerId?: number, lineCode?: string) => Promise<PurchaseOrderItem>
  // 아이템 진행률 업데이트
  updatePurchaseOrderItemProgress: (input: UpdateItemProgressInput) => Promise<PurchaseOrderItem>
  // 아이템 완료
  completePurchaseOrderItem: (itemId: number) => Promise<PurchaseOrderItem>
  // 공정별 진행률 조회
  getProgressByProcess: (orderDate?: Date) => Promise<ProcessProgress[]>
  // 미완료 발주서 조회
  getIncompletePurchaseOrders: () => Promise<PurchaseOrder[]>
  // 발주서 선택
  setSelectedOrder: (order: PurchaseOrder | null) => void
  // 오늘의 발주서 새로고침
  refreshTodayOrders: () => Promise<void>
  // 공정별 진행률 새로고침
  refreshProcessProgress: () => Promise<void>
  // 에러 초기화
  clearError: () => void
  // 전체 초기화
  resetPurchaseOrders: () => number
  // 발주서 삭제
  deletePurchaseOrder: (id: number) => Promise<boolean>
  // 발주서 다중 삭제
  deletePurchaseOrders: (ids: number[]) => Promise<number>
}

// ============================================
// Context
// ============================================

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | undefined>(undefined)

// ============================================
// Type Converters (Mock Service Date → Context String)
// ============================================

function toISOStringOrUndefined(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined
  if (date instanceof Date) return date.toISOString()
  return date
}

function toISOString(date: Date | string): string {
  if (date instanceof Date) return date.toISOString()
  return date
}

// Mock 서비스의 PurchaseOrderItemWithProduct → Context의 PurchaseOrderItem
function convertMockItemToContextItem(mockItem: MockPurchaseOrderService.PurchaseOrderItemWithProduct): PurchaseOrderItem {
  return {
    id: mockItem.id,
    purchaseOrderId: mockItem.purchaseOrderId,
    barcode: mockItem.barcode,
    productId: mockItem.productId || mockItem.product?.id || 0,
    productCode: mockItem.productCode || mockItem.product?.code,
    productName: mockItem.productName || mockItem.product?.name,
    processCode: mockItem.processCode,
    plannedQty: mockItem.plannedQty,
    completedQty: mockItem.completedQty,
    defectQty: mockItem.defectQty,
    status: mockItem.status,
    crimpCode: mockItem.crimpCode || undefined,
    lineCode: mockItem.lineCode || undefined,
    lineName: mockItem.lineName || undefined,
    startedAt: toISOStringOrUndefined(mockItem.startedAt),
    completedAt: toISOStringOrUndefined(mockItem.completedAt),
    workerId: mockItem.worker?.id,
    workerName: mockItem.worker?.name,
    createdAt: toISOString(mockItem.createdAt),
    updatedAt: toISOString(mockItem.updatedAt),
  }
}

// Mock 서비스의 PurchaseOrderWithItems → Context의 PurchaseOrder
function convertMockOrderToContextOrder(mockOrder: MockPurchaseOrderService.PurchaseOrderWithItems): PurchaseOrder {
  return {
    id: mockOrder.id,
    orderNo: mockOrder.orderNo,
    orderDate: toISOString(mockOrder.orderDate),
    status: mockOrder.status,
    description: mockOrder.description || undefined,
    createdById: mockOrder.createdBy?.id,
    createdByName: mockOrder.createdBy?.name,
    createdAt: toISOString(mockOrder.createdAt),
    updatedAt: toISOString(mockOrder.updatedAt),
    items: mockOrder.items?.map(convertMockItemToContextItem),
    finishedProductQty: mockOrder.finishedProductQty,
  }
}

// Mock 서비스의 ProcessProgressSummary → Context의 ProcessProgress
function convertMockProgressToContextProgress(mockProgress: MockPurchaseOrderService.ProcessProgressSummary): ProcessProgress {
  return {
    processCode: mockProgress.processCode,
    processName: mockProgress.processName,
    totalPlanned: mockProgress.totalPlanned,
    totalCompleted: mockProgress.totalCompleted,
    totalDefect: mockProgress.totalDefect,
    progressPercent: mockProgress.progressPercent,
    itemCount: mockProgress.itemCount,
    completedItems: mockProgress.completedItems,
  }
}

// ============================================
// Provider
// ============================================

interface PurchaseOrderProviderProps {
  children: ReactNode
}

export function PurchaseOrderProvider({ children }: PurchaseOrderProviderProps) {
  const [state, setState] = useState<PurchaseOrderState>({
    todayOrders: [],
    selectedOrder: null,
    processProgress: [],
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

  // 발주서 선택
  const setSelectedOrder = useCallback((order: PurchaseOrder | null) => {
    setState((prev) => ({ ...prev, selectedOrder: order }))
  }, [])

  // 발주서 생성
  const createPurchaseOrder = useCallback(async (input: CreatePurchaseOrderInput): Promise<PurchaseOrder> => {
    setLoading(true)
    try {
      // Electron API 사용 가능 시 실제 서비스 호출
      if (hasBusinessAPI()) {
        // TODO: Electron IPC 구현 시 여기에 추가
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      // 브라우저 모드: Mock 서비스 사용
      console.log('[PurchaseOrderContext] Browser mode: Using mock createPurchaseOrder')
      const result = await MockPurchaseOrderService.createPurchaseOrder({
        orderDate: input.orderDate,
        description: input.description,
        createdById: input.createdById,
        finishedProductQty: input.finishedProductQty,
      })

      const order = convertMockOrderToContextOrder(result)

      setState((prev) => ({
        ...prev,
        todayOrders: [order, ...prev.todayOrders.filter(o => o.id !== order.id)],
        selectedOrder: order,
        isLoading: false,
      }))

      return order
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 생성 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 발주서 아이템 추가
  const addPurchaseOrderItem = useCallback(async (input: AddPurchaseOrderItemInput): Promise<PurchaseOrderItem> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      console.log('[PurchaseOrderContext] Browser mode: Using mock addPurchaseOrderItem')
      const result = await MockPurchaseOrderService.addPurchaseOrderItem({
        purchaseOrderId: input.purchaseOrderId,
        productId: input.productId,
        productCode: input.productCode,
        productName: input.productName,
        processCode: input.processCode,
        plannedQty: input.plannedQty,
        crimpCode: input.crimpCode,
        lineCode: input.lineCode,
        lineName: input.lineName,
      })

      const item = convertMockItemToContextItem(result)

      // 선택된 발주서 업데이트
      if (state.selectedOrder && state.selectedOrder.id === input.purchaseOrderId) {
        const updatedOrder = {
          ...state.selectedOrder,
          items: [...(state.selectedOrder.items || []), item],
        }
        setState((prev) => ({
          ...prev,
          selectedOrder: updatedOrder,
          todayOrders: prev.todayOrders.map(o =>
            o.id === input.purchaseOrderId ? updatedOrder : o
          ),
          isLoading: false,
        }))
      } else {
        setLoading(false)
      }

      return item
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 아이템 추가 실패'
      setError(message)
      throw err
    }
  }, [state.selectedOrder, setLoading, setError])

  // 발주서 조회 (ID)
  const getPurchaseOrderById = useCallback(async (id: number): Promise<PurchaseOrder | null> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getPurchaseOrderById(id)
      setLoading(false)
      return result ? convertMockOrderToContextOrder(result) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 발주서 조회 (주문번호)
  const getPurchaseOrderByNo = useCallback(async (orderNo: string): Promise<PurchaseOrder | null> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getPurchaseOrderByNo(orderNo)
      setLoading(false)
      return result ? convertMockOrderToContextOrder(result) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 오늘의 발주서 조회
  const getTodayPurchaseOrders = useCallback(async (): Promise<PurchaseOrder[]> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getTodayPurchaseOrders()
      const orders = result.map(convertMockOrderToContextOrder)

      setState((prev) => ({
        ...prev,
        todayOrders: orders,
        isLoading: false,
      }))

      return orders
    } catch (err) {
      const message = err instanceof Error ? err.message : '오늘의 발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 기간별 발주서 조회
  const getPurchaseOrdersByDateRange = useCallback(async (startDate: Date, endDate: Date): Promise<PurchaseOrder[]> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getPurchaseOrdersByDateRange(startDate, endDate)
      setLoading(false)
      return result.map(convertMockOrderToContextOrder)
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 상태별 발주서 조회
  const getPurchaseOrdersByStatus = useCallback(async (status: PurchaseOrderStatus): Promise<PurchaseOrder[]> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getPurchaseOrdersByStatus(status)
      setLoading(false)
      return result.map(convertMockOrderToContextOrder)
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 바코드로 아이템 조회
  const getPurchaseOrderItemByBarcode = useCallback(async (barcode: string): Promise<PurchaseOrderItem | null> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getPurchaseOrderItemByBarcode(barcode)
      setLoading(false)
      return result ? convertMockItemToContextItem(result) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 아이템 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 아이템 작업 시작
  const startPurchaseOrderItem = useCallback(async (
    itemId: number,
    workerId?: number,
    lineCode?: string
  ): Promise<PurchaseOrderItem> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.startPurchaseOrderItem(itemId, workerId, lineCode)
      const item = convertMockItemToContextItem(result)

      // 상태 업데이트
      setState((prev) => {
        const updatedOrders = prev.todayOrders.map(order => {
          if (order.items?.some(i => i.id === itemId)) {
            return {
              ...order,
              status: 'IN_PROGRESS' as PurchaseOrderStatus,
              items: order.items.map(i => i.id === itemId ? item : i),
            }
          }
          return order
        })

        const updatedSelected = prev.selectedOrder?.items?.some(i => i.id === itemId)
          ? {
              ...prev.selectedOrder,
              status: 'IN_PROGRESS' as PurchaseOrderStatus,
              items: prev.selectedOrder.items?.map(i => i.id === itemId ? item : i),
            }
          : prev.selectedOrder

        return {
          ...prev,
          todayOrders: updatedOrders,
          selectedOrder: updatedSelected,
          isLoading: false,
        }
      })

      return item
    } catch (err) {
      const message = err instanceof Error ? err.message : '작업 시작 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 아이템 진행률 업데이트
  const updatePurchaseOrderItemProgress = useCallback(async (input: UpdateItemProgressInput): Promise<PurchaseOrderItem> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.updatePurchaseOrderItemProgress(
        input.itemId,
        input.completedQty,
        input.defectQty
      )
      const item = convertMockItemToContextItem(result)

      // 상태 업데이트
      setState((prev) => {
        const updatedOrders = prev.todayOrders.map(order => {
          if (order.items?.some(i => i.id === input.itemId)) {
            return {
              ...order,
              items: order.items.map(i => i.id === input.itemId ? item : i),
            }
          }
          return order
        })

        const updatedSelected = prev.selectedOrder?.items?.some(i => i.id === input.itemId)
          ? {
              ...prev.selectedOrder,
              items: prev.selectedOrder.items?.map(i => i.id === input.itemId ? item : i),
            }
          : prev.selectedOrder

        return {
          ...prev,
          todayOrders: updatedOrders,
          selectedOrder: updatedSelected,
          isLoading: false,
        }
      })

      return item
    } catch (err) {
      const message = err instanceof Error ? err.message : '진행률 업데이트 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 아이템 완료
  const completePurchaseOrderItem = useCallback(async (itemId: number): Promise<PurchaseOrderItem> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      // Find item from todayOrders to get current values
      let completedQty = 0
      let defectQty = 0
      for (const order of state.todayOrders) {
        const found = order.items?.find(i => i.id === itemId)
        if (found) {
          completedQty = found.plannedQty  // Mark as fully completed
          defectQty = found.defectQty || 0
          break
        }
      }

      const result = await MockPurchaseOrderService.completePurchaseOrderItem(itemId, completedQty, defectQty)
      const item = convertMockItemToContextItem(result)

      // 상태 업데이트
      setState((prev) => {
        const updatedOrders = prev.todayOrders.map(order => {
          if (order.items?.some(i => i.id === itemId)) {
            const updatedItems = order.items.map(i => i.id === itemId ? item : i)
            const allCompleted = updatedItems.every(i => i.status === 'COMPLETED')
            return {
              ...order,
              status: allCompleted ? 'COMPLETED' as PurchaseOrderStatus : order.status,
              items: updatedItems,
            }
          }
          return order
        })

        const updatedSelected = prev.selectedOrder?.items?.some(i => i.id === itemId)
          ? {
              ...prev.selectedOrder,
              items: prev.selectedOrder.items?.map(i => i.id === itemId ? item : i),
            }
          : prev.selectedOrder

        return {
          ...prev,
          todayOrders: updatedOrders,
          selectedOrder: updatedSelected,
          isLoading: false,
        }
      })

      return item
    } catch (err) {
      const message = err instanceof Error ? err.message : '완료 처리 실패'
      setError(message)
      throw err
    }
  }, [state.todayOrders, setLoading, setError])

  // 공정별 진행률 조회
  const getProgressByProcess = useCallback(async (orderDate?: Date): Promise<ProcessProgress[]> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getProgressByProcess(orderDate)
      const progress = result.map(convertMockProgressToContextProgress)

      setState((prev) => ({
        ...prev,
        processProgress: progress,
        isLoading: false,
      }))

      return progress
    } catch (err) {
      const message = err instanceof Error ? err.message : '공정별 진행률 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 미완료 발주서 조회
  const getIncompletePurchaseOrders = useCallback(async (): Promise<PurchaseOrder[]> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const result = await MockPurchaseOrderService.getIncompletePurchaseOrders()
      setLoading(false)
      return result.map(convertMockOrderToContextOrder)
    } catch (err) {
      const message = err instanceof Error ? err.message : '미완료 발주서 조회 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 오늘의 발주서 새로고침
  const refreshTodayOrders = useCallback(async (): Promise<void> => {
    await getTodayPurchaseOrders()
  }, [getTodayPurchaseOrders])

  // 공정별 진행률 새로고침
  const refreshProcessProgress = useCallback(async (): Promise<void> => {
    await getProgressByProcess()
  }, [getProgressByProcess])

  // 전체 초기화
  const resetPurchaseOrders = useCallback(() => {
    const count = state.todayOrders.length
    setState({
      todayOrders: [],
      selectedOrder: null,
      processProgress: [],
      isLoading: false,
      error: null,
    })

    // Mock 서비스의 데이터도 초기화
    if (!hasBusinessAPI()) {
      MockPurchaseOrderService.resetPurchaseOrderData()
    }

    return count
  }, [state.todayOrders.length])

  // 발주서 삭제
  const deletePurchaseOrder = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      const success = await MockPurchaseOrderService.deletePurchaseOrder(id)

      if (success) {
        setState((prev) => ({
          ...prev,
          todayOrders: prev.todayOrders.filter(o => o.id !== id),
          selectedOrder: prev.selectedOrder?.id === id ? null : prev.selectedOrder,
          isLoading: false,
        }))
      } else {
        setLoading(false)
      }

      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 삭제 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 발주서 다중 삭제
  const deletePurchaseOrders = useCallback(async (ids: number[]): Promise<number> => {
    setLoading(true)
    try {
      if (hasBusinessAPI()) {
        throw new Error('Electron API not yet implemented for purchase orders')
      }

      let deletedCount = 0
      for (const id of ids) {
        const success = await MockPurchaseOrderService.deletePurchaseOrder(id)
        if (success) deletedCount++
      }

      setState((prev) => ({
        ...prev,
        todayOrders: prev.todayOrders.filter(o => !ids.includes(o.id)),
        selectedOrder: prev.selectedOrder && ids.includes(prev.selectedOrder.id) ? null : prev.selectedOrder,
        isLoading: false,
      }))

      return deletedCount
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 삭제 실패'
      setError(message)
      throw err
    }
  }, [setLoading, setError])

  // 초기 로드
  useEffect(() => {
    refreshTodayOrders().catch(console.error)
    refreshProcessProgress().catch(console.error)
  }, [])

  const value: PurchaseOrderContextValue = {
    ...state,
    createPurchaseOrder,
    addPurchaseOrderItem,
    getPurchaseOrderById,
    getPurchaseOrderByNo,
    getTodayPurchaseOrders,
    getPurchaseOrdersByDateRange,
    getPurchaseOrdersByStatus,
    getPurchaseOrderItemByBarcode,
    startPurchaseOrderItem,
    updatePurchaseOrderItemProgress,
    completePurchaseOrderItem,
    getProgressByProcess,
    getIncompletePurchaseOrders,
    setSelectedOrder,
    refreshTodayOrders,
    refreshProcessProgress,
    clearError,
    resetPurchaseOrders,
    deletePurchaseOrder,
    deletePurchaseOrders,
  }

  return (
    <PurchaseOrderContext.Provider value={value}>
      {children}
    </PurchaseOrderContext.Provider>
  )
}

// ============================================
// Hook
// ============================================

export function usePurchaseOrder(): PurchaseOrderContextValue {
  const context = useContext(PurchaseOrderContext)
  if (!context) {
    throw new Error('usePurchaseOrder must be used within a PurchaseOrderProvider')
  }
  return context
}

export default PurchaseOrderContext
