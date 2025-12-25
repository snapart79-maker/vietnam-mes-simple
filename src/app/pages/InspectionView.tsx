/**
 * Inspection View Page
 *
 * 품질 검사 화면 (DB 연동)
 * - 바코드 스캔으로 LOT 조회
 * - 검사 결과 기록 (PASS/FAIL)
 * - 불량 사유 선택
 * - 금일 검사 통계
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import { CheckCircle2, XCircle, Scan, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useProduction } from '../context/ProductionContext'
import { parseBarcode } from '@/services/barcodeService'
import { hasBusinessAPI, getAPI } from '@/lib/electronBridge'

// 검사 관련 타입 정의
export type InspectionType = 'CIRCUIT' | 'VISUAL' | 'CRIMP'
export type InspectionResult = 'PASS' | 'FAIL' | 'PENDING'

export interface InspectionStats {
  total: number
  pass: number
  fail: number
  pending: number
  byType: {
    [key: string]: {
      total: number
      pass: number
      fail: number
    }
  }
}

interface CreateInspectionInput {
  lotId: number
  type: InspectionType
  result: InspectionResult
  inspectorId?: string
  defectReason?: string
  defectQty?: number
}

interface CurrentLot {
  id: number
  lotNumber: string
  productCode: string
  productName: string
  processCode: string
  quantity: number
}

// 검사 생성 함수 (Electron API)
async function createInspection(input: CreateInspectionInput): Promise<boolean> {
  if (!hasBusinessAPI()) {
    console.warn('[InspectionView] Electron API not available')
    return false
  }
  try {
    const api = getAPI()
    const result = await api!.inspection.create({
      lotId: input.lotId,
      inspectorId: input.inspectorId,
      result: input.result,
      defectCount: input.defectQty,
      defectType: input.defectReason,
      notes: input.type,
    })
    return result.success
  } catch (err) {
    console.error('[InspectionView] createInspection error:', err)
    return false
  }
}

// 금일 통계 조회 (로컬 스텁 - API 미구현)
async function getTodayInspectionSummary(): Promise<InspectionStats> {
  // TODO: Electron API에 통계 기능 추가 후 구현
  return {
    total: 0,
    pass: 0,
    fail: 0,
    pending: 0,
    byType: {
      CIRCUIT: { total: 0, pass: 0, fail: 0 },
      VISUAL: { total: 0, pass: 0, fail: 0 },
      CRIMP: { total: 0, pass: 0, fail: 0 },
    },
  }
}

export const InspectionView = () => {
  const { type } = useParams<{ type: string }>()
  const { user } = useAuth()
  const { getLotByNumber } = useProduction()
  const [barcode, setBarcode] = useState('')
  const [currentLot, setCurrentLot] = useState<CurrentLot | null>(null)
  const [failModalOpen, setFailModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [todayStats, setTodayStats] = useState<InspectionStats | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 검사 유형 매핑
  const getInspectionType = (): InspectionType => {
    switch (type) {
      case 'ci':
        return 'CIRCUIT'
      case 'vi':
        return 'VISUAL'
      case 'crimp':
        return 'CRIMP'
      default:
        return 'VISUAL'
    }
  }

  const inspectionType = getInspectionType()

  const title =
    type === 'ci'
      ? '회로 검사 (Circuit Inspection)'
      : type === 'vi'
        ? '육안 검사 (Visual Inspection)'
        : type === 'crimp'
          ? '압착 검사 (Crimp Inspection)'
          : '품질 검사'

  // 금일 통계 로드
  const loadTodayStats = useCallback(async () => {
    try {
      const stats = await getTodayInspectionSummary()
      setTodayStats(stats)
    } catch (error) {
      console.error('Failed to load today stats:', error)
    }
  }, [])

  useEffect(() => {
    loadTodayStats()
  }, [loadTodayStats])

  useEffect(() => {
    inputRef.current?.focus()
  }, [type, currentLot])

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  // 바코드 처리 로직
  const processBarcode = async (barcodeValue: string) => {
    if (!barcodeValue || isLoading) return

    setIsLoading(true)

    try {
      // 1. 바코드 파싱 - parsed.raw가 원본 바코드 (LOT 번호)
      const parsed = parseBarcode(barcodeValue)
      const lotNumber = parsed?.raw || barcodeValue

      // 2. LOT 조회
      const lot = await getLotByNumber(lotNumber)

      if (!lot) {
        toast.error(`LOT를 찾을 수 없습니다: ${lotNumber}`)
        setBarcode('')
        inputRef.current?.focus()
        setIsLoading(false)
        return
      }

      setCurrentLot({
        id: lot.id,
        lotNumber: lot.lotNumber,
        productCode: lot.productCode || '-',
        productName: lot.productName || '(제품 미지정)',
        processCode: lot.processCode,
        quantity: lot.completedQty,
      })

      toast.success(`LOT ${lot.lotNumber} 스캔 완료`)
      setBarcode('')
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('바코드 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
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
      scanTimeoutRef.current = setTimeout(() => {
        if (!isLoading && value.trim()) {
          processBarcode(value.trim())
        }
      }, 300)
    }
  }

  // 폼 제출 핸들러 (Enter 키)
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim() || isLoading) return

    // 타이머 취소하고 즉시 처리
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
    processBarcode(barcode.trim())
  }

  // 합격 처리
  const handlePass = async () => {
    if (!currentLot) return

    setIsProcessing(true)

    try {
      await createInspection({
        lotId: currentLot.id,
        type: inspectionType,
        result: 'PASS' as InspectionResult,
        inspectorId: user?.id,
      })

      toast.success(`${currentLot.lotNumber} 검사 합격`)
      setCurrentLot(null)
      loadTodayStats()
      inputRef.current?.focus()
    } catch (error) {
      console.error('Pass error:', error)
      toast.error('검사 결과 저장 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 불량 처리
  const handleFail = () => {
    setFailModalOpen(true)
  }

  // 불량 확정
  const confirmFail = async (reason: string) => {
    if (!currentLot) return

    setIsProcessing(true)

    try {
      await createInspection({
        lotId: currentLot.id,
        type: inspectionType,
        result: 'FAIL' as InspectionResult,
        defectReason: reason,
        defectQty: 1, // 기본 1개, 필요 시 수량 입력 UI 추가 가능
        inspectorId: user?.id,
      })

      toast.error(`${currentLot.lotNumber} 검사 불량 - ${reason}`)
      setFailModalOpen(false)
      setCurrentLot(null)
      loadTodayStats()
      inputRef.current?.focus()
    } catch (error) {
      console.error('Fail error:', error)
      toast.error('검사 결과 저장 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 현재 검사 유형 통계
  const currentTypeStats = todayStats?.byType[inspectionType]
  const passCount = currentTypeStats?.pass || 0
  const failCount = currentTypeStats?.fail || 0

  // 불량 사유 목록 (검사 유형별)
  const getDefectReasons = (): string[] => {
    switch (inspectionType) {
      case 'CRIMP':
        return ['압착 불량', '피복 손상', '터미널 변형', '압착 높이 불량', '미삽입', '기타']
      case 'CIRCUIT':
        return ['단선', '단락', '저항 불량', '오배선', '접촉 불량', '기타']
      case 'VISUAL':
        return ['찍힘/스크래치', '오염/이물', '치수 불량', '미성형', '조립 불량', '기타']
      default:
        return ['불량', '기타']
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-100px)]">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h2>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-lg px-3 py-1">
            금일 합격:{' '}
            <span className="text-green-600 font-bold ml-1">
              {passCount.toLocaleString()}
            </span>
          </Badge>
          <Badge variant="outline" className="text-lg px-3 py-1">
            금일 불량:{' '}
            <span className="text-red-600 font-bold ml-1">{failCount.toLocaleString()}</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        {/* Left: Scan & Info */}
        <Card className="flex flex-col shadow-md border-slate-200">
          <CardContent className="p-8 flex flex-col items-center justify-center h-full space-y-8">
            {!currentLot ? (
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {isLoading ? (
                    <Loader2 size={48} className="text-blue-500 animate-spin" />
                  ) : (
                    <Scan size={48} className="text-slate-400" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-slate-700">검사 대상을 스캔하세요</h3>
                <form onSubmit={handleScan}>
                  <Input
                    ref={inputRef}
                    value={barcode}
                    onChange={handleBarcodeChange}
                    placeholder="바코드 스캔 (자동 처리)"
                    className="h-16 text-center text-xl shadow-inner bg-slate-50"
                    autoComplete="off"
                    disabled={isLoading}
                  />
                </form>
                {user && (
                  <p className="text-sm text-slate-400">
                    검사자: {user.name} ({user.role})
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full space-y-8 animate-in zoom-in-95 duration-200">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center space-y-2">
                  <Label className="text-blue-600 font-semibold">현재 검사 LOT</Label>
                  <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {currentLot.lotNumber}
                  </div>
                  <div className="text-xl text-slate-600">{currentLot.productName}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                    <Label className="text-slate-500">제품 코드</Label>
                    <div className="text-lg font-bold mt-1 font-mono">
                      {currentLot.productCode}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                    <Label className="text-slate-500">공정</Label>
                    <div className="text-lg font-bold mt-1">{currentLot.processCode}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                    <Label className="text-slate-500">완료 수량</Label>
                    <div className="text-lg font-bold mt-1">{currentLot.quantity} EA</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                    <Label className="text-slate-500">검사 유형</Label>
                    <div className="text-lg font-bold mt-1 text-blue-600">
                      {inspectionType === 'CRIMP'
                        ? '압착 검사'
                        : inspectionType === 'CIRCUIT'
                          ? '회로 검사'
                          : '육안 검사'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Action Buttons */}
        <div className="flex flex-col gap-4 h-full">
          <button
            onClick={handlePass}
            disabled={!currentLot || isProcessing}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-30 disabled:hover:bg-green-500 text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-4 group"
          >
            {isProcessing ? (
              <Loader2 size={80} className="animate-spin" />
            ) : (
              <CheckCircle2
                size={80}
                className="group-hover:scale-110 transition-transform"
              />
            )}
            <span className="text-5xl font-black tracking-widest">OK (합격)</span>
          </button>

          <button
            onClick={handleFail}
            disabled={!currentLot || isProcessing}
            className="h-1/3 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:hover:bg-red-100 text-red-600 border-4 border-red-200 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4"
          >
            <XCircle size={40} />
            <span className="text-3xl font-bold">NG (불량)</span>
          </button>
        </div>
      </div>

      {/* Fail Reason Modal */}
      <Dialog open={failModalOpen} onOpenChange={setFailModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={24} />
              불량 사유 선택
            </DialogTitle>
            <DialogDescription>발견된 불량 유형을 선택해주세요.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {getDefectReasons().map((reason) => (
              <Button
                key={reason}
                variant="outline"
                className="h-16 text-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={() => confirmFail(reason)}
                disabled={isProcessing}
              >
                {reason}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFailModalOpen(false)}
              disabled={isProcessing}
            >
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InspectionView
