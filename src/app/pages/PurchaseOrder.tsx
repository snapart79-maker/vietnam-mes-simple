/**
 * Purchase Order Page (발주서 관리)
 *
 * 발주서(일일 생산계획) 관리 페이지
 * - 발주서 목록 조회/필터
 * - 발주서 등록
 * - 발주서 상세 (아이템 목록)
 * - 공정별 진행률
 * - 발주서 출력
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Calendar } from '../components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Progress } from '../components/ui/progress'
import {
  CalendarIcon,
  Plus,
  Search,
  FileText,
  Printer,
  Download,
  RefreshCw,
  Eye,
  Package,
  BarChart3,
  ClipboardList,
  Trash2,
} from 'lucide-react'
import { Checkbox } from '../components/ui/checkbox'
import { toast } from 'sonner'
import { format, addDays, subDays, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import { registerKoreanFont } from '@/lib/koreanFont'
import { cn } from '@/app/components/ui/utils'
import {
  usePurchaseOrder,
  type PurchaseOrder as PurchaseOrderType,
  type PurchaseOrderItem,
  type ProcessProgress,
} from '@/app/context/PurchaseOrderContext'
import { PurchaseOrderDialog } from '../components/dialogs/PurchaseOrderDialog'

// ============================================
// Helper Functions
// ============================================

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'CREATED':
      return <Badge variant="outline">생성됨</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="default" className="bg-blue-500">진행중</Badge>
    case 'COMPLETED':
      return <Badge variant="default" className="bg-green-500">완료</Badge>
    case 'CANCELLED':
      return <Badge variant="secondary">취소</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const getItemStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="outline">대기</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="default" className="bg-blue-500">진행중</Badge>
    case 'COMPLETED':
      return <Badge variant="default" className="bg-green-500">완료</Badge>
    case 'CANCELLED':
      return <Badge variant="secondary">취소</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const getProcessName = (code: string) => {
  const names: Record<string, string> = {
    CA: '자동절압착',
    MC: '수동압착',
    SB: '서브조립',
    MS: '중간스트립',
    SP: '제품조립제공부품',
    PA: '제품조립',
    CI: '회로검사',
    VI: '육안검사',
  }
  return names[code] || code
}

// ============================================
// Component
// ============================================

export const PurchaseOrder = () => {
  const {
    todayOrders,
    selectedOrder,
    processProgress,
    isLoading,
    error,
    getTodayPurchaseOrders,
    getPurchaseOrdersByDateRange,
    getPurchaseOrderById,
    getProgressByProcess,
    setSelectedOrder,
    refreshTodayOrders,
    refreshProcessProgress,
    deletePurchaseOrder,
    deletePurchaseOrders,
    resetPurchaseOrders,
  } = usePurchaseOrder()

  // 상태
  const [activeTab, setActiveTab] = useState('orders')
  const [showDialog, setShowDialog] = useState(false)
  const [filterDate, setFilterDate] = useState<Date>(new Date())
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterProcess, setFilterProcess] = useState<string>('all')  // 공정 필터
  const [searchText, setSearchText] = useState('')
  const [orders, setOrders] = useState<PurchaseOrderType[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // 초기 로드
  useEffect(() => {
    loadOrders()
    refreshProcessProgress()
  }, [filterDate])

  // 발주서 로드
  const loadOrders = async () => {
    try {
      // 선택한 날짜의 00:00:00 ~ 23:59:59.999
      const startDate = startOfDay(filterDate)
      const endDate = new Date(startDate)
      endDate.setHours(23, 59, 59, 999)

      console.log('[PurchaseOrder] Loading orders for:', format(filterDate, 'yyyy-MM-dd'), { startDate, endDate })

      const result = await getPurchaseOrdersByDateRange(startDate, endDate)
      console.log('[PurchaseOrder] Loaded orders:', result.length)
      setOrders(result)
    } catch (err) {
      console.error('Failed to load orders:', err)
    }
  }

  // 필터링된 발주서
  const filteredOrders = useMemo(() => {
    let filtered = orders

    // 상태 필터
    if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === filterStatus)
    }

    // 검색어 필터
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(o =>
        o.orderNo.toLowerCase().includes(search) ||
        o.description?.toLowerCase().includes(search)
      )
    }

    // 공정 필터: 해당 공정 아이템이 있는 발주서만 표시
    if (filterProcess !== 'all') {
      filtered = filtered.filter(o =>
        o.items?.some(item => item.processCode === filterProcess)
      )
    }

    return filtered
  }, [orders, filterStatus, searchText, filterProcess])

  // 선택된 발주서의 필터링된 아이템 (공정 필터 적용)
  const filteredSelectedOrderItems = useMemo(() => {
    if (!selectedOrder?.items) return []
    if (filterProcess === 'all') return selectedOrder.items
    return selectedOrder.items.filter(item => item.processCode === filterProcess)
  }, [selectedOrder, filterProcess])

  // 발주서 선택
  const handleSelectOrder = async (order: PurchaseOrderType) => {
    try {
      const detail = await getPurchaseOrderById(order.id)
      if (detail) {
        setSelectedOrder(detail)
      }
    } catch (err) {
      console.error('Failed to load order detail:', err)
    }
  }

  // 새로고침
  const handleRefresh = async () => {
    await loadOrders()
    await refreshProcessProgress()
    toast.success('새로고침 완료')
  }

  // 다이얼로그 완료
  const handleDialogComplete = (order: PurchaseOrderType) => {
    loadOrders()
  }

  // 선택 토글
  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)))
    }
  }

  // 선택 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('삭제할 발주서를 선택해주세요.')
      return
    }

    if (!window.confirm(`선택한 ${selectedIds.size}개 발주서를 삭제하시겠습니까?`)) {
      return
    }

    try {
      const count = await deletePurchaseOrders(Array.from(selectedIds))
      setSelectedIds(new Set())
      await loadOrders()
      toast.success(`${count}개 발주서 삭제 완료`)
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  // 전체 삭제
  const handleDeleteAll = async () => {
    if (orders.length === 0) {
      toast.error('삭제할 발주서가 없습니다.')
      return
    }

    if (!window.confirm(`모든 발주서(${orders.length}개)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const count = resetPurchaseOrders()
      setSelectedIds(new Set())
      setOrders([])
      toast.success(`${count}개 발주서 삭제 완료`)
    } catch (err) {
      console.error('Delete all failed:', err)
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  // 단일 삭제
  const handleDeleteOne = async (id: number) => {
    if (!window.confirm('이 발주서를 삭제하시겠습니까?')) {
      return
    }

    try {
      await deletePurchaseOrder(id)
      await loadOrders()
      toast.success('발주서 삭제 완료')
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  // PDF 생성 헬퍼 함수 (DocumentPreviewDialog 스타일)
  const generatePurchaseOrderPDF = async (order: PurchaseOrderType): Promise<jsPDF | null> => {
    // 상세 정보 로드
    let orderDetail = order
    if (!order.items || order.items.length === 0) {
      const detail = await getPurchaseOrderById(order.id)
      if (!detail) {
        toast.error('발주서 정보를 불러올 수 없습니다.')
        return null
      }
      orderDetail = detail
    }

    // PDF 생성
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // 한글 폰트 적용
    await registerKoreanFont(doc)

    const pageWidth = 210
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = margin

    // 색상 정의
    const primaryColor = { r: 25, g: 118, b: 210 }  // #1976d2
    const headerBgColor = { r: 227, g: 242, b: 253 } // #e3f2fd
    const labelColor = { r: 21, g: 101, b: 192 }     // #1565c0
    const zebraColor = { r: 250, g: 250, b: 250 }    // #fafafa

    // ========================================
    // 1. 헤더 섹션 (제목 + 기본 정보, 그룹 바코드 제거)
    // ========================================

    // 타이틀 배경
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b)
    doc.rect(margin, y, contentWidth, 12, 'F')

    // 타이틀 텍스트
    doc.setFont('KoreanFont', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    const titleText = filterProcess === 'all'
      ? '일일 생산계획서 (발주서)'
      : `일일 생산계획서 - ${getProcessName(filterProcess)}`
    doc.text(titleText, pageWidth / 2, y + 8, { align: 'center' })
    y += 16

    // 기본 정보 (2열 레이아웃)
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    const statusText = orderDetail.status === 'CREATED' ? '생성됨' :
                       orderDetail.status === 'IN_PROGRESS' ? '진행중' :
                       orderDetail.status === 'COMPLETED' ? '완료' : orderDetail.status

    // 좌측 정보
    doc.setFont('KoreanFont', 'normal')
    doc.text('발주서 번호:', margin, y + 5)
    doc.text('생산 예정일:', margin, y + 12)
    doc.text(orderDetail.orderNo, margin + 28, y + 5)
    doc.text(format(new Date(orderDetail.orderDate), 'yyyy-MM-dd (EEEE)', { locale: ko }), margin + 28, y + 12)

    // 우측 정보
    const rightCol = pageWidth / 2 + 10
    doc.text('등록일:', rightCol, y + 5)
    doc.text('상태:', rightCol, y + 12)
    doc.text(format(new Date(orderDetail.createdAt), 'yyyy-MM-dd HH:mm'), rightCol + 15, y + 5)
    doc.text(statusText, rightCol + 15, y + 12)

    y += 20

    // ========================================
    // 2. 품목 목록 (단일 테이블, 그룹화 없음)
    // ========================================
    // 공정 필터가 적용된 경우 해당 공정 아이템만 표시
    const allItems = orderDetail.items || []
    const items = filterProcess === 'all'
      ? allItems
      : allItems.filter(item => item.processCode === filterProcess)

    // 라인 헤더
    doc.setFillColor(headerBgColor.r, headerBgColor.g, headerBgColor.b)
    doc.rect(margin, y, contentWidth, 8, 'F')
    doc.setFont('KoreanFont', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(labelColor.r, labelColor.g, labelColor.b)
    const lineName = items.length > 0
      ? (items[0].lineName || items[0].lineCode || '미지정')
      : '미지정'
    doc.text(`라인: ${lineName}`, margin + 3, y + 5.5)
    doc.text(`품목 수: ${items.length}건`, pageWidth - margin - 30, y + 5.5)
    y += 10

    // 테이블 헤더
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y, contentWidth, 7, 'F')
    doc.setFont('KoreanFont', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)

    // 컬럼 너비 조정 (바코드 이미지용)
    const colWidths = [8, 22, 28, 18, 22, 12, 12, 58]
    const headers = ['No', '완제품품번', '품명', '공정', '절압착품번', '계획', '완료', '바코드']
    let x = margin + 1

    y += 5
    headers.forEach((header, i) => {
      doc.text(header, x, y)
      x += colWidths[i]
    })
    y += 5

    // 테이블 데이터 (바코드 이미지 포함)
    const rowHeight = 22  // 행 높이 증가 (품명 2줄 + 여유 공간)
    const maxItemsPerPage = 8  // 한 페이지 최대 8개 품목
    let itemsOnCurrentPage = 0

    for (let index = 0; index < items.length; index++) {
      const item = items[index]

      // 페이지 넘김 체크 (8개 초과 시 또는 페이지 끝)
      if (itemsOnCurrentPage >= maxItemsPerPage || y > 240) {
        doc.addPage()
        y = margin
        itemsOnCurrentPage = 0

        // 새 페이지 헤더 다시 그리기
        doc.setFillColor(240, 240, 240)
        doc.rect(margin, y, contentWidth, 7, 'F')
        doc.setFont('KoreanFont', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(0, 0, 0)
        let hx = margin + 1
        y += 5
        headers.forEach((header, i) => {
          doc.text(header, hx, y)
          hx += colWidths[i]
        })
        y += 5
      }

      // 짝수 행 배경
      if (index % 2 === 1) {
        doc.setFillColor(zebraColor.r, zebraColor.g, zebraColor.b)
        doc.rect(margin, y - 2, contentWidth, rowHeight, 'F')
      }

      // 행 테두리
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(margin, y - 2, contentWidth, rowHeight)

      x = margin + 1
      doc.setFont('KoreanFont', 'normal')
      doc.setFontSize(8)  // 폰트 크기 증가
      doc.setTextColor(0, 0, 0)

      // 텍스트 데이터 (바코드 제외)
      const itemAny = item as any
      const productCode = item.productCode || itemAny.product?.code || '-'
      const productName = item.productName || itemAny.product?.name || '-'

      // No 컬럼
      doc.text(String(index + 1), x + 2, y + 6)
      x += colWidths[0]

      // 완제품품번 컬럼
      doc.setFontSize(8)
      doc.text(productCode.length > 10 ? productCode.slice(0, 10) + '..' : productCode, x, y + 6)
      x += colWidths[1]

      // 품명 컬럼 (2줄 지원)
      doc.setFontSize(7)
      const maxNameWidth = colWidths[2] - 2
      let nameText = productName
      let line1 = ''
      let line2 = ''

      // 첫 줄에 들어갈 수 있는 만큼 자르기
      for (let i = 0; i < nameText.length; i++) {
        if (doc.getTextWidth(nameText.slice(0, i + 1)) > maxNameWidth) {
          line1 = nameText.slice(0, i)
          line2 = nameText.slice(i)
          break
        }
        line1 = nameText.slice(0, i + 1)
      }

      // 두 번째 줄도 자르기
      if (line2.length > 0) {
        let trimmedLine2 = line2
        while (doc.getTextWidth(trimmedLine2) > maxNameWidth && trimmedLine2.length > 2) {
          trimmedLine2 = trimmedLine2.slice(0, -1)
        }
        if (trimmedLine2.length < line2.length) {
          line2 = trimmedLine2.slice(0, -2) + '..'
        } else {
          line2 = trimmedLine2
        }
      }

      doc.text(line1, x, y + 5)
      if (line2) {
        doc.text(line2, x, y + 10)
      }
      x += colWidths[2]

      // 공정 컬럼
      doc.setFontSize(7)
      const procName = getProcessName(item.processCode) || item.processCode
      doc.text(procName.length > 8 ? procName.slice(0, 8) : procName, x, y + 6)
      x += colWidths[3]

      // 절압착품번 컬럼
      const crimpText = item.crimpCode || '-'
      doc.text(crimpText.length > 12 ? crimpText.slice(0, 10) + '..' : crimpText, x, y + 6)
      x += colWidths[4]

      // 계획 수량 컬럼
      doc.setFontSize(9)
      doc.text(String(item.plannedQty || 0), x + 2, y + 6)
      x += colWidths[5]

      // 완료 수량 컬럼
      doc.text(String(item.completedQty || 0), x + 2, y + 6)
      x += colWidths[6]

      // 바코드 이미지 생성 및 삽입
      if (item.barcode) {
        try {
          const barcodeCanvas = document.createElement('canvas')
          JsBarcode(barcodeCanvas, item.barcode, {
            format: 'CODE128',
            width: 1.2,
            height: 35,
            displayValue: true,
            fontSize: 9,
            margin: 2,
            textMargin: 2,
          })
          const barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
          doc.addImage(barcodeDataUrl, 'PNG', x, y, 55, rowHeight - 4)
        } catch (err) {
          doc.setFontSize(6)
          doc.text(item.barcode, x, y + 6)
        }
      }

      y += rowHeight + 2  // 행 사이 추가 간격
      itemsOnCurrentPage++
    }

    y += 4

    // ========================================
    // 3. 요약 섹션
    // ========================================
    if (y > 250) {
      doc.addPage()
      y = margin
    }

    // 구분선
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    // 요약 정보
    doc.setFont('KoreanFont', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    const totalPlanned = items.reduce((sum, item) => sum + item.plannedQty, 0)
    const totalCompleted = items.reduce((sum, item) => sum + item.completedQty, 0)
    const progressPercent = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0

    // 요약 테이블 (2x2)
    doc.setFillColor(headerBgColor.r, headerBgColor.g, headerBgColor.b)
    doc.rect(margin, y, contentWidth / 2, 7, 'F')
    doc.rect(margin + contentWidth / 2, y, contentWidth / 2, 7, 'F')

    doc.setFontSize(9)
    doc.setTextColor(labelColor.r, labelColor.g, labelColor.b)
    doc.text('총 품목', margin + 5, y + 5)
    doc.text('총 계획 수량', margin + contentWidth / 2 + 5, y + 5)

    doc.setTextColor(0, 0, 0)
    doc.text(`${items.length}건`, margin + 45, y + 5)
    doc.text(`${totalPlanned.toLocaleString()}개`, margin + contentWidth / 2 + 45, y + 5)
    y += 8

    doc.setFillColor(255, 255, 255)
    doc.rect(margin, y, contentWidth / 2, 7, 'S')
    doc.rect(margin + contentWidth / 2, y, contentWidth / 2, 7, 'S')

    doc.setTextColor(labelColor.r, labelColor.g, labelColor.b)
    doc.text('완료 수량', margin + 5, y + 5)
    doc.text('진행률', margin + contentWidth / 2 + 5, y + 5)

    doc.setTextColor(0, 0, 0)
    doc.text(`${totalCompleted.toLocaleString()}개`, margin + 45, y + 5)
    doc.text(`${progressPercent}%`, margin + contentWidth / 2 + 45, y + 5)
    y += 12

    // 메모
    if (orderDetail.description) {
      doc.setFillColor(255, 253, 231)  // 연한 노란색
      doc.rect(margin, y, contentWidth, 10, 'F')
      doc.setFont('KoreanFont', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`메모: ${orderDetail.description}`, margin + 3, y + 6)
      y += 14
    }

    // ========================================
    // 4. 서명란
    // ========================================
    const signY = Math.max(y + 5, 255)
    const signWidth = 35
    const signHeight = 18
    const signGap = 10
    const signStartX = pageWidth - margin - (signWidth * 3 + signGap * 2)

    const signs = ['작성', '검토', '승인']
    signs.forEach((label, i) => {
      const signX = signStartX + (signWidth + signGap) * i

      // 서명 박스 배경
      doc.setFillColor(headerBgColor.r, headerBgColor.g, headerBgColor.b)
      doc.rect(signX, signY, signWidth, 5, 'F')

      // 서명 박스
      doc.setDrawColor(180, 180, 180)
      doc.rect(signX, signY, signWidth, signHeight)

      // 라벨
      doc.setFont('KoreanFont', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(labelColor.r, labelColor.g, labelColor.b)
      doc.text(label, signX + signWidth / 2, signY + 3.5, { align: 'center' })
    })

    // ========================================
    // 5. 페이지 하단 정보
    // ========================================
    doc.setFont('KoreanFont', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(128, 128, 128)
    doc.text(`출력일시: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, margin, 290)
    doc.text('Vietnam MES System', pageWidth - margin, 290, { align: 'right' })

    return doc
  }

  // 프린터로 직접 출력
  const handlePrint = async (order: PurchaseOrderType) => {
    try {
      const doc = await generatePurchaseOrderPDF(order)
      if (!doc) return

      // 새 창에서 인쇄 다이얼로그 열기
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      } else {
        toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.')
      }
    } catch (err) {
      console.error('Print failed:', err)
      toast.error('인쇄 중 오류가 발생했습니다.')
    }
  }

  // PDF 다운로드
  const handleDownload = async (order: PurchaseOrderType) => {
    try {
      const doc = await generatePurchaseOrderPDF(order)
      if (!doc) return

      doc.save(`발주서_${order.orderNo}.pdf`)
      toast.success('발주서 PDF 다운로드 완료')
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('PDF 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 통계 계산
  const stats = useMemo(() => {
    const total = orders.length
    const created = orders.filter(o => o.status === 'CREATED').length
    const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length
    const completed = orders.filter(o => o.status === 'COMPLETED').length
    return { total, created, inProgress, completed }
  }, [orders])

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            발주서 관리
          </h1>
          <p className="text-muted-foreground">
            일일 생산계획을 등록하고 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            새 발주서
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">생산일:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterDate, 'PPP', { locale: ko })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={(date) => date && setFilterDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterDate(new Date())}
              >
                오늘
              </Button>
            </div>

            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">상태:</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="CREATED">생성됨</SelectItem>
                  <SelectItem value="IN_PROGRESS">진행중</SelectItem>
                  <SelectItem value="COMPLETED">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 공정 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">공정:</span>
              <Select value={filterProcess} onValueChange={setFilterProcess}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="CA">자동절단압착</SelectItem>
                  <SelectItem value="MC">수동압착</SelectItem>
                  <SelectItem value="SB">서브조립</SelectItem>
                  <SelectItem value="PA">제품조립</SelectItem>
                  <SelectItem value="SP">제품조립제공부품</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 검색 */}
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="발주서 번호, 메모 검색..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">전체</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">대기</div>
            <div className="text-2xl font-bold text-gray-500">{stats.created}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">진행중</div>
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">완료</div>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            발주서 목록
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            공정별 현황
          </TabsTrigger>
        </TabsList>

        {/* 발주서 목록 */}
        <TabsContent value="orders" className="flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 발주서 목록 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>발주서 목록</CardTitle>
                    <CardDescription>
                      {format(filterDate, 'yyyy-MM-dd')} 기준 {filteredOrders.length}건
                      {selectedIds.size > 0 && ` (${selectedIds.size}개 선택)`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.size === 0}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      선택 삭제
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteAll}
                      disabled={orders.length === 0}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      전체 삭제
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>발주서 번호</TableHead>
                        <TableHead>품목 수</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead className="w-[80px]">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className={cn(
                            "cursor-pointer",
                            selectedOrder?.id === order.id && "bg-muted"
                          )}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => handleToggleSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell
                            className="font-medium"
                            onClick={() => handleSelectOrder(order)}
                          >
                            {order.orderNo}
                          </TableCell>
                          <TableCell onClick={() => handleSelectOrder(order)}>
                            {order.items?.length || 0}건
                          </TableCell>
                          <TableCell onClick={() => handleSelectOrder(order)}>
                            {getStatusBadge(order.status)}
                          </TableCell>
                          <TableCell
                            className="max-w-[150px] truncate"
                            onClick={() => handleSelectOrder(order)}
                          >
                            {order.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSelectOrder(order)}
                                title="상세 보기"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handlePrint(order)
                                }}
                                title="인쇄"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownload(order)
                                }}
                                title="다운로드"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteOne(order.id)
                                }}
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>발주서가 없습니다</p>
                    <Button
                      variant="link"
                      onClick={() => setShowDialog(true)}
                      className="mt-2"
                    >
                      새 발주서 등록
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 발주서 상세 */}
            <Card>
              <CardHeader>
                <CardTitle>발주서 상세</CardTitle>
                <CardDescription>
                  {selectedOrder ? selectedOrder.orderNo : '발주서를 선택하세요'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <div className="space-y-4">
                    {/* 발주서 정보 */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">생산일</span>
                        <span>{format(new Date(selectedOrder.orderDate), 'yyyy-MM-dd')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">상태</span>
                        {getStatusBadge(selectedOrder.status)}
                      </div>
                      {selectedOrder.description && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">메모</span>
                          <span>{selectedOrder.description}</span>
                        </div>
                      )}
                    </div>

                    {/* 아이템 목록 */}
                    <div className="border-t pt-4">
                      <div className="text-sm font-medium mb-2">
                        품목 목록
                        {filterProcess !== 'all' && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({getProcessName(filterProcess)} 필터)
                          </span>
                        )}
                      </div>
                      {filteredSelectedOrderItems.length > 0 ? (
                        <div className="space-y-2">
                          {filteredSelectedOrderItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 border rounded-lg text-sm"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{item.productCode}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {getProcessName(item.processCode)}
                                    {item.crimpCode && ` | ${item.crimpCode}`}
                                  </div>
                                </div>
                                {getItemStatusBadge(item.status)}
                              </div>
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span>진행률</span>
                                  <span>
                                    {item.completedQty} / {item.plannedQty}
                                  </span>
                                </div>
                                <Progress
                                  value={(item.completedQty / item.plannedQty) * 100}
                                  className="h-2"
                                />
                              </div>
                              <div className="mt-2">
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {item.barcode}
                                </code>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          품목이 없습니다
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="default"
                        className="flex-1"
                        size="sm"
                        onClick={() => handlePrint(selectedOrder)}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        인쇄
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        size="sm"
                        onClick={() => handleDownload(selectedOrder)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        다운로드
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>발주서를 선택하세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 공정별 현황 */}
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>공정별 진행 현황</CardTitle>
              <CardDescription>
                {format(filterDate, 'yyyy-MM-dd')} 기준
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processProgress.length > 0 ? (
                <div className="space-y-4">
                  {processProgress.map((progress) => (
                    <div key={progress.processCode} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{progress.processCode}</span>
                          <span className="text-muted-foreground ml-2">
                            {progress.processName}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{progress.totalCompleted}</span>
                          <span className="text-muted-foreground"> / {progress.totalPlanned}</span>
                          <span className="ml-2 text-muted-foreground">
                            ({progress.completedItems}/{progress.itemCount}건)
                          </span>
                        </div>
                      </div>
                      <Progress value={progress.progressPercent} className="h-3" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>진행 현황 데이터가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 발주서 등록 다이얼로그 */}
      <PurchaseOrderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onComplete={handleDialogComplete}
      />
    </div>
  )
}

export default PurchaseOrder
