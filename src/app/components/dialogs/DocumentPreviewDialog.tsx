/**
 * Document Preview Dialog
 *
 * A4 생산 전표 미리보기 및 인쇄 다이얼로그
 * Barcord 프로젝트 document_generator.py 참조 구현
 */
import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Printer, Download, FileText, QrCode, Barcode, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { registerKoreanFont } from '@/lib/koreanFont'
import { translate, getStoredLocale } from '@/lib/i18n'
import { hasBusinessAPI, getAPI } from '@/lib/electronBridge'
import { getProcessName } from '@/services/barcodeService'

// ============================================
// i18n Helper
// 생산 전표는 공식 문서이므로 항상 한국어로 출력
// ============================================

function tr(key: string, params?: Record<string, string | number>): string {
  // 생산 문서는 항상 한국어로 출력 (회사 표준)
  return translate('ko', key, params)
}

// ============================================
// Types (Barcord document_generator.py 참조)
// ============================================

export interface InputMaterialInfo {
  lotNumber: string
  productCode: string
  name: string
  quantity: number
  unit: string
  sourceType: 'material' | 'production'
  processCode?: string
  depth?: number
  bomQuantity?: number
  deductedQuantity?: number
}

export interface DocumentData {
  lotNumber: string
  productCode: string
  productName: string
  quantity: number
  unit: string
  productionDate: Date
  processCode: string
  processName: string
  inputMaterials: InputMaterialInfo[]
  crimpProductCode?: string
  lineCode?: string
  plannedQuantity?: number
  completedQuantity?: number
  defectQuantity?: number
  workerName?: string
}

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: DocumentData | null
  lotId?: number  // lotId 제공 시 DB에서 최신 데이터 조회
  onPrint?: () => void
}

// ============================================
// Constants
// ============================================

const PAGE_CONFIG = {
  width: 210,  // A4 width in mm
  height: 297, // A4 height in mm
  margin: {
    top: 15,
    right: 15,
    bottom: 15,
    left: 15,
  },
}

// PROCESS_NAMES는 i18n 함수 tr('process.XX')로 대체됨

