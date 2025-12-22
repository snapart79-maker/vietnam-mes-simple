/**
 * Material Receiving Page
 *
 * 자재 입고 관리 (DB 연동)
 * - 바코드 파싱 (barcodeService)
 * - 재고 등록 (stockService)
 * - 본사 바코드 연동
 * - 다중 바코드 스캔 → 선택 → 공정 선택 → 일괄 입고 확정
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Checkbox } from '../components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Label } from '../components/ui/label'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  ScanBarcode,
  FileSpreadsheet,
  Check,
  X,
  PackagePlus,
  Loader2,
  AlertCircle,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadImportTemplate } from '@/services/excelImportService'
import { parseHQBarcode, type ParsedHQBarcode } from '@/services/barcodeService'
// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import { receiveStock, getTodayReceivings, isLotExists, type ReceiveStockInput } from '@/services/mock/stockService.mock'
import { ExcelImportDialog } from '../components/dialogs/ExcelImportDialog'
// MaterialContext에서 HQ 코드로 자재 조회
import { useMaterial } from '@/app/context/MaterialContext'
// 공정 목록
import { PROCESS_SEED_DATA } from '@/services/processService'

interface ScannedItem {
  id: number
  barcode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  unit: string
  time: string
  status: 'success' | 'error' | 'pending'
  error?: string
  selected: boolean
}

interface ConfirmedItem extends ScannedItem {
  processCode: string
}

export const MaterialReceiving = () => {
  const [barcode, setBarcode] = useState('')
  const [pendingItems, setPendingItems] = useState<ScannedItem[]>([])  // 스캔된 대기 항목
  const [confirmedItems, setConfirmedItems] = useState<ScannedItem[]>([])  // 확정된 항목
  const [isProcessing, setIsProcessing] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [selectedProcess, setSelectedProcess] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInputTimeRef = useRef<number>(0)

  // MaterialContext에서 자재 조회 함수 가져오기
  const { getMaterialByHQCode, getMaterialByCode } = useMaterial()

  // 자재 투입 공정만 필터링 (hasMaterialInput: true)
  const materialInputProcesses = PROCESS_SEED_DATA.filter(p => p.hasMaterialInput)

  // 금일 입고 내역 로드
  const loadTodayReceivings = useCallback(async () => {
    try {
      const receivings = await getTodayReceivings()
      const items: ScannedItem[] = receivings.map((r) => ({
        id: r.id,
        barcode: r.lotNumber,
        materialId: 0,
        materialCode: r.material.code,
        materialName: r.material.name,
        lotNumber: r.lotNumber,
        quantity: r.quantity,
        unit: r.material.unit,
        time: new Date(r.receivedAt).toLocaleTimeString(),
        status: 'success' as const,
        selected: false,
      }))
      setConfirmedItems(items)
    } catch (error) {
      console.error('Failed to load today receivings:', error)
    }
  }, [])

  useEffect(() => {
    loadTodayReceivings()
  }, [loadTodayReceivings])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setDroppedFile(acceptedFiles[0])
      setShowImportDialog(true)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
  })

  const handleDownloadTemplate = () => {
    downloadImportTemplate('receiving')
    toast.success('양식 파일이 다운로드되었습니다.')
  }

  // 바코드 입력 핸들러 (자동 스캔 감지)
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBarcode(value)

    // 기존 타이머 취소
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // 입력이 있으면 자동 스캔 타이머 설정 (300ms 후 자동 처리)
    if (value.trim()) {
      const now = Date.now()
      const timeSinceLastInput = now - lastInputTimeRef.current
      lastInputTimeRef.current = now

      // 바코드 스캐너는 빠르게 입력됨 (50ms 이내)
      // 300ms 동안 추가 입력이 없으면 스캔 완료로 판단
      scanTimeoutRef.current = setTimeout(() => {
        if (!isProcessing && value.trim()) {
          processBarcode(value.trim())
        }
      }, 300)
    }
  }

  // 바코드 처리 로직 (대기 목록에 추가)
  const processBarcode = async (barcodeValue: string) => {
    if (!barcodeValue || isProcessing) return

    setIsProcessing(true)

    try {
      // 1. 바코드 파싱
      const parsed = parseHQBarcode(barcodeValue)

      if (!parsed || !parsed.isValid) {
        // 바코드 형식이 맞지 않으면 오류 표시
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: 0,
          materialCode: barcodeValue,
          materialName: '(인식 불가)',
          lotNumber: '',
          quantity: 0,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: '바코드 형식 오류',
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error('올바른 바코드 형식이 아닙니다.')
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      const qty = parsed.quantity || 1
      const hqCode = parsed.materialCode // 바코드에서 추출한 본사 코드
      const lotNumber = parsed.lotNumber

      // 2. 중복 LOT 체크 (이미 입고된 LOT)
      if (isLotExists(lotNumber)) {
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: 0,
          materialCode: hqCode,
          materialName: '(중복 LOT)',
          lotNumber: lotNumber,
          quantity: qty,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: '이미 입고된 LOT',
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(`LOT ${lotNumber}은(는) 이미 입고되어 있습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 3. 대기 목록 중복 체크
      const isDuplicateInPending = pendingItems.some(
        (item) => item.lotNumber === lotNumber && item.status === 'pending'
      )
      if (isDuplicateInPending) {
        toast.warning(`LOT ${lotNumber}은(는) 이미 대기 목록에 있습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 4. 자재 조회 (본사 코드 → MES 자재)
      const material = getMaterialByHQCode(hqCode)

      if (!material) {
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: 0,
          materialCode: hqCode,
          materialName: '(미등록 자재)',
          lotNumber: parsed.lotNumber,
          quantity: qty,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: `본사코드 ${hqCode} 미등록`,
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(`본사 코드 ${hqCode}에 해당하는 자재가 등록되어 있지 않습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 5. 대기 목록에 추가 (pending 상태)
      const newItem: ScannedItem = {
        id: Date.now(),
        barcode: barcodeValue,
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        lotNumber: parsed.lotNumber,
        quantity: qty,
        unit: material.unit,
        time: new Date().toLocaleTimeString(),
        status: 'pending',
        selected: true,  // 기본 선택됨
      }
      setPendingItems((prev) => [newItem, ...prev])
      toast.success(`${material.name} ${qty}${material.unit} 스캔 완료`)
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('바코드 처리 중 오류가 발생했습니다.')
    } finally {
      setBarcode('')
      setIsProcessing(false)
      inputRef.current?.focus()
    }
  }

  // 폼 제출 핸들러 (Enter 키)
  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim() || isProcessing) return

    // 타이머 취소하고 즉시 처리
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
    processBarcode(barcode.trim())
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  // 선택 토글
  const toggleSelection = (id: number) => {
    setPendingItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const pendingValidItems = pendingItems.filter(i => i.status === 'pending')
    const allSelected = pendingValidItems.every((i) => i.selected)
    setPendingItems((prev) =>
      prev.map((item) =>
        item.status === 'pending' ? { ...item, selected: !allSelected } : item
      )
    )
  }

  // 선택 삭제
  const handleDeleteSelected = () => {
    const selectedCount = pendingItems.filter((i) => i.selected).length
    if (selectedCount === 0) {
      toast.error('삭제할 항목을 선택하세요.')
      return
    }
    setPendingItems((prev) => prev.filter((i) => !i.selected))
    toast.success(`${selectedCount}건 삭제됨`)
  }

  // 입고 확정 (선택된 항목만)
  const handleConfirmReceiving = async () => {
    const selectedItems = pendingItems.filter((i) => i.selected && i.status === 'pending')

    if (selectedItems.length === 0) {
      toast.error('입고할 항목을 선택하세요.')
      return
    }

    if (!selectedProcess) {
      toast.error('공정을 선택하세요.')
      return
    }

    setIsProcessing(true)

    let successCount = 0
    let failCount = 0

    for (const item of selectedItems) {
      try {
        const stockInput: ReceiveStockInput = {
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          lotNumber: item.lotNumber,
          quantity: item.quantity,
        }

        const result = await receiveStock(stockInput)

        if (result.success) {
          successCount++
          // 성공한 항목은 확정 목록으로 이동
          setConfirmedItems((prev) => [
            { ...item, status: 'success', selected: false },
            ...prev,
          ])
        } else {
          failCount++
          // 실패한 항목은 오류 표시
          setPendingItems((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, status: 'error', error: result.error } : p
            )
          )
        }
      } catch (error) {
        failCount++
        setPendingItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: 'error', error: '입고 처리 실패' }
              : p
          )
        )
      }
    }

    // 성공한 항목은 대기 목록에서 제거
    setPendingItems((prev) => prev.filter((i) => i.status !== 'success' && !selectedItems.some(s => s.id === i.id && i.status === 'pending')))

    setIsProcessing(false)

    if (successCount > 0) {
      const processName = materialInputProcesses.find(p => p.code === selectedProcess)?.name || selectedProcess
      toast.success(`${successCount}건 입고 완료 (공정: ${processName})`)
    }
    if (failCount > 0) {
      toast.error(`${failCount}건 입고 실패`)
    }

    inputRef.current?.focus()
  }

  // 확정 목록 선택 토글
  const toggleConfirmedSelection = (id: number) => {
    setConfirmedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  // 확정 목록 선택 삭제 (표시만 삭제, 실제 재고는 유지)
  const handleDeleteConfirmed = () => {
    const selectedCount = confirmedItems.filter((i) => i.selected).length
    if (selectedCount === 0) {
      toast.error('삭제할 항목을 선택하세요.')
      return
    }
    setConfirmedItems((prev) => prev.filter((i) => !i.selected))
    toast.success(`${selectedCount}건 목록에서 삭제됨 (재고는 유지됨)`)
  }

  const pendingValidCount = pendingItems.filter((i) => i.status === 'pending').length
  const pendingSelectedCount = pendingItems.filter((i) => i.selected && i.status === 'pending').length
  const pendingErrorCount = pendingItems.filter((i) => i.status === 'error').length
  const confirmedSelectedCount = confirmedItems.filter((i) => i.selected).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">자재 입고 관리</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            양식 다운로드
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="scan">바코드 스캔 입고</TabsTrigger>
          <TabsTrigger value="manual">엑셀 일괄 업로드</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4 mt-4">
          {/* 바코드 스캔 입력 */}
          <Card>
            <CardHeader>
              <CardTitle>스캔 입력</CardTitle>
              <CardDescription>
                바코드를 스캔하면 자동으로 대기 목록에 추가됩니다. 공정을 선택하고 입고를 확정하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleScan} className="flex gap-4">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    ref={inputRef}
                    placeholder="바코드를 스캔하세요... (자동 추가됨)"
                    className="pl-9"
                    value={barcode}
                    onChange={handleBarcodeChange}
                    autoFocus
                    disabled={isProcessing}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={isProcessing || !barcode.trim()}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanBarcode className="mr-2 h-4 w-4" />
                  )}
                  스캔 추가
                </Button>
              </form>

              {/* 공정 선택 및 입고 확정 */}
              <div className="flex flex-col sm:flex-row gap-4 items-end pt-2 border-t">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="process">입고 공정 선택</Label>
                  <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                    <SelectTrigger id="process" className="w-full">
                      <SelectValue placeholder="공정을 선택하세요..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materialInputProcesses.map((process) => (
                        <SelectItem key={process.code} value={process.code}>
                          {process.code} - {process.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDeleteSelected}
                    disabled={isProcessing || pendingItems.filter(i => i.selected).length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    선택 삭제
                  </Button>
                  <Button
                    onClick={handleConfirmReceiving}
                    disabled={isProcessing || pendingSelectedCount === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PackagePlus className="mr-2 h-4 w-4" />
                    )}
                    입고 확정 ({pendingSelectedCount}건)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 스캔 대기 목록 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  스캔 대기 목록 ({pendingItems.length})
                </CardTitle>
                <div className="flex gap-2 text-sm">
                  <span className="text-blue-600">선택: {pendingSelectedCount}</span>
                  {pendingErrorCount > 0 && (
                    <span className="text-red-600">오류: {pendingErrorCount}</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={pendingValidCount > 0 && pendingItems.filter(i => i.status === 'pending').every(i => i.selected)}
                          onCheckedChange={toggleSelectAll}
                          disabled={pendingValidCount === 0}
                        />
                      </th>
                      <th className="px-4 py-3">시간</th>
                      <th className="px-4 py-3">자재품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          스캔된 내역이 없습니다. 바코드를 스캔하세요.
                        </td>
                      </tr>
                    ) : (
                      pendingItems.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.status === 'error'
                              ? 'bg-red-50'
                              : item.selected
                              ? 'bg-blue-50'
                              : ''
                          }
                        >
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleSelection(item.id)}
                              disabled={item.status === 'error'}
                            />
                          </td>
                          <td className="px-4 py-3">{item.time}</td>
                          <td className="px-4 py-3 font-mono">
                            {item.materialCode}
                          </td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.lotNumber}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {item.quantity.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.status === 'pending' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                <ScanBarcode className="w-3 h-3 mr-1" /> 대기
                              </span>
                            ) : item.status === 'error' ? (
                              <span
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700"
                                title={item.error}
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {item.error || '오류'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                <Check className="w-3 h-3 mr-1" /> 완료
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 금일 입고 확정 내역 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  금일 입고 내역 ({confirmedItems.length})
                </CardTitle>
                <div className="flex gap-2 items-center">
                  {confirmedSelectedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteConfirmed}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      선택 삭제 ({confirmedSelectedCount})
                    </Button>
                  )}
                  <span className="text-sm text-green-600">
                    완료: {confirmedItems.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={confirmedItems.length > 0 && confirmedItems.every(i => i.selected)}
                          onCheckedChange={() => {
                            const allSelected = confirmedItems.every(i => i.selected)
                            setConfirmedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })))
                          }}
                          disabled={confirmedItems.length === 0}
                        />
                      </th>
                      <th className="px-4 py-3">시간</th>
                      <th className="px-4 py-3">자재품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {confirmedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          입고 확정된 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      confirmedItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.selected ? 'bg-blue-50' : ''}
                        >
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleConfirmedSelection(item.id)}
                            />
                          </td>
                          <td className="px-4 py-3">{item.time}</td>
                          <td className="px-4 py-3 font-mono">
                            {item.materialCode}
                          </td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.lotNumber}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {item.quantity.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              <Check className="w-3 h-3 mr-1" /> 완료
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>파일 업로드</CardTitle>
              <CardDescription>
                엑셀 파일을 드래그하여 업로드하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="font-medium">
                    파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs">지원 형식: .xlsx, .xls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={showImportDialog}
        onOpenChange={(open) => {
          setShowImportDialog(open)
          if (!open) {
            setDroppedFile(null)  // 다이얼로그 닫을 때 파일 초기화
          }
        }}
        importType="receiving"
        initialFile={droppedFile}
        onImportComplete={(result) => {
          if (result.success) {
            loadTodayReceivings()
            toast.success(`${result.importedRows}건 입고 완료`)
          }
        }}
      />
    </div>
  )
}

export default MaterialReceiving
