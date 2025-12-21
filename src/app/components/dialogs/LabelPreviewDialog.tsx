/**
 * Label Preview Dialog
 *
 * 라벨 미리보기/인쇄 다이얼로그
 * - 라벨 미리보기
 * - 템플릿 선택
 * - 인쇄/다운로드
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Badge } from '@/app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Switch } from '@/app/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import {
  Tag,
  Printer,
  Download,
  Loader2,
  QrCode,
  BarChart3,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createLabel,
  createBundleLabel,
  previewLabel,
  printLabel,
  downloadLabel,
  getTemplates,
  type LotLabelData,
  type LabelTemplate,
  type LabelOptions,
} from '@/services/labelService'
import { format } from 'date-fns'

interface LabelPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lotData?: LotLabelData
  bundleData?: {
    bundleNo: string
    productCode: string
    productName: string
    setQty: number
    totalQty: number
  }
  onPrint?: () => void
}

export function LabelPreviewDialog({
  open,
  onOpenChange,
  lotData,
  bundleData,
  onPrint,
}: LabelPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [labelType, setLabelType] = useState<'lot' | 'bundle'>(bundleData ? 'bundle' : 'lot')

  // 라벨 옵션
  const [template, setTemplate] = useState<LabelTemplate>('100x150mm')
  const [showQR, setShowQR] = useState(true)
  const [showBarcode, setShowBarcode] = useState(true)
  const [copies, setCopies] = useState(1)

  // 템플릿 목록
  const templates = getTemplates()

  // 라벨 미리보기 생성
  const generatePreview = useCallback(async () => {
    setIsLoading(true)
    try {
      let pdf

      if (labelType === 'bundle' && bundleData) {
        pdf = await createBundleLabel(
          bundleData.bundleNo,
          bundleData.productCode,
          bundleData.productName,
          bundleData.setQty,
          bundleData.totalQty,
          format(new Date(), 'yyyy-MM-dd'),
          { template, showQR, showBarcode, showLogo: false, copies: 1 }
        )
      } else if (lotData) {
        pdf = await createLabel(lotData, {
          template,
          showQR,
          showBarcode,
          showLogo: false,
          copies: 1,
        })
      } else {
        throw new Error('라벨 데이터가 없습니다.')
      }

      // 이전 URL 해제
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      const url = previewLabel(pdf)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Generate preview error:', error)
      toast.error('라벨 미리보기 생성 실패')
    } finally {
      setIsLoading(false)
    }
  }, [labelType, lotData, bundleData, template, showQR, showBarcode, previewUrl])

  // 초기 미리보기 생성
  useEffect(() => {
    if (open && (lotData || bundleData)) {
      generatePreview()
    }

    // 다이얼로그 닫힐 때 URL 해제
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 인쇄 처리
  const handlePrint = async () => {
    setIsLoading(true)
    try {
      let pdf

      if (labelType === 'bundle' && bundleData) {
        pdf = await createBundleLabel(
          bundleData.bundleNo,
          bundleData.productCode,
          bundleData.productName,
          bundleData.setQty,
          bundleData.totalQty,
          format(new Date(), 'yyyy-MM-dd'),
          { template, showQR, showBarcode, showLogo: false, copies }
        )
      } else if (lotData) {
        pdf = await createLabel(lotData, {
          template,
          showQR,
          showBarcode,
          showLogo: false,
          copies,
        })
      } else {
        throw new Error('라벨 데이터가 없습니다.')
      }

      printLabel(pdf)
      onPrint?.()
      toast.success(`${copies}매 인쇄 요청 완료`)
    } catch (error) {
      console.error('Print error:', error)
      toast.error('인쇄 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 다운로드 처리
  const handleDownload = async () => {
    setIsLoading(true)
    try {
      let pdf
      let filename

      if (labelType === 'bundle' && bundleData) {
        pdf = await createBundleLabel(
          bundleData.bundleNo,
          bundleData.productCode,
          bundleData.productName,
          bundleData.setQty,
          bundleData.totalQty,
          format(new Date(), 'yyyy-MM-dd'),
          { template, showQR, showBarcode, showLogo: false, copies }
        )
        filename = `bundle_${bundleData.bundleNo}`
      } else if (lotData) {
        pdf = await createLabel(lotData, {
          template,
          showQR,
          showBarcode,
          showLogo: false,
          copies,
        })
        filename = `label_${lotData.lotNumber}`
      } else {
        throw new Error('라벨 데이터가 없습니다.')
      }

      downloadLabel(pdf, filename)
      toast.success('다운로드 완료')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('다운로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 라벨 정보 표시
  const getLabelInfo = () => {
    if (labelType === 'bundle' && bundleData) {
      return {
        title: bundleData.bundleNo,
        subtitle: `${bundleData.productCode} - ${bundleData.productName}`,
        info: `번들 ${bundleData.setQty}개 | 총 ${bundleData.totalQty}개`,
      }
    }

    if (lotData) {
      return {
        title: lotData.lotNumber,
        subtitle: `${lotData.productCode || ''} - ${lotData.productName || ''}`,
        info: `${lotData.processCode} | ${lotData.quantity}개`,
      }
    }

    return { title: '-', subtitle: '-', info: '-' }
  }

  const labelInfo = getLabelInfo()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            라벨 미리보기
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* 좌측: 미리보기 */}
          <div className="col-span-2 space-y-4">
            {/* 라벨 정보 */}
            <div className="bg-slate-50 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-lg">{labelInfo.title}</p>
                  <p className="text-sm text-slate-500">{labelInfo.subtitle}</p>
                </div>
                <Badge variant="outline" className="text-lg">
                  {labelInfo.info}
                </Badge>
              </div>
            </div>

            {/* 미리보기 프레임 */}
            <div className="border rounded-lg bg-white">
              {isLoading ? (
                <div className="h-[500px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-slate-500">미리보기 생성 중...</span>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[500px]"
                  title="Label Preview"
                />
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-400">
                  미리보기를 생성할 수 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 우측: 설정 패널 */}
          <div className="space-y-6">
            <Tabs defaultValue="options" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="options">
                  <Settings2 className="h-4 w-4 mr-1" />
                  옵션
                </TabsTrigger>
                <TabsTrigger value="print">
                  <Printer className="h-4 w-4 mr-1" />
                  인쇄
                </TabsTrigger>
              </TabsList>

              <TabsContent value="options" className="space-y-4 mt-4">
                {/* 템플릿 선택 */}
                <div className="space-y-2">
                  <Label>라벨 템플릿</Label>
                  <Select
                    value={template}
                    onValueChange={(v) => setTemplate(v as LabelTemplate)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* QR 코드 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-slate-500" />
                    <Label>QR 코드</Label>
                  </div>
                  <Switch checked={showQR} onCheckedChange={setShowQR} />
                </div>

                {/* 바코드 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <Label>1D 바코드</Label>
                  </div>
                  <Switch checked={showBarcode} onCheckedChange={setShowBarcode} />
                </div>

                {/* 미리보기 새로고침 */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={generatePreview}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  미리보기 새로고침
                </Button>
              </TabsContent>

              <TabsContent value="print" className="space-y-4 mt-4">
                {/* 출력 매수 */}
                <div className="space-y-2">
                  <Label>출력 매수</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                  />
                </div>

                {/* 인쇄 버튼 */}
                <Button
                  className="w-full"
                  onClick={handlePrint}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4 mr-2" />
                  )}
                  인쇄 ({copies}매)
                </Button>

                {/* 다운로드 버튼 */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownload}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  PDF 다운로드
                </Button>
              </TabsContent>
            </Tabs>

            {/* 라벨 유형 선택 (둘 다 있을 경우) */}
            {lotData && bundleData && (
              <div className="space-y-2">
                <Label>라벨 유형</Label>
                <Select
                  value={labelType}
                  onValueChange={(v) => {
                    setLabelType(v as 'lot' | 'bundle')
                    setTimeout(generatePreview, 100)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lot">LOT 라벨</SelectItem>
                    <SelectItem value="bundle">번들 라벨</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LabelPreviewDialog
