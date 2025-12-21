/**
 * Material Receiving Page
 *
 * 자재 입고 관리 (DB 연동)
 * - 바코드 파싱 (barcodeService)
 * - 재고 등록 (stockService)
 * - 본사 바코드 연동
 */
import React, { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadImportTemplate } from '@/services/excelImportService'
import { parseHQBarcode, type ParsedHQBarcode } from '@/services/barcodeService'
// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import { receiveStock, getTodayReceivings, type ReceiveStockInput } from '@/services/mock/stockService.mock'
import { getMaterialByCode } from '@/services/mock/materialService.mock'
import { ExcelImportDialog } from '../components/dialogs/ExcelImportDialog'

interface ScannedItem {
  id: number
  barcode: string
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  unit: string
  time: string
  status: 'success' | 'error' | 'pending'
  error?: string
}

export const MaterialReceiving = () => {
  const [barcode, setBarcode] = useState('')
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // 금일 입고 내역 로드
  const loadTodayReceivings = useCallback(async () => {
    try {
      const receivings = await getTodayReceivings()
      const items: ScannedItem[] = receivings.map((r) => ({
        id: r.id,
        barcode: r.lotNumber,
        materialCode: r.material.code,
        materialName: r.material.name,
        lotNumber: r.lotNumber,
        quantity: r.quantity,
        unit: r.material.unit,
        time: new Date(r.receivedAt).toLocaleTimeString(),
        status: 'success' as const,
      }))
      setScannedItems(items)
    } catch (error) {
      console.error('Failed to load today receivings:', error)
    }
  }, [])

  useEffect(() => {
    loadTodayReceivings()
  }, [loadTodayReceivings])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
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

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim()) return

    setIsProcessing(true)

    try {
      // 1. 바코드 파싱
      const parsed = parseHQBarcode(barcode.trim())

      if (!parsed) {
        // 바코드 형식이 맞지 않으면 직접 입력으로 처리
        toast.error('올바른 바코드 형식이 아닙니다. 수동 입력을 시도합니다.')
        setIsProcessing(false)
        return
      }

      const qty = parsed.quantity || 1

      // 2. 자재 조회
      const material = await getMaterialByCode(parsed.materialCode)

      if (!material) {
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcode.trim(),
          materialCode: parsed.materialCode,
          materialName: '(미등록 자재)',
          lotNumber: parsed.lotNumber,
          quantity: qty,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: '미등록 자재',
        }
        setScannedItems((prev) => [errorItem, ...prev])
        toast.error(`자재 코드 ${parsed.materialCode}가 등록되어 있지 않습니다.`)
        setBarcode('')
        setIsProcessing(false)
        return
      }

      // 3. 재고 등록
      const stockInput: ReceiveStockInput = {
        materialId: material.id,
        materialCode: material.code,
        lotNumber: parsed.lotNumber,
        quantity: qty,
      }

      const result = await receiveStock(stockInput)

      if (result.success) {
        const newItem: ScannedItem = {
          id: result.stock?.id || Date.now(),
          barcode: barcode.trim(),
          materialCode: material.code,
          materialName: material.name,
          lotNumber: parsed.lotNumber,
          quantity: qty,
          unit: material.unit,
          time: new Date().toLocaleTimeString(),
          status: 'success',
        }
        setScannedItems((prev) => [newItem, ...prev])
        toast.success(`${material.name} ${qty}${material.unit} 입고 완료`)
      } else {
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcode.trim(),
          materialCode: material.code,
          materialName: material.name,
          lotNumber: parsed.lotNumber,
          quantity: qty,
          unit: material.unit,
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: result.error,
        }
        setScannedItems((prev) => [errorItem, ...prev])
        toast.error(result.error || '입고 처리 실패')
      }
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('바코드 처리 중 오류가 발생했습니다.')
    } finally {
      setBarcode('')
      setIsProcessing(false)
    }
  }

  // 수동 입고 처리 (바코드 파싱 실패 시)
  const handleManualReceive = async (
    materialCode: string,
    lotNumber: string,
    quantity: number
  ) => {
    const material = await getMaterialByCode(materialCode)
    if (!material) {
      toast.error('자재를 찾을 수 없습니다.')
      return
    }

    const result = await receiveStock({
      materialId: material.id,
      materialCode: material.code,
      lotNumber,
      quantity,
    })

    if (result.success) {
      loadTodayReceivings()
      toast.success('입고 완료')
    } else {
      toast.error(result.error || '입고 실패')
    }
  }

  const successCount = scannedItems.filter((i) => i.status === 'success').length
  const errorCount = scannedItems.filter((i) => i.status === 'error').length

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
          <Card>
            <CardHeader>
              <CardTitle>스캔 입력</CardTitle>
              <CardDescription>
                본사 바코드를 스캔하여 입고 처리합니다. (형식:
                자재코드-LOT번호-수량)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="flex gap-4">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="바코드를 스캔하세요..."
                    className="pl-9"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    autoFocus
                    disabled={isProcessing}
                  />
                </div>
                <Button type="submit" disabled={isProcessing || !barcode.trim()}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PackagePlus className="mr-2 h-4 w-4" />
                  )}
                  입고 확정
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  금일 입고 내역 ({scannedItems.length})
                </CardTitle>
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">성공: {successCount}</span>
                  {errorCount > 0 && (
                    <span className="text-red-600">오류: {errorCount}</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">시간</th>
                      <th className="px-4 py-3">자재코드</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scannedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          스캔된 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      scannedItems.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.status === 'error' ? 'bg-red-50' : ''
                          }
                        >
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
                            {item.status === 'success' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                <Check className="w-3 h-3 mr-1" /> 완료
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
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                처리중
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
        onOpenChange={setShowImportDialog}
        importType="stock"
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