// ============================================
// Component
// ============================================

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  data,
  lotId,
  onPrint,
}: DocumentPreviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(true)
  const [showBarcode, setShowBarcode] = useState(true)
  const [showMaterials, setShowMaterials] = useState(true)
  const [dbData, setDbData] = useState<DocumentData | null>(null)
  const [isLoadingDb, setIsLoadingDb] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // lotId가 있으면 DB에서 최신 데이터 조회
  useEffect(() => {
    if (open && lotId && hasBusinessAPI()) {
      setIsLoadingDb(true)
      const api = getAPI()
      api!.production.getLotById(lotId)
        .then((result: { success: boolean; data?: unknown; error?: string }) => {
          if (result.success && result.data) {
            const lot = result.data as {
              id: number
              lotNumber: string
              processCode: string
              status: string
              plannedQty: number
              completedQty: number
              defectQty: number
              lineCode?: string
              startedAt: string
              product?: { code: string; name: string }
              worker?: { name: string }
              crimpCode?: string
              lotMaterials?: Array<{
                materialLotNo: string
                materialCode?: string
                materialName?: string
                quantity: number
                material?: { code: string; name: string }
              }>
            }
            // DB 데이터를 DocumentData 형식으로 변환
            const docData: DocumentData = {
              lotNumber: lot.lotNumber,
              productCode: lot.product?.code || '-',
              productName: lot.product?.name || '-',
              quantity: lot.completedQty || lot.plannedQty,
              unit: 'EA',
              productionDate: new Date(lot.startedAt),
              processCode: lot.processCode,
              processName: getProcessName(lot.processCode),
              inputMaterials: (lot.lotMaterials || []).map(lm => ({
                lotNumber: lm.materialLotNo,
                productCode: lm.materialCode || lm.material?.code || '-',
                name: lm.materialName || lm.material?.name || '-',
                quantity: lm.quantity,
                unit: 'EA',
                sourceType: 'material' as const,
                processCode: lot.processCode,
              })),
              crimpProductCode: lot.crimpCode,
              lineCode: lot.lineCode,
              plannedQuantity: lot.plannedQty,
              completedQuantity: lot.completedQty,
              defectQuantity: lot.defectQty,
              workerName: lot.worker?.name,
            }
            setDbData(docData)
          }
        })
        .catch((error: unknown) => {
          console.error('LOT 조회 실패:', error)
          toast.error('LOT 데이터 조회에 실패했습니다.')
        })
        .finally(() => {
          setIsLoadingDb(false)
        })
    } else {
      setDbData(null)
    }
  }, [open, lotId])

  // 실제 사용할 데이터 (DB 데이터 우선, 없으면 props 데이터)
  const documentData = dbData || data

  // PDF 생성
  useEffect(() => {
    if (open && documentData && !isLoadingDb) {
      generatePDF()
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [open, documentData, showQR, showBarcode, showMaterials, isLoadingDb])

  const generatePDF = async () => {
    if (!documentData) return

    setIsGenerating(true)

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // 한글 폰트 등록
      const fontRegistered = await registerKoreanFont(pdf)
      if (!fontRegistered) {
        console.warn('한글 폰트 등록 실패, 기본 폰트 사용')
      }

      const { margin } = PAGE_CONFIG
      const contentWidth = PAGE_CONFIG.width - margin.left - margin.right
      let y = margin.top

      // ========================================
      // 1. 헤더 영역 - 제목 (Barcord 스타일, i18n)
      // ========================================
      pdf.setFontSize(20)
      pdf.setTextColor(0, 0, 0)
      pdf.text(tr('document.title'), PAGE_CONFIG.width / 2, y, { align: 'center' })
      y += 10

      // ========================================
      // 2. 기본 정보 섹션 (Barcord 4열 테이블 스타일, i18n)
      // ========================================
      pdf.setFontSize(11)
      pdf.setTextColor(25, 118, 210) // #1976d2
      pdf.text(tr('document.basic_info'), margin.left, y)
      y += 6

      // 4열 테이블 (라벨 | 값 | 라벨 | 값)
      const labelWidth = 22
      const valueWidth = 68
      const tableRowHeight = 8
      const dateStr = formatDateWithTime(documentData.productionDate)

      // 테이블 그리기 함수
      const drawInfoRow = (
        label1: string, value1: string,
        label2: string, value2: string,
        rowY: number
      ) => {
        // 배경색
        pdf.setFillColor(227, 242, 253) // #e3f2fd
        pdf.rect(margin.left, rowY, labelWidth, tableRowHeight, 'F')
        pdf.rect(margin.left + labelWidth + valueWidth, rowY, labelWidth, tableRowHeight, 'F')

        // 테두리
        pdf.setDrawColor(189, 189, 189) // #bdbdbd
        pdf.setLineWidth(0.3)
        pdf.rect(margin.left, rowY, labelWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth, rowY, valueWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth + valueWidth, rowY, labelWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth * 2 + valueWidth, rowY, valueWidth, tableRowHeight, 'S')

        // 라벨 텍스트
        pdf.setFontSize(9)
        pdf.setTextColor(21, 101, 192) // #1565c0
        pdf.text(label1, margin.left + labelWidth / 2, rowY + 5.5, { align: 'center' })
        pdf.text(label2, margin.left + labelWidth + valueWidth + labelWidth / 2, rowY + 5.5, { align: 'center' })

        // 값 텍스트
        pdf.setTextColor(0, 0, 0)
        pdf.text(truncate(value1, 30), margin.left + labelWidth + 2, rowY + 5.5)
        pdf.text(truncate(value2, 30), margin.left + labelWidth * 2 + valueWidth + 2, rowY + 5.5)
      }

      // 기본 정보 행 (i18n 적용)
      const processName = tr(`process.${documentData.processCode}`) || documentData.processName
      drawInfoRow(tr('document.voucher_number'), documentData.lotNumber, tr('document.process'), `${documentData.processCode} - ${processName}`, y)
      y += tableRowHeight
      drawInfoRow(tr('document.issue_date'), dateStr, tr('document.line'), documentData.lineCode || '-', y)
      y += tableRowHeight
      drawInfoRow(tr('document.product_code'), documentData.productCode, tr('document.product_name'), truncate(documentData.productName, 25), y)
      y += tableRowHeight

      // CA 공정인 경우 절압착품번/완제품품번 추가 (i18n 적용)
      if (documentData.processCode === 'CA' && documentData.crimpProductCode) {
        drawInfoRow(tr('document.crimp_product_code'), documentData.crimpProductCode, tr('document.finished_product_code'), documentData.productCode, y)
        y += tableRowHeight
      }

      drawInfoRow(tr('document.operator'), documentData.workerName || '-', tr('document.remarks'), '-', y)
      y += tableRowHeight + 6

      // ========================================
      // 3. 수량 정보 섹션 (Barcord 4열 테이블 스타일, i18n)
      // ========================================
      pdf.setFontSize(11)
      pdf.setTextColor(25, 118, 210)
      pdf.text(tr('document.quantity_info'), margin.left, y)
      y += 6

      // 수량 정보 테이블
      const drawQtyRow = (
        label1: string, value1: string,
        label2: string, value2: string,
        rowY: number
      ) => {
        // 배경색 (주황색 계열)
        pdf.setFillColor(255, 243, 224) // #fff3e0
        pdf.rect(margin.left, rowY, labelWidth, tableRowHeight, 'F')
        pdf.rect(margin.left + labelWidth + valueWidth, rowY, labelWidth, tableRowHeight, 'F')

        // 테두리
        pdf.setDrawColor(189, 189, 189)
        pdf.setLineWidth(0.3)
        pdf.rect(margin.left, rowY, labelWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth, rowY, valueWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth + valueWidth, rowY, labelWidth, tableRowHeight, 'S')
        pdf.rect(margin.left + labelWidth * 2 + valueWidth, rowY, valueWidth, tableRowHeight, 'S')

        // 라벨 텍스트
        pdf.setFontSize(9)
        pdf.setTextColor(230, 81, 0) // #e65100
        pdf.text(label1, margin.left + labelWidth / 2, rowY + 5.5, { align: 'center' })
        pdf.text(label2, margin.left + labelWidth + valueWidth + labelWidth / 2, rowY + 5.5, { align: 'center' })

        // 값 텍스트 (우측 정렬)
        pdf.setTextColor(0, 0, 0)
        pdf.text(value1, margin.left + labelWidth + valueWidth - 2, rowY + 5.5, { align: 'right' })
        pdf.text(value2, margin.left + labelWidth * 2 + valueWidth * 2 - 2, rowY + 5.5, { align: 'right' })
      }

      const plannedQty = documentData.plannedQuantity ?? documentData.quantity
      const completedQty = documentData.completedQuantity ?? documentData.quantity
      const defectQty = documentData.defectQuantity ?? 0

      drawQtyRow(
        tr('document.planned_qty'), `${plannedQty.toLocaleString()} ${documentData.unit}`,
        tr('document.completed_qty'), `${completedQty.toLocaleString()} ${documentData.unit}`,
        y
      )
      y += tableRowHeight
      drawQtyRow(
        tr('document.defect_qty'), `${defectQty.toLocaleString()} ${documentData.unit}`,
        tr('document.carry_over_out'), `0 ${documentData.unit}`,
        y
      )
      y += tableRowHeight + 6

      // ========================================
      // 4. 투입 자재 / 투입 이력 테이블 (Barcord 스타일, i18n)
      // ========================================
      if (showMaterials && documentData.inputMaterials.length > 0) {
        pdf.setFontSize(11)
        pdf.setTextColor(25, 118, 210) // #1976d2
        pdf.text(tr('document.input_materials'), margin.left, y)
        y += 6

        // 테이블 헤더 (Barcord 스타일 - 파란색 배경, i18n 적용)
        const tableHeaders = [
          tr('document.table_no'),
          tr('document.table_type'),
          tr('document.table_product_code'),
          tr('document.table_product_name'),
          tr('document.table_lot'),
          tr('document.table_qty')
        ]
        const colWidths = [8, 15, 30, 40, 58, 25]
        const headerHeight = 7

        // 헤더 배경색 (파란색)
        pdf.setFillColor(25, 118, 210) // #1976d2
        pdf.rect(margin.left, y, contentWidth, headerHeight, 'F')

        // 헤더 텍스트 (흰색)
        pdf.setFontSize(9)
        pdf.setTextColor(255, 255, 255)

        let x = margin.left
        for (let i = 0; i < tableHeaders.length; i++) {
          pdf.text(tableHeaders[i], x + colWidths[i] / 2, y + 5, { align: 'center' })
          x += colWidths[i]
        }

        y += headerHeight

        // 테이블 데이터
        const dataRowHeight = 6
        for (let i = 0; i < Math.min(documentData.inputMaterials.length, 15); i++) {
          const mat = documentData.inputMaterials[i]

          // 줄무늬 배경 (짝수행)
          if (i % 2 === 1) {
            pdf.setFillColor(250, 250, 250) // #fafafa
            pdf.rect(margin.left, y, contentWidth, dataRowHeight, 'F')
          }

          // 테두리
          pdf.setDrawColor(189, 189, 189) // #bdbdbd
          pdf.setLineWidth(0.3)
          pdf.rect(margin.left, y, contentWidth, dataRowHeight, 'S')

          pdf.setFontSize(8)
          pdf.setTextColor(0, 0, 0)

          // 유형 레이블 (i18n 적용)
          let typeLabel = mat.sourceType === 'material' ? tr('document.type_material') : tr('document.type_history')
          if (mat.processCode && mat.sourceType === 'production') {
            typeLabel = mat.processCode  // 공정 코드는 그대로 표시 (예: CA, MC)
          }

          x = margin.left
          const rowData = [
            String(i + 1),
            typeLabel,
            truncate(mat.productCode, 12),
            truncate(mat.name, 18),
            truncate(mat.lotNumber, 25),
            `${mat.quantity.toLocaleString()} ${mat.unit}`,
          ]

          for (let j = 0; j < rowData.length; j++) {
            // No와 유형은 중앙정렬, 수량은 우측정렬
            if (j === 0 || j === 1) {
              pdf.text(rowData[j], x + colWidths[j] / 2, y + 4, { align: 'center' })
            } else if (j === rowData.length - 1) {
              pdf.text(rowData[j], x + colWidths[j] - 2, y + 4, { align: 'right' })
            } else {
              pdf.text(rowData[j], x + 2, y + 4)
            }
            x += colWidths[j]
          }

          y += dataRowHeight
        }

        if (documentData.inputMaterials.length > 15) {
          pdf.setFontSize(8)
          pdf.setTextColor(128, 128, 128)
          pdf.text(`... 외 ${documentData.inputMaterials.length - 15}건`, margin.left, y + 4)
          y += 6
        }

        y += 8
      }

      // ========================================
      // 5. 바코드 영역 (Barcord 스타일)
      // ========================================
      const barcodeY = Math.max(y, PAGE_CONFIG.height - 85)

      if (showQR || showBarcode) {
        pdf.setFontSize(11)
        pdf.setTextColor(25, 118, 210) // #1976d2
        pdf.text(tr('document.barcode_section'), margin.left, barcodeY)
      }

      const barcodeContentY = barcodeY + 5

      // QR 코드
      if (showQR) {
        const qrData = JSON.stringify({
          lot: documentData.lotNumber,
          process: documentData.processCode,
          product: documentData.productCode,
          qty: documentData.quantity,
          date: formatDate(documentData.productionDate),
        })

        try {
          const qrCanvas = document.createElement('canvas')
          await QRCode.toCanvas(qrCanvas, qrData, {
            width: 100,
            margin: 1,
            errorCorrectionLevel: 'M',
          })

          const qrDataUrl = qrCanvas.toDataURL('image/png')
          pdf.addImage(qrDataUrl, 'PNG', margin.left, barcodeContentY, 25, 25)
        } catch (e) {
          console.error('QR 생성 실패:', e)
        }
      }

      // 1D 바코드 (Code128)
      if (showBarcode) {
        try {
          const barcodeCanvas = document.createElement('canvas')
          JsBarcode(barcodeCanvas, documentData.lotNumber, {
            format: 'CODE128',
            width: 2,
            height: 40,
            displayValue: true,
            fontSize: 10,
            margin: 5,
          })

          const barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
          const barcodeX = showQR ? margin.left + 35 : margin.left
          const barcodeWidth = showQR ? 100 : 130

          pdf.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeContentY, barcodeWidth, 20)
        } catch (e) {
          console.error('바코드 생성 실패:', e)
        }
      }

      // 바코드 번호 표시
      pdf.setFontSize(9)
      pdf.setTextColor(0, 0, 0)
      pdf.text(documentData.lotNumber, PAGE_CONFIG.width / 2, barcodeContentY + 28, { align: 'center' })

      // ========================================
      // 6. 서명란 (Barcord 스타일 - 작성/검토/승인)
      // ========================================
      const signY = PAGE_CONFIG.height - margin.bottom - 22
      const signBoxWidth = 40
      const signBoxHeight = 15
      const signGap = 5
      const totalSignWidth = signBoxWidth * 3 + signGap * 2
      const signStartX = (PAGE_CONFIG.width - totalSignWidth) / 2

      // 헤더 배경
      pdf.setFillColor(245, 245, 245) // #f5f5f5
      pdf.rect(signStartX, signY, signBoxWidth, 7, 'F')
      pdf.rect(signStartX + signBoxWidth + signGap, signY, signBoxWidth, 7, 'F')
      pdf.rect(signStartX + (signBoxWidth + signGap) * 2, signY, signBoxWidth, 7, 'F')

      // 테두리
      pdf.setDrawColor(189, 189, 189) // #bdbdbd
      pdf.setLineWidth(0.5)
      pdf.rect(signStartX, signY, signBoxWidth, 7 + signBoxHeight, 'S')
      pdf.rect(signStartX + signBoxWidth + signGap, signY, signBoxWidth, 7 + signBoxHeight, 'S')
      pdf.rect(signStartX + (signBoxWidth + signGap) * 2, signY, signBoxWidth, 7 + signBoxHeight, 'S')

      // 구분선
      pdf.line(signStartX, signY + 7, signStartX + signBoxWidth, signY + 7)
      pdf.line(signStartX + signBoxWidth + signGap, signY + 7, signStartX + signBoxWidth * 2 + signGap, signY + 7)
      pdf.line(signStartX + (signBoxWidth + signGap) * 2, signY + 7, signStartX + signBoxWidth * 3 + signGap * 2, signY + 7)

      // 라벨 텍스트 (i18n 적용)
      pdf.setFontSize(10)
      pdf.setTextColor(0, 0, 0)
      pdf.text(tr('document.sign_create'), signStartX + signBoxWidth / 2, signY + 5, { align: 'center' })
      pdf.text(tr('document.sign_review'), signStartX + signBoxWidth + signGap + signBoxWidth / 2, signY + 5, { align: 'center' })
      pdf.text(tr('document.sign_approve'), signStartX + (signBoxWidth + signGap) * 2 + signBoxWidth / 2, signY + 5, { align: 'center' })

      // ========================================
      // 7. 푸터
      // ========================================
      pdf.setFontSize(7)
      pdf.setTextColor(150, 150, 150)
      pdf.text(
        `생성일시: ${new Date().toLocaleString('ko-KR')}`,
        PAGE_CONFIG.width - margin.right,
        PAGE_CONFIG.height - 5,
        { align: 'right' }
      )

      // PDF URL 생성
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }

      setPdfUrl(url)
    } catch (error) {
      console.error('PDF 생성 실패:', error)
      toast.error('PDF 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  // 인쇄
  const handlePrint = () => {
    if (iframeRef.current && pdfUrl) {
      iframeRef.current.contentWindow?.print()
      onPrint?.()
    }
  }

  // 다운로드
  const handleDownload = () => {
    if (!pdfUrl || !documentData) return

    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `전표_${documentData.lotNumber}_${formatDate(documentData.productionDate)}.pdf`
    link.click()

    toast.success('전표가 다운로드되었습니다.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            생산 전표 미리보기
          </DialogTitle>
          <DialogDescription>
            {documentData ? `${documentData.processName} - ${documentData.lotNumber}` : (isLoadingDb ? 'DB에서 데이터 조회 중...' : '전표를 생성 중입니다...')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="preview">미리보기</TabsTrigger>
            <TabsTrigger value="options">옵션</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-4">
            {isGenerating ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2">PDF 생성 중...</span>
              </div>
            ) : pdfUrl ? (
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="w-full h-full border rounded-lg"
                title="전표 미리보기"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                전표 데이터가 없습니다.
              </div>
            )}
          </TabsContent>

          <TabsContent value="options" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">바코드 옵션</h3>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    QR 코드 표시
                  </Label>
                  <Switch checked={showQR} onCheckedChange={setShowQR} />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Barcode className="w-4 h-4" />
                    1D 바코드 표시
                  </Label>
                  <Switch checked={showBarcode} onCheckedChange={setShowBarcode} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">내용 옵션</h3>

                <div className="flex items-center justify-between">
                  <Label>투입 자재 표시</Label>
                  <Switch checked={showMaterials} onCheckedChange={setShowMaterials} />
                </div>
              </div>
            </div>

            {documentData && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h3 className="font-semibold mb-3">전표 정보</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500">LOT:</span>
                    <Badge variant="outline">{documentData.lotNumber}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500">공정:</span>
                    <Badge>{documentData.processCode}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500">품번:</span>
                    <span>{documentData.productCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500">수량:</span>
                    <span>{documentData.quantity.toLocaleString()} {documentData.unit}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500">투입자재:</span>
                    <span>{documentData.inputMaterials.length}건</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!pdfUrl}>
            <Download className="w-4 h-4 mr-2" />
            다운로드
          </Button>
          <Button onClick={handlePrint} disabled={!pdfUrl}>
            <Printer className="w-4 h-4 mr-2" />
            인쇄
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateWithTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 2) + '..'
}

export default DocumentPreviewDialog
