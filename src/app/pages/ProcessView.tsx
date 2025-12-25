/**
 * Process View Page
 *
 * 공정 모니터링 (DB 연동)
 * - ProductionContext 연동
 * - 2단계 워크플로우: 스캔 → 임시 목록 → 선택 → 승인
 * - 전공정 바코드 투입 자재 등록
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Play,
  Square,
  RotateCcw,
  Printer,
  ScanLine,
  History,
  Factory,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Package,
  Check,
  AlertTriangle,
  FileText,
  Search,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useProduction } from '../context/ProductionContext'
import { useAuth } from '../context/AuthContext'
import { useProduct } from '../context/ProductContext'
import { useBOM } from '../context/BOMContext'
import { useMaterial } from '../context/MaterialContext'
import { parseBarcode, parseHQBarcode, getProcessName, generateBarcodeV2, isTempLotNumber, parsePOBarcode, isPOBarcode } from '@/services/barcodeService'
import { hasBusinessAPI, getAPI } from '@/lib/electronBridge'
import { useStock, type ProcessStockStatus, type ScanToProcessInput } from '../context/StockContext'
import { type LotWithRelations } from '../context/ProductionContext'
import { usePurchaseOrder } from '../context/PurchaseOrderContext'
import { BundleDialog, LabelPreviewDialog, DocumentPreviewDialog, type DocumentData, type InputMaterialInfo } from '../components/dialogs'
import { createLabel, printLabel, downloadLabel } from '@/services/labelService'

// Line 타입 (Electron API 반환값)
interface Line {
  id: number
  code: string
  name: string
  processCode: string
  isActive: boolean
}

// 스캔된 아이템 타입
interface ScannedItem {
  id: string
  barcode: string
  processCode: string
  productCode?: string
  quantity: number
  type: 'material' | 'semi_product' | 'production'
  scannedAt: Date
  isSelected: boolean
  // BOM 검증용 추가 필드
  materialId?: number
  materialCode?: string
  materialName?: string
  isValidMaterial?: boolean  // BOM에 등록된 자재인지 여부
}

// 진행 중인 작업 타입
interface InProgressTask {
  id: number
  lotNumber: string
  productCode: string
  productName: string
  lineCode: string | null
  plannedQty: number
  completedQty: number
  defectQty: number
  startedAt: Date
  crimpCode?: string
  inputMaterialCount: number
}

export const ProcessView = () => {
  const { processId } = useParams<{ processId: string }>()
  const { user } = useAuth()
  const { products } = useProduct()
  const { bomItems, bomGroups, getBOMByProduct, getBOMByLevel } = useBOM()
  const { materials, getMaterialByCode, getMaterialByHQCode } = useMaterial()
  const {
    currentLot,
    todayLots,
    isLoading,
    error,
    createLot,
    startProduction,
    completeProduction,
    getLotByNumber,
    getLotsByProcess,
    setCurrentLot,
    setCurrentProcess,
    refreshTodayLots,
    clearError,
    deleteLot,
  } = useProduction()
  const {
    deductByBOM,
    rollbackBOMDeduction,
    scanToProcess,
    checkProcessStockStatus,
  } = useStock()
  const {
    getPurchaseOrderItemByBarcode,
    startPurchaseOrderItem,
    updatePurchaseOrderItemProgress,
  } = usePurchaseOrder()

  const [barcode, setBarcode] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [completedQty, setCompletedQty] = useState<number>(0)
  const [defectQty, setDefectQty] = useState<number>(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBundleDialog, setShowBundleDialog] = useState(false)
  const [showLabelDialog, setShowLabelDialog] = useState(false)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Phase 6: 스캔 임시 목록 상태
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 작업 목록 필터 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'IN_PROGRESS' | 'COMPLETED'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 최근 작업에서 선택한 LOT (전표/라벨/묶음 출력용)
  const [selectedHistoryLot, setSelectedHistoryLot] = useState<LotWithRelations | null>(null)

  // 다중 작업 지원: 진행 중인 작업 목록
  const [inProgressTasks, setInProgressTasks] = useState<LotWithRelations[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  // 발주서 바코드 스캔 시 현재 아이템
  const [currentPOItem, setCurrentPOItem] = useState<{
    id: number
    barcode: string
    productCode: string
    processCode: string
    plannedQty: number
    crimpCode?: string
  } | null>(null)

  // 작업 선택 상태: 완제품 + 절압착 품번 (바코드 스캔으로 자동 선택)
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [selectedCrimpCode, setSelectedCrimpCode] = useState('')

  const processCode = processId?.toUpperCase() || 'CA'
  const processName = getProcessName(processCode)

  // 선택한 완제품 정보
  const selectedProduct = products.find(p => p.code === selectedProductCode)

  // 선택한 완제품의 절압착 품번 목록 (BOM LV4 CA)
  const crimpCodes = useMemo(() => {
    if (!selectedProductCode) return []

    const bomGroup = bomGroups.find(g => g.productCode === selectedProductCode)
    if (!bomGroup) return []

    // LV4 (CA) 그룹에서 crimpCode 목록 추출
    const lv4Group = bomGroup.levelGroups.find(lg => lg.level === 4)
    if (!lv4Group?.crimpGroups) return []

    return lv4Group.crimpGroups.map(cg => cg.crimpCode).filter(code => code !== '(미지정)')
  }, [selectedProductCode, bomGroups])

  // 번들 다이얼로그용 절압착품번 목록 (현재 선택 또는 히스토리 LOT 기반)
  const bundleCrimpProducts = useMemo(() => {
    // 현재 선택된 완제품의 절압착품번 사용
    if (crimpCodes.length > 0) {
      return crimpCodes.map(code => ({
        code,
        name: code,
        parentProductCode: selectedProductCode,
        parentProductName: selectedProduct?.name,
      }))
    }

    // 히스토리 LOT에서 절압착품번 추출
    if (selectedHistoryLot?.crimpCode) {
      return [{
        code: selectedHistoryLot.crimpCode,
        name: selectedHistoryLot.crimpCode,
        parentProductCode: selectedHistoryLot.productCode,
        parentProductName: selectedHistoryLot.productName,
      }]
    }

    // 히스토리 LOT의 완제품으로 BOM에서 검색
    const historyProductCode = selectedHistoryLot?.productCode
    if (historyProductCode) {
      const bomGroup = bomGroups.find(g => g.productCode === historyProductCode)
      if (bomGroup) {
        const lv4Group = bomGroup.levelGroups.find(lg => lg.level === 4)
        if (lv4Group?.crimpGroups) {
          return lv4Group.crimpGroups
            .map(cg => cg.crimpCode)
            .filter(code => code !== '(미지정)')
            .map(code => ({
              code,
              name: code,
              parentProductCode: historyProductCode,
              parentProductName: selectedHistoryLot?.productName,
            }))
        }
      }
    }

    return []
  }, [crimpCodes, selectedProductCode, selectedProduct, selectedHistoryLot, bomGroups])

  // CA 공정에서 허용된 자재 목록 (BOM LV4 기반)
  const allowedMaterialCodes = useMemo(() => {
    if (processCode !== 'CA' || !selectedProductCode) return new Set<string>()

    const bomGroup = bomGroups.find(g => g.productCode === selectedProductCode)
    if (!bomGroup) return new Set<string>()

    // LV4 (CA) 그룹에서 모든 자재 코드 추출
    const lv4Group = bomGroup.levelGroups.find(lg => lg.level === 4)
    if (!lv4Group) return new Set<string>()

    const materialCodes = new Set<string>()

    // crimpCode별로 자재 수집
    if (selectedCrimpCode && lv4Group.crimpGroups) {
      // 특정 절압착 품번 선택 시 해당 자재만
      const crimpGroup = lv4Group.crimpGroups.find(cg => cg.crimpCode === selectedCrimpCode)
      if (crimpGroup) {
        crimpGroup.items.forEach(item => materialCodes.add(item.materialCode))
      }
    } else {
      // 전체 LV4 자재
      lv4Group.items.forEach(item => materialCodes.add(item.materialCode))
    }

    return materialCodes
  }, [processCode, selectedProductCode, selectedCrimpCode, bomGroups])

  // 작업 목록 필터링
  const filteredLots = useMemo(() => {
    let filtered = [...todayLots]

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lot => lot.status === statusFilter)
    }

    // 검색 필터 (LOT 번호, 품번)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(lot =>
        lot.lotNumber.toLowerCase().includes(query) ||
        lot.productCode?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [todayLots, statusFilter, searchQuery])

  // 공정 변경 시 초기화
  useEffect(() => {
    setCurrentProcess(processCode)
    loadLines()
    loadInProgressTasks()
    refreshTodayLots()
    setCurrentLot(null)
    setCompletedQty(0)
    setDefectQty(0)
    setScannedItems([])
    setSelectAll(false)
    // 작업 선택 초기화
    setSelectedProductCode('')
    setSelectedCrimpCode('')
    setSelectedTaskId(null)
  }, [processCode])

  // 라인 목록 로드 (Electron API + 브라우저 기본 라인)
  const loadLines = async () => {
    // 브라우저 환경: 기본 라인 제공
    if (!hasBusinessAPI()) {
      console.log('[ProcessView] Browser mode: 기본 라인 제공')
      const defaultLines: Line[] = [
        { id: 1, code: `${processCode}-L1`, name: `${processCode} 라인 1`, processCode, isActive: true },
        { id: 2, code: `${processCode}-L2`, name: `${processCode} 라인 2`, processCode, isActive: true },
        { id: 3, code: `${processCode}-L3`, name: `${processCode} 라인 3`, processCode, isActive: true },
      ]
      setLines(defaultLines)
      setCurrentLine(defaultLines[0])
      return
    }

    // Electron 환경: DB에서 라인 로드
    try {
      const api = getAPI()
      const result = await api!.line.getByProcess(processCode)
      if (result.success && result.data) {
        const lineList = result.data as Line[]
        setLines(lineList)
        if (lineList.length > 0) {
          setCurrentLine(lineList[0])
        }
      }
    } catch (err) {
      console.error('Failed to load lines:', err)
    }
  }

  // 진행 중인 작업 목록 로드 (ProductionContext 사용)
  const loadInProgressTasks = async () => {
    try {
      const tasks = await getLotsByProcess(processCode, 'IN_PROGRESS')
      setInProgressTasks(tasks)
    } catch (err) {
      console.error('Failed to load in-progress tasks:', err)
    }
  }

  // 작업 선택 핸들러
  const handleSelectTask = (task: LotWithRelations) => {
    setSelectedTaskId(task.id)
    setCurrentLot(task)
    setCompletedQty(task.completedQty || 0)
    setDefectQty(task.defectQty || 0)
    // 선택한 작업의 완제품 정보로 작업 선택 상태 업데이트
    if (task.productCode) {
      setSelectedProductCode(task.productCode)
    }
    toast.info(`작업 ${task.lotNumber} 선택됨`)
  }

  // 새 작업 시작 (작업 목록에서 해제)
  const handleNewTask = () => {
    setSelectedTaskId(null)
    setCurrentLot(null)
    setCompletedQty(0)
    setDefectQty(0)
    setScannedItems([])
    setSelectAll(false)
    // 작업 선택 초기화
    setSelectedProductCode('')
    setSelectedCrimpCode('')
    barcodeInputRef.current?.focus()
  }

  // 바코드 입력 자동 포커스 (컴포넌트 마운트 및 공정 변경 시)
  useEffect(() => {
    // 약간의 딜레이를 주어 DOM이 완전히 렌더링된 후 포커스
    const timer = setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [processId])

  // 자동 스캔 타이머 참조
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 바코드 붙여넣기 핸들러 - 자동 등록
  const handleBarcodePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text').trim()
    if (pastedText && pastedText.length >= 5) {
      // 붙여넣기 후 짧은 딜레이로 자동 제출
      setTimeout(() => {
        const form = e.currentTarget.form
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
      }, 100)
    }
  }, [])

  // 바코드 입력 변경 핸들러 - 스캐너 자동 감지
  const handleBarcodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBarcode(value)

    // 기존 타이머 취소
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current)
    }

    // 바코드가 일정 길이 이상이면 자동 제출 (스캐너는 빠르게 입력)
    if (value.trim().length >= 10) {
      autoScanTimerRef.current = setTimeout(() => {
        const form = e.target.form
        if (form && value.trim().length >= 10) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
      }, 300) // 300ms 후 자동 제출 (스캐너 입력 완료 대기)
    }
  }, [])

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current)
      }
    }
  }, [])

  // 바코드 타입 추론
  const inferBarcodeType = (barcode: string, parsed: ReturnType<typeof parseBarcode>): ScannedItem['type'] => {
    if (!parsed.isValid) return 'material'

    const code = parsed.processCode.toUpperCase()

    // 검사 공정 바코드는 production
    if (code === 'CI' || code === 'VI') {
      return 'production'
    }

    // 생산 공정 바코드는 semi_product
    if (['CA', 'MC', 'MS', 'SB', 'HS', 'SP', 'PA'].includes(code)) {
      return 'semi_product'
    }

    // MO나 기타는 material
    return 'material'
  }

  // 바코드 스캔 처리 - 공정 재고 자동 등록 + 임시 목록에 추가
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim()) return

    const trimmedBarcode = barcode.trim()

    // ===== PO(발주서) 바코드 처리 =====
    if (isPOBarcode(trimmedBarcode)) {
      const poParsed = parsePOBarcode(trimmedBarcode)
      if (poParsed) {
        // 발주서 아이템 조회
        const poItem = await getPurchaseOrderItemByBarcode(trimmedBarcode)
        if (!poItem) {
          toast.error('등록되지 않은 발주서 바코드입니다.')
          setBarcode('')
          setTimeout(() => barcodeInputRef.current?.focus(), 50)
          return
        }

        // 공정 코드 검증
        if (poItem.processCode !== processCode) {
          toast.error(`이 발주서는 ${poItem.processCode} 공정용입니다. 현재 공정: ${processCode}`)
          setBarcode('')
          setTimeout(() => barcodeInputRef.current?.focus(), 50)
          return
        }

        // 이미 완료된 아이템인지 확인
        if (poItem.status === 'COMPLETED') {
          toast.warning('이미 완료된 발주서 아이템입니다.')
          setBarcode('')
          setTimeout(() => barcodeInputRef.current?.focus(), 50)
          return
        }

        // 자동으로 완제품/절압착 품번 선택
        const productCode = poItem.crimpCode
          ? poItem.productCode?.replace(`-${poItem.crimpCode.split('-').pop()}`, '') || poParsed.productCode
          : poParsed.productCode

        // 완제품 찾기
        const product = products.find(p =>
          p.code === productCode ||
          p.code === poItem.productCode
        )

        if (product) {
          setSelectedProductCode(product.code)
        } else {
          // 품번으로 직접 설정
          setSelectedProductCode(poParsed.productCode)
        }

        // CA 공정: 절압착 품번 자동 선택
        if (processCode === 'CA' && poItem.crimpCode) {
          setSelectedCrimpCode(poItem.crimpCode)
        }

        // 발주서 아이템 작업 시작
        try {
          await startPurchaseOrderItem(poItem.id, user?.id ? Number(user.id) : undefined, currentLine?.code)
          setCurrentPOItem({
            id: poItem.id,
            barcode: trimmedBarcode,
            productCode: poItem.productCode || poParsed.productCode,
            processCode: poItem.processCode,
            plannedQty: poItem.plannedQty,
            crimpCode: poItem.crimpCode,
          })

          toast.success(
            `발주서 스캔 완료\n품번: ${poItem.productCode || poParsed.productCode}\n계획수량: ${poParsed.quantity}개`,
            { duration: 4000 }
          )
        } catch (err) {
          console.error('발주서 아이템 시작 실패:', err)
          // 시작 실패해도 선택은 유지
        }

        setBarcode('')
        setCompletedQty(poParsed.quantity) // 계획수량으로 초기화
        setTimeout(() => barcodeInputRef.current?.focus(), 50)
        return
      }
    }

    // ===== 전공정 바코드 처리 (CA 제외 공정) =====
    // MC, SB, SP, PA 등: 이전 공정 바코드 스캔 시 작업 자동 등록
    if (processCode !== 'CA') {
      const parsed = parseBarcode(trimmedBarcode)

      // 유효한 생산 바코드인지 확인 (V1 또는 V2)
      if (parsed.isValid && parsed.processCode && parsed.processCode !== 'UNKNOWN') {
        const prevProcessCode = parsed.processCode

        // 공정 순서 정의 (현재 공정보다 앞선 공정만 허용)
        const processOrder = ['CA', 'MC', 'MS', 'SB', 'HS', 'SP', 'PA', 'CI', 'VI']
        const currentIdx = processOrder.indexOf(processCode)
        const prevIdx = processOrder.indexOf(prevProcessCode)

        // 이전 공정 바코드인지 확인
        if (prevIdx >= 0 && prevIdx < currentIdx) {
          // 완제품 품번 추출
          const productCodeFromBarcode = parsed.productCode

          if (productCodeFromBarcode) {
            // 완제품 찾기
            const product = products.find(p =>
              p.code === productCodeFromBarcode ||
              p.code.startsWith(productCodeFromBarcode.split('-')[0]) // 절압착 품번에서 완제품 추출
            )

            if (product) {
              setSelectedProductCode(product.code)
            } else {
              // 절압착 품번이면 완제품 코드만 추출
              const finishedProductCode = productCodeFromBarcode.includes('-')
                ? productCodeFromBarcode.split('-')[0]
                : productCodeFromBarcode
              setSelectedProductCode(finishedProductCode)
            }

            // 수량 설정
            if (parsed.quantity) {
              setCompletedQty(parsed.quantity)
            }

            toast.success(
              `전공정(${prevProcessCode}) 바코드 스캔\n품번: ${productCodeFromBarcode}\n수량: ${parsed.quantity || '미지정'}`,
              { duration: 4000 }
            )

            setBarcode('')
            setTimeout(() => barcodeInputRef.current?.focus(), 50)
            return
          }
        }
      }
    }

    // 선행 조건 검증: CA 공정에서는 발주서 바코드 스캔으로 완제품 선택 필수
    if (processCode === 'CA' && !selectedProductCode) {
      toast.error('먼저 발주서 바코드를 스캔하세요.')
      setBarcode('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    // 라인 선택 검증
    if (!currentLine) {
      toast.error('라인을 선택해주세요.')
      setBarcode('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    // 중복 체크 (현재 스캔 목록에서)
    if (scannedItems.some(item => item.barcode === trimmedBarcode)) {
      toast.error('이미 스캔된 바코드입니다.')
      setBarcode('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    // 바코드 파싱 (MES 바코드 또는 본사/생산처 바코드)
    const parsed = parseBarcode(trimmedBarcode)
    const hqParsed = parseHQBarcode(trimmedBarcode)
    const itemType = inferBarcodeType(trimmedBarcode, parsed)

    // production/semi_product 바코드 DB 검증
    if ((itemType === 'production' || itemType === 'semi_product') && parsed.isValid) {
      if (hasBusinessAPI()) {
        try {
          const api = getAPI()
          const result = await api!.production.getLotByNumber(trimmedBarcode)
          if (!result.success || !result.data) {
            // DB에 LOT이 없으면 경고 (스캔은 허용)
            toast.warning(
              `DB에 등록되지 않은 LOT입니다: ${trimmedBarcode}\n(새로운 생산 LOT으로 등록됩니다)`,
              { duration: 4000 }
            )
          } else {
            // DB에 LOT이 있으면 정보 표시
            const lot = result.data as LotWithRelations
            toast.info(
              `기존 LOT 확인: ${lot.lotNumber}\n상태: ${lot.status}, 수량: ${lot.completedQty}/${lot.plannedQty}`,
              { duration: 3000 }
            )
          }
        } catch (error) {
          console.error('LOT 조회 실패:', error)
          // 조회 실패해도 스캔은 진행
        }
      }
    }

    // 자재 조회 (바코드에서 추출한 코드로 검색)
    let matchedMaterial = null
    let extractedCode = ''

    if (hqParsed.isValid && hqParsed.materialCode) {
      extractedCode = hqParsed.materialCode
      matchedMaterial = getMaterialByHQCode(extractedCode)
    }

    // MES 바코드인 경우 품번으로도 검색
    if (!matchedMaterial && parsed.isValid && parsed.productCode) {
      matchedMaterial = getMaterialByCode(parsed.productCode)
    }

    // CA 공정에서 BOM 자재 검증
    let isValidMaterial = true
    if (processCode === 'CA' && selectedProductCode) {
      if (matchedMaterial) {
        // BOM에 등록된 자재인지 확인
        isValidMaterial = allowedMaterialCodes.has(matchedMaterial.code)
        if (!isValidMaterial) {
          toast.error(
            `이 자재(${matchedMaterial.code})는 선택한 완제품(${selectedProductCode})의 BOM에 등록되지 않았습니다.`,
            { duration: 5000 }
          )
          setBarcode('')
          setTimeout(() => barcodeInputRef.current?.focus(), 50)
          return
        }
      } else if (allowedMaterialCodes.size > 0) {
        // 자재를 찾지 못한 경우 경고
        toast.warning(
          `자재를 찾을 수 없습니다: ${extractedCode || trimmedBarcode}`,
          { duration: 3000 }
        )
        // 등록되지 않은 자재도 일단 추가 (경고만)
        isValidMaterial = false
      }
    }

    // Phase 5: 생산창고 → 공정재고 이동
    const quantity = hqParsed.quantity || (parsed.isValid ? (parsed.quantity || 1) : 1)

    // 공정 재고 상태 확인 (이미 소진된 LOT인지)
    const stockStatus = await checkProcessStockStatus(processCode, trimmedBarcode)

    if (stockStatus.isExhausted) {
      // 이미 소진된 LOT - 경고 메시지 표시
      toast.error(
        `이미 사용이 완료된 바코드입니다.\n(LOT: ${trimmedBarcode}, 사용량: ${stockStatus.usedQty})`,
        { duration: 5000 }
      )
      setBarcode('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    // 생산창고 → 공정재고 이동 (scanToProcess)
    if (matchedMaterial && isValidMaterial) {
      const scanInput: ScanToProcessInput = {
        processCode,
        materialId: matchedMaterial.id,
        materialCode: matchedMaterial.code,
        materialName: matchedMaterial.name,
        lotNumber: trimmedBarcode,
        quantity,
      }

      const scanResult = await scanToProcess(scanInput)

      if (!scanResult.success) {
        toast.error(scanResult.error || '공정 스캔 실패')
        setBarcode('')
        setTimeout(() => barcodeInputRef.current?.focus(), 50)
        return
      }

      // 생산창고에서 차감된 수량 알림
      if (scanResult.productionStock) {
        toast.info(
          `생산창고 잔여: ${scanResult.productionStock.availableQty}개`,
          { duration: 2000 }
        )
      }
    }

    // 임시 목록에 추가
    const newItem: ScannedItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      barcode: trimmedBarcode,
      processCode: parsed.isValid ? parsed.processCode : 'UNKNOWN',
      productCode: parsed.isValid ? parsed.productCode : undefined,
      quantity,
      type: itemType,
      scannedAt: new Date(),
      isSelected: isValidMaterial, // BOM 미등록 자재는 기본 선택 해제
      // BOM 검증 정보
      materialId: matchedMaterial?.id,
      materialCode: matchedMaterial?.code,
      materialName: matchedMaterial?.name,
      isValidMaterial,
    }

    setScannedItems(prev => [...prev, newItem])

    if (isValidMaterial) {
      toast.success(`스캔 완료: ${matchedMaterial?.code || trimmedBarcode}`)
    }
    setBarcode('')

    // 연속 스캔을 위해 바코드 입력 필드에 포커스 복귀
    setTimeout(() => barcodeInputRef.current?.focus(), 50)

    // 전체 선택 상태 업데이트
    setSelectAll(scannedItems.every(item => item.isSelected) && isValidMaterial)
  }

  // 개별 선택 토글
  const toggleItemSelection = (itemId: string) => {
    setScannedItems(prev => {
      const updated = prev.map(item =>
        item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
      )
      // 전체 선택 상태 업데이트
      setSelectAll(updated.every(item => item.isSelected))
      return updated
    })
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    setScannedItems(prev => prev.map(item => ({ ...item, isSelected: newSelectAll })))
  }

  // 개별 삭제
  const removeItem = (itemId: string) => {
    setScannedItems(prev => {
      const updated = prev.filter(item => item.id !== itemId)
      if (updated.length > 0) {
        setSelectAll(updated.every(item => item.isSelected))
      } else {
        setSelectAll(false)
      }
      return updated
    })
  }

  // 전체 삭제
  const clearAllItems = () => {
    if (scannedItems.length === 0) return

    if (window.confirm('모든 스캔 항목을 삭제하시겠습니까?')) {
      setScannedItems([])
      setSelectAll(false)
      toast.info('모든 항목이 삭제되었습니다.')
    }
  }

  // 선택 삭제
  const deleteSelectedItems = () => {
    const selectedItems = scannedItems.filter(item => item.isSelected)
    if (selectedItems.length === 0) {
      toast.error('삭제할 항목을 선택해주세요.')
      return
    }

    setScannedItems(prev => {
      const updated = prev.filter(item => !item.isSelected)
      if (updated.length > 0) {
        setSelectAll(updated.every(item => item.isSelected))
      } else {
        setSelectAll(false)
      }
      return updated
    })
    toast.success(`${selectedItems.length}개 항목이 삭제되었습니다.`)
  }

  // 선택된 항목 수
  const selectedCount = scannedItems.filter(item => item.isSelected).length

  // 승인 - 선택된 항목으로 LOT 생성 + 자재 차감
  const handleApprove = async () => {
    const selectedItems = scannedItems.filter(item => item.isSelected)

    if (selectedItems.length === 0) {
      toast.error('승인할 항목을 선택해주세요.')
      return
    }

    if (!currentLine) {
      toast.error('라인을 선택해주세요.')
      return
    }

    // 완제품 선택 검증
    if (!selectedProductCode) {
      toast.error(processCode === 'CA' ? '먼저 발주서 바코드를 스캔하세요.' : '먼저 전공정 바코드를 스캔하세요.')
      return
    }

    // CA 공정일 때 절압착 품번 선택 검증
    if (processCode === 'CA' && crimpCodes.length > 0 && !selectedCrimpCode) {
      toast.error('절압착 품번을 선택해주세요.')
      return
    }

    // BOM 미등록 자재 확인
    const invalidItems = selectedItems.filter(item => item.isValidMaterial === false)
    if (invalidItems.length > 0) {
      const proceed = window.confirm(
        `BOM에 등록되지 않은 자재가 ${invalidItems.length}개 있습니다.\n계속 진행하시겠습니까?`
      )
      if (!proceed) return
    }

    setIsProcessing(true)
    clearError()

    try {
      // 총 수량 계산
      const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

      // 선택한 완제품의 ID 찾기
      const productId = selectedProduct?.id

      // 신규 LOT 생성
      // plannedQty: 발주서가 있으면 발주서 지시수량, 없으면 자재 수량 합계
      const newLot = await createLot({
        processCode,
        productId,
        productCode: selectedProductCode,
        plannedQty: currentPOItem?.plannedQty || totalQty,
        lineCode: currentLine?.code,
        workerId: user?.id ? Number(user.id) : undefined,
        // 투입 자재 상세 정보 (바코드, 코드, 이름 포함)
        inputMaterialDetails: selectedItems.map(item => ({
          barcode: item.barcode,
          materialCode: item.materialCode,
          materialName: item.materialName,
          quantity: item.quantity,
        })),
        // CA 공정일 때 절압착 품번 추가
        ...(processCode === 'CA' && selectedCrimpCode && { crimpCode: selectedCrimpCode }),
      })

      // 자재 차감 (BOM 기반)
      if (productId && processCode === 'CA') {
        try {
          const deductionResult = await deductByBOM(
            productId,
            processCode,
            totalQty,
            selectedItems.map(item => ({
              materialId: item.materialId || 0,
              lotNumber: item.barcode,
              quantity: item.quantity,
            })),
            true, // allowNegative
            newLot.id
          )

          if (!deductionResult.success) {
            console.warn('자재 차감 경고:', deductionResult.errors)
            toast.warning(`자재 차감 경고: ${deductionResult.errors.join(', ')}`)
          } else {
            // deductedItems에서 총 차감량 계산
            const totalDeducted = deductionResult.deductedItems.reduce((sum, item) => sum + item.deductedQty, 0)
            if (totalDeducted > 0) {
              toast.info(`자재 ${totalDeducted}개 차감됨`)
            }
          }
        } catch (deductErr) {
          console.error('자재 차감 오류:', deductErr)
          // 차감 실패해도 LOT 생성은 유지
        }
      }

      setCurrentLot(newLot)
      setCompletedQty(0)
      setDefectQty(0)

      // 발주서 아이템 진행률 업데이트
      if (currentPOItem) {
        try {
          await updatePurchaseOrderItemProgress({
            itemId: currentPOItem.id,
            completedQty: totalQty,
            defectQty: 0,
          })
          console.log(`[ProcessView] PO 아이템 진행률 업데이트: ${currentPOItem.id}, +${totalQty}`)
        } catch (poErr) {
          console.error('발주서 아이템 진행률 업데이트 실패:', poErr)
          // 업데이트 실패해도 LOT 생성은 유지
        }
        // PO 아이템 초기화
        setCurrentPOItem(null)
      }

      // 승인된 항목 제거
      setScannedItems(prev => prev.filter(item => !item.isSelected))
      setSelectAll(false)

      const crimpInfo = processCode === 'CA' && selectedCrimpCode ? ` [${selectedCrimpCode}]` : ''
      toast.success(`LOT ${newLot.lotNumber} 생성 완료${crimpInfo} (${selectedItems.length}개 항목, ${totalQty}EA)`)
      refreshTodayLots()
      loadInProgressTasks() // 진행 중 작업 목록 갱신
    } catch (err) {
      console.error('Approval error:', err)
      toast.error('LOT 생성 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 작업 취소 - 자재 복원
  const handleCancelLot = async () => {
    if (!currentLot) return

    if (!window.confirm(`LOT ${currentLot.lotNumber}을 취소하고 자재를 복원하시겠습니까?`)) {
      return
    }

    setIsProcessing(true)
    try {
      // 자재 복원
      const restoredCount = await rollbackBOMDeduction(currentLot.id)
      if (restoredCount > 0) {
        toast.info(`${restoredCount}개 자재 LOT 복원됨`)
      }

      // LOT 초기화
      setCurrentLot(null)
      setSelectedTaskId(null)
      setCompletedQty(0)
      setDefectQty(0)
      // 작업 선택 초기화
      setSelectedProductCode('')
      setSelectedCrimpCode('')
      setCurrentPOItem(null)
      setBarcode('')
      setScannedItems([])
      toast.success('작업이 취소되었습니다.')
      refreshTodayLots()
      loadInProgressTasks() // 진행 중 작업 목록 갱신
      // 바코드 입력으로 포커스
      setTimeout(() => barcodeInputRef.current?.focus(), 100)
    } catch (err) {
      console.error('Cancel error:', err)
      toast.error('작업 취소 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 작업 시작
  const handleStart = async () => {
    if (!currentLot || !currentLine) {
      toast.error('LOT와 라인을 선택해주세요.')
      return
    }

    setIsProcessing(true)
    try {
      const updatedLot = await startProduction(
        currentLot.id,
        currentLine.code,
        user?.id ? Number(user.id) : undefined
      )
      setCurrentLot(updatedLot)
      toast.success('작업 시작')
    } catch (err) {
      toast.error('작업 시작 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 작업 완료 - 전표/바코드 생성 및 출력
  // 완료 시점에 최종 LOT 번호가 생성됨 (형식: {공정코드}{반제품품번}Q{완료수량}-{YYMMDD}-{일련번호})
  const handleComplete = async () => {
    if (!currentLot) return

    if (completedQty <= 0) {
      toast.error('완료 수량을 입력해주세요.')
      return
    }

    setIsProcessing(true)
    try {
      // 반제품 품번 결정: CA 공정은 절압착품번, 기타는 완제품 코드
      const semiProductCode = processCode === 'CA'
        ? (selectedCrimpCode || currentLot.crimpCode || currentLot.productCode)
        : currentLot.productCode

      const completedLot = await completeProduction({
        lotId: currentLot.id,
        completedQty,
        defectQty,
        semiProductCode, // 완료 시점 LOT 번호 생성에 사용
      })

      // 완료된 LOT 정보로 상태 업데이트 (새 LOT 번호 반영)
      setCurrentLot(completedLot)

      toast.success(`LOT ${completedLot.lotNumber} 완료 (${completedQty}EA)`)

      // 작업 완료 후 전표 다이얼로그 표시 (Barcord 프로젝트 워크플로우)
      // 전표 출력 후 라벨 출력 가능
      setShowDocumentDialog(true)

      // 전표 다이얼로그에서 처리할 수 있도록 LOT 정보 유지
      // 다이얼로그 닫을 때 초기화됨
      refreshTodayLots()
      loadInProgressTasks() // 완료된 작업을 목록에서 제거
    } catch (err) {
      toast.error('작업 완료 처리 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 전표 다이얼로그에서 라벨 출력으로 이동
  const handleDocumentPrinted = () => {
    setShowDocumentDialog(false)
    setShowLabelDialog(true)
  }

  // 전표 다이얼로그 닫을 때 처리
  const handleDocumentDialogClose = (open: boolean) => {
    setShowDocumentDialog(open)
    // 전표 다이얼로그 닫으면 라벨 다이얼로그 열기
    if (!open) {
      setShowLabelDialog(true)
    }
  }

  // 라벨 다이얼로그 닫을 때 LOT 초기화
  const handleLabelDialogClose = (open: boolean) => {
    setShowLabelDialog(open)
    if (!open && currentLot?.status === 'COMPLETED') {
      // 완료된 LOT면 초기화
      setCurrentLot(null)
      setSelectedTaskId(null)
      setCompletedQty(0)
      setDefectQty(0)
    }
  }

  // 초기화
  const handleReset = () => {
    setCurrentLot(null)
    setSelectedTaskId(null)
    setCompletedQty(0)
    setDefectQty(0)
    setBarcode('')
    // 작업 선택 초기화
    setSelectedProductCode('')
    setSelectedCrimpCode('')
    setCurrentPOItem(null)
    setScannedItems([])
    clearError()
    // 바코드 입력으로 포커스
    setTimeout(() => barcodeInputRef.current?.focus(), 100)
  }

  // 테스트 스캔 (개발용)
  const handleTestScan = async () => {
    const testBarcode = `${processCode}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    setBarcode(testBarcode)
  }

  const isWorking = currentLot?.status === 'IN_PROGRESS'

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">
            {processCode} - {processName}
          </h2>

          {/* 라인 선택 */}
          {lines.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-blue-200 bg-blue-50 text-blue-700"
                >
                  <Factory size={16} />
                  <span className="font-semibold">
                    {currentLine
                      ? `${currentLine.name} (${currentLine.code})`
                      : '라인 선택'}
                  </span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>작업 라인 선택</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {lines.map((line) => (
                  <DropdownMenuItem
                    key={line.id}
                    onClick={() => setCurrentLine(line)}
                    className="cursor-pointer"
                  >
                    <span className="font-medium">{line.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {line.code}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* CA 공정일 때만 번들 버튼 표시 */}
          {processCode === 'CA' && (
            <Button
              variant="outline"
              className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              onClick={() => setShowBundleDialog(true)}
            >
              <Package className="mr-2 h-4 w-4" />
              번들 생성
            </Button>
          )}

          <Badge
            variant={isWorking ? 'default' : 'secondary'}
            className={isWorking ? 'bg-green-600' : 'bg-slate-500'}
          >
            {isWorking ? '작업 중 (RUNNING)' : '대기 (IDLE)'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
        {/* Left Panel: Scan & Scanned Items */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          {/* 작업 선택 섹션: 바코드 스캔으로 자동 선택 */}
          <Card className="shadow-md border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  현재 작업
                </CardTitle>
                {selectedProductCode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-slate-400 hover:text-red-500"
                    onClick={() => {
                      setSelectedProductCode('')
                      setSelectedCrimpCode('')
                      setCurrentPOItem(null)
                      setCurrentLot(null)
                      setScannedItems([])
                      setBarcode('')
                      toast.info('작업 선택이 초기화되었습니다.')
                      setTimeout(() => barcodeInputRef.current?.focus(), 100)
                    }}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    초기화
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* 작업 선택 상태 표시 */}
              {selectedProductCode ? (
                <div className="space-y-2">
                  {/* 완제품 표시 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-16">완제품:</span>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-mono">
                      {selectedProductCode}
                    </Badge>
                    {selectedProduct && (
                      <span className="text-xs text-slate-500 truncate max-w-[120px]">
                        {selectedProduct.name}
                      </span>
                    )}
                  </div>
                  {/* CA 공정일 때 절압착 품번 표시 */}
                  {processCode === 'CA' && selectedCrimpCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-16">절압착:</span>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-mono">
                        {selectedCrimpCode}
                      </Badge>
                    </div>
                  )}
                  {/* PO 바코드로 선택된 경우 표시 */}
                  {currentPOItem && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-16">발주서:</span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {currentPOItem.barcode}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3">
                  <ScanLine className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    {processCode === 'CA'
                      ? '발주서 바코드를 스캔하세요'
                      : '전공정 바코드를 스캔하세요'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    바코드 스캔 시 작업이 자동 선택됩니다
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Section */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-blue-600" />
                  바코드 스캔
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-blue-600"
                  onClick={handleTestScan}
                  disabled={isProcessing}
                >
                  [개발용] 테스트
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <Input
                  ref={barcodeInputRef}
                  placeholder="전공정 바코드를 스캔하세요"
                  value={barcode}
                  onChange={handleBarcodeChange}
                  onPaste={handleBarcodePaste}
                  className="h-12 text-lg font-mono border-2 focus:border-blue-500"
                  autoComplete="off"
                  disabled={isProcessing}
                />
              </form>
            </CardContent>
          </Card>

          {/* Scanned Items List - 임시 목록 */}
          <Card className="flex-1 shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  스캔 목록 ({scannedItems.length})
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteSelectedItems}
                    disabled={selectedCount === 0}
                    className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-xs px-2"
                  >
                    <Trash2 size={12} className="mr-1" />
                    선택 삭제
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllItems}
                    disabled={scannedItems.length === 0}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs px-2"
                  >
                    <Trash2 size={12} className="mr-1" />
                    전체 삭제
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {scannedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[150px]">
                  <ScanLine size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">스캔된 바코드가 없습니다.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.isSelected ? 'bg-blue-50/50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.isSelected}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div>{item.barcode}</div>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {item.type === 'material' ? '자재' :
                             item.type === 'semi_product' ? '반제품' : '생산'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(item.id)}
                          >
                            <XCircle size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {/* 승인 버튼 */}
            <div className="p-4 border-t bg-slate-50">
              <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                disabled={selectedCount === 0 || isProcessing}
                onClick={handleApprove}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : (
                  <Check className="mr-2" />
                )}
                승인 ({selectedCount}개 선택)
              </Button>
            </div>
          </Card>
        </div>

        {/* Middle Panel: In-Progress Tasks & Current Job */}
        <div className="lg:col-span-1 flex flex-col space-y-4">
          {/* 진행 중인 작업 목록 - 다중 작업 지원 */}
          <Card className="shadow-md border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-amber-600" />
                  진행 중인 작업 ({inProgressTasks.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                  onClick={handleNewTask}
                >
                  + 새 작업
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 max-h-[180px] overflow-auto">
              {inProgressTasks.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  진행 중인 작업이 없습니다.
                </div>
              ) : (
                <div className="space-y-1">
                  {inProgressTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleSelectTask(task)}
                      className={`w-full p-2 rounded-lg text-left text-sm transition-colors ${
                        selectedTaskId === task.id
                          ? 'bg-amber-200 border-2 border-amber-400'
                          : 'bg-white border border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs truncate">
                            {isTempLotNumber(task.lotNumber) ? (
                              <span className="text-amber-600">(임시)</span>
                            ) : (
                              <span className="text-slate-600">{task.lotNumber}</span>
                            )}
                          </div>
                          <div className="font-medium text-slate-900 truncate">
                            {task.productName || '(미지정)'}
                          </div>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                            {task.plannedQty} EA
                          </Badge>
                          {task.lineCode && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {task.lineCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Job */}
          <Card className="flex-1 shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">
                {selectedTaskId ? '선택된 작업' : '현재 작업'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-4 space-y-4">
              {!currentLot ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                  <Package size={48} className="mb-4 opacity-20" />
                  <p>승인된 LOT가 없습니다.</p>
                  <p className="text-sm mt-2">바코드를 스캔하고 승인하세요.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-slate-500">LOT 번호</Label>
                      <div className={`font-mono text-sm font-bold p-2 rounded ${
                        isTempLotNumber(currentLot.lotNumber)
                          ? 'text-amber-700 bg-amber-50 border border-amber-200'
                          : 'text-slate-900 bg-slate-100'
                      }`}>
                        {isTempLotNumber(currentLot.lotNumber)
                          ? '(완료 시 생성)'
                          : currentLot.lotNumber}
                      </div>
                      {isTempLotNumber(currentLot.lotNumber) && (
                        <p className="text-xs text-amber-600 mt-1">작업 완료 시 최종 LOT 번호가 생성됩니다.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-500">지시 수량</Label>
                      <div className="font-mono text-lg font-bold text-blue-600 bg-blue-50 p-2 rounded text-right">
                        {currentPOItem?.plannedQty ?? currentLot.plannedQty} EA
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-500">품명</Label>
                    <div className="text-lg font-medium border-b border-slate-200 pb-1">
                      {currentLot.productName || '(품번 미지정)'}
                    </div>
                  </div>

                  {/* 수량 입력 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-slate-500">완료 수량</Label>
                      <Input
                        type="number"
                        value={completedQty}
                        onChange={(e) =>
                          setCompletedQty(parseInt(e.target.value) || 0)
                        }
                        className="text-lg font-bold"
                        min={0}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-500">불량 수량</Label>
                      <Input
                        type="number"
                        value={defectQty}
                        onChange={(e) =>
                          setDefectQty(parseInt(e.target.value) || 0)
                        }
                        className="text-lg font-bold text-red-600"
                        min={0}
                      />
                    </div>
                  </div>

                  {/* 투입 자재 */}
                  <div className="pt-2">
                    <Label className="text-slate-500 mb-2 block">
                      투입 자재 ({currentLot.lotMaterials?.length || 0})
                    </Label>
                    {currentLot.lotMaterials && currentLot.lotMaterials.length > 0 ? (
                      <ul className="space-y-1 text-sm max-h-[120px] overflow-auto">
                        {currentLot.lotMaterials.map((lm) => (
                          <li
                            key={lm.id}
                            className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100"
                          >
                            <span className="font-mono text-xs">{lm.lotNumber || '-'}</span>
                            <Badge variant="outline" className="text-slate-500">
                              {lm.quantity}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400">투입된 자재가 없습니다.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Action Buttons */}
            <div className="p-4 border-t bg-slate-50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {!isWorking ? (
                  <Button
                    size="lg"
                    className="col-span-2 bg-blue-600 hover:bg-blue-700 h-12"
                    disabled={!currentLot || isProcessing}
                    onClick={handleStart}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : (
                      <Play className="mr-2 fill-current" />
                    )}
                    작업 시작
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="col-span-2 bg-red-600 hover:bg-red-700 h-12"
                    onClick={handleComplete}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : (
                      <Square className="mr-2 fill-current" />
                    )}
                    작업 종료
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!currentLot || isProcessing || currentLot?.status !== 'COMPLETED'}
                  onClick={() => setShowDocumentDialog(true)}
                  title={currentLot?.status !== 'COMPLETED' ? '완료 상태에서만 출력 가능' : ''}
                >
                  <FileText className="mr-2 h-4 w-4" /> 전표
                </Button>
                <Button
                  variant="outline"
                  disabled={!currentLot || isProcessing || currentLot?.status !== 'COMPLETED'}
                  onClick={() => setShowLabelDialog(true)}
                  title={currentLot?.status !== 'COMPLETED' ? '완료 상태에서만 출력 가능' : ''}
                >
                  <Printer className="mr-2 h-4 w-4" /> 라벨
                </Button>
                <Button
                  variant="outline"
                  disabled={isWorking || isProcessing}
                  onClick={handleReset}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> 초기화
                </Button>
              </div>
              {/* 작업 취소 버튼 - 자재 복원 */}
              {currentLot && currentLot.status !== 'COMPLETED' && (
                <Button
                  variant="outline"
                  className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  disabled={isProcessing}
                  onClick={handleCancelLot}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  작업 취소 (자재 복원)
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Panel: History Grid */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <Card className="h-full shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-2 space-y-3">
              {/* 헤더 */}
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-500" />
                    최근 작업 ({filteredLots.length}/{todayLots.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-1">최근 30일</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshTodayLots()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '새로고침'
                  )}
                </Button>
              </div>

              {/* 상태 탭 필터 */}
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'IN_PROGRESS' | 'COMPLETED')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="all" className="text-xs h-7">
                    전체 ({todayLots.length})
                  </TabsTrigger>
                  <TabsTrigger value="IN_PROGRESS" className="text-xs h-7">
                    진행 ({todayLots.filter(l => l.status === 'IN_PROGRESS').length})
                  </TabsTrigger>
                  <TabsTrigger value="COMPLETED" className="text-xs h-7">
                    완료 ({todayLots.filter(l => l.status === 'COMPLETED').length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* 검색 입력 */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="LOT 번호, 품번 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[70px]">일시</TableHead>
                    <TableHead>LOT</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-center w-[60px]">상태</TableHead>
                    <TableHead className="text-center w-[130px]">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-slate-500"
                      >
                        {searchQuery ? '검색 결과가 없습니다.' : '작업 이력이 없습니다.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLots.map((lot) => (
                      <TableRow
                        key={lot.id}
                        className={`cursor-pointer ${currentLot?.id === lot.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => {
                          setCurrentLot(lot)
                          setCompletedQty(lot.completedQty)
                          setDefectQty(lot.defectQty)
                        }}
                      >
                        <TableCell className="font-medium text-slate-500 text-xs">
                          <div className="flex flex-col">
                            <span>{lot.startedAt ? new Date(lot.startedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}</span>
                            <span className="text-slate-400">{lot.startedAt ? new Date(lot.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {isTempLotNumber(lot.lotNumber) ? (
                            <span className="text-amber-600">(임시)</span>
                          ) : lot.lotNumber.length > 15 ? (
                            `...${lot.lotNumber.slice(-12)}`
                          ) : (
                            lot.lotNumber
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {lot.completedQty}/{lot.plannedQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={lot.status === 'COMPLETED' ? 'default' : 'secondary'}
                            className={`text-[10px] ${lot.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                          >
                            {lot.status === 'COMPLETED' ? '완료' : '진행'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* 완료된 LOT: 전표/라벨/묶음 버튼 */}
                            {lot.status === 'COMPLETED' && (
                              <>
                                {/* 전표 버튼 */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedHistoryLot(lot)
                                    setShowDocumentDialog(true)
                                  }}
                                  title="전표 출력"
                                >
                                  <FileText size={14} />
                                </Button>
                                {/* 라벨 버튼 */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedHistoryLot(lot)
                                    setShowLabelDialog(true)
                                  }}
                                  title="라벨 출력"
                                >
                                  <Printer size={14} />
                                </Button>
                                {/* CA 공정일 때만 묶음 버튼 */}
                                {processCode === 'CA' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedHistoryLot(lot)
                                      setShowBundleDialog(true)
                                    }}
                                    title="묶음 바코드"
                                  >
                                    <Package size={14} />
                                  </Button>
                                )}
                              </>
                            )}
                            {/* 삭제 버튼 (모든 상태에서 표시) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm(`작업 "${lot.lotNumber}"을(를) 삭제하시겠습니까?\n\n삭제된 작업은 복구할 수 없습니다.`)) {
                                  deleteLot(lot.id)
                                    .then(() => {
                                      toast.success('작업이 삭제되었습니다.')
                                      // currentLot이 삭제된 LOT면 초기화
                                      if (currentLot?.id === lot.id) {
                                        setCurrentLot(null)
                                      }
                                    })
                                    .catch((err) => {
                                      toast.error(`삭제 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
                                    })
                                }
                              }}
                              title="작업 삭제"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CA 번들 다이얼로그 */}
      {processCode === 'CA' && (
        <BundleDialog
          open={showBundleDialog}
          onOpenChange={(open) => {
            setShowBundleDialog(open)
            if (!open) {
              setSelectedHistoryLot(null)
            }
          }}
          onComplete={(bundle) => {
            toast.success(`번들 ${bundle.bundleNo} 완료`)
            refreshTodayLots()
            setSelectedHistoryLot(null)
          }}
          crimpProducts={bundleCrimpProducts}
        />
      )}

      {/* 전표 미리보기 다이얼로그 (Barcord 스타일) */}
      {(selectedHistoryLot || currentLot) && (
        <DocumentPreviewDialog
          open={showDocumentDialog}
          onOpenChange={(open) => {
            setShowDocumentDialog(open)
            if (!open) {
              // 다이얼로그 닫을 때 선택 초기화
              if (selectedHistoryLot) {
                // 최근 작업에서 선택한 경우 라벨 다이얼로그 열기 (선택 유지)
                setShowLabelDialog(true)
              } else {
                // 현재 작업에서 선택한 경우 기존 로직
                handleDocumentDialogClose(open)
              }
            }
          }}
          lotId={selectedHistoryLot?.id || currentLot?.id}
          data={{
            lotNumber: (selectedHistoryLot || currentLot)!.lotNumber,
            productCode: (selectedHistoryLot || currentLot)!.productCode || selectedProductCode || '-',
            productName: (selectedHistoryLot || currentLot)!.productName || selectedProduct?.name || '-',
            quantity: selectedHistoryLot ? selectedHistoryLot.completedQty : (completedQty || currentLot!.completedQty || currentLot!.plannedQty),
            unit: 'EA',
            productionDate: new Date((selectedHistoryLot || currentLot)!.startedAt || new Date().toISOString()),
            processCode: (selectedHistoryLot || currentLot)!.processCode,
            processName: getProcessName((selectedHistoryLot || currentLot)!.processCode),
            inputMaterials: selectedHistoryLot
              ? (selectedHistoryLot.lotMaterials || []).map(lm => ({
                  lotNumber: lm.lotNumber || '-',
                  productCode: lm.materialCode || '-',
                  name: lm.materialName || '-',
                  quantity: lm.quantity,
                  unit: 'EA',
                  sourceType: 'material' as const,
                  processCode: selectedHistoryLot.processCode,
                }))
              : scannedItems
                  .filter(item => item.isSelected || item.isValidMaterial)
                  .map(item => ({
                    lotNumber: item.barcode,
                    productCode: item.materialCode || item.productCode || '-',
                    name: item.materialName || item.productCode || '-',
                    quantity: item.quantity,
                    unit: 'EA',
                    sourceType: item.type === 'material' ? 'material' as const : 'production' as const,
                    processCode: item.processCode,
                  })),
            crimpProductCode: selectedHistoryLot?.crimpCode || selectedCrimpCode || undefined,
            lineCode: (selectedHistoryLot || currentLot)!.lineCode || currentLine?.code || undefined,
            plannedQuantity: (selectedHistoryLot || currentLot)!.plannedQty,
            completedQuantity: selectedHistoryLot ? selectedHistoryLot.completedQty : (completedQty || currentLot!.completedQty),
            defectQuantity: selectedHistoryLot ? (selectedHistoryLot.defectQty || 0) : (defectQty || currentLot!.defectQty || 0),
            workerName: user?.name, // TODO: workerId만 있음, 이름 조회 필요
          }}
          onPrint={() => {
            toast.success('전표 인쇄 요청 완료')
            // 전표 출력 후 라벨 다이얼로그로 이동
            if (!selectedHistoryLot) {
              handleDocumentPrinted()
            }
          }}
        />
      )}

      {/* 라벨 미리보기 다이얼로그 */}
      {(selectedHistoryLot || currentLot) && (
        <LabelPreviewDialog
          open={showLabelDialog}
          onOpenChange={(open) => {
            setShowLabelDialog(open)
            if (!open) {
              // 다이얼로그 닫을 때 선택 초기화
              if (selectedHistoryLot) {
                setSelectedHistoryLot(null)
              } else if (currentLot?.status === 'COMPLETED') {
                // 완료된 LOT면 초기화
                setCurrentLot(null)
                setSelectedTaskId(null)
                setCompletedQty(0)
                setDefectQty(0)
              }
            }
          }}
          lotData={{
            lotNumber: (selectedHistoryLot || currentLot)!.lotNumber,
            processCode: (selectedHistoryLot || currentLot)!.processCode,
            productCode: (selectedHistoryLot || currentLot)!.productCode,
            productName: (selectedHistoryLot || currentLot)!.productName,
            quantity: selectedHistoryLot ? selectedHistoryLot.completedQty : (completedQty || currentLot!.completedQty || currentLot!.plannedQty),
            date: (selectedHistoryLot || currentLot)!.startedAt ? new Date((selectedHistoryLot || currentLot)!.startedAt!).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            lineCode: (selectedHistoryLot || currentLot)!.lineCode || undefined,
            workerName: undefined, // TODO: workerId만 있음, 이름 조회 필요
          }}
          onPrint={() => {
            toast.success('라벨 인쇄 요청 완료')
          }}
        />
      )}
    </div>
  )
}

export default ProcessView
