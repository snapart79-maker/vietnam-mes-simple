/**
 * Label Template Component
 *
 * 라벨 템플릿 컴포넌트
 * - 템플릿 크기 선택 (100x150mm, 75x125mm, 50x80mm)
 * - QR 코드 + 바코드 표시
 * - 미리보기 및 인쇄 기능
 */
import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { QRCodeView, type QRCodeData } from './QRCodeView'
import { BarcodeView } from './BarcodeView'
import {
  type LabelTemplate as LabelTemplateType,
  type LotLabelData,
  createLabel,
  downloadLabel,
  printLabel,
  previewLabel,
  getTemplates,
} from '@/services/labelService'
import { getProcessName } from '@/services/barcodeService'

export interface LabelTemplateProps {
  data: LotLabelData
  onPrint?: () => void
  onDownload?: () => void
  className?: string
}

export function LabelTemplate({
  data,
  onPrint,
  onDownload,
  className = '',
}: LabelTemplateProps) {
  const [template, setTemplate] = useState<LabelTemplateType>('100x150mm')
  const [showQR, setShowQR] = useState(true)
  const [showBarcode, setShowBarcode] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const templates = getTemplates()
  const selectedTemplate = templates.find((t) => t.id === template)

  // QR 데이터 생성
  const qrData: QRCodeData = {
    lotNumber: data.lotNumber,
    processCode: data.processCode,
    productCode: data.productCode,
    quantity: data.quantity,
    date: data.date,
  }

  // PDF 생성 및 다운로드
  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const pdf = await createLabel(data, { template, showQR, showBarcode })
      downloadLabel(pdf, `label_${data.lotNumber}`)
      onDownload?.()
    } catch (error) {
      console.error('라벨 다운로드 오류:', error)
      alert('라벨 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  // PDF 생성 및 인쇄
  const handlePrint = async () => {
    setIsGenerating(true)
    try {
      const pdf = await createLabel(data, { template, showQR, showBarcode })
      printLabel(pdf)
      onPrint?.()
    } catch (error) {
      console.error('라벨 인쇄 오류:', error)
      alert('라벨 인쇄에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  // PDF 미리보기
  const handlePreview = async () => {
    setIsGenerating(true)
    try {
      const pdf = await createLabel(data, { template, showQR, showBarcode })
      const url = previewLabel(pdf)
      window.open(url, '_blank')
    } catch (error) {
      console.error('미리보기 오류:', error)
      alert('미리보기 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 옵션 선택 */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        {/* 템플릿 선택 */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">템플릿 크기</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as LabelTemplateType)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* QR/바코드 토글 */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showQR}
              onChange={(e) => setShowQR(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm">QR 코드</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showBarcode}
              onChange={(e) => setShowBarcode(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm">바코드</span>
          </label>
        </div>
      </div>

      {/* 라벨 미리보기 */}
      <div className="flex justify-center p-4 bg-gray-100 rounded-lg">
        <div
          className="bg-white border-2 border-dashed border-gray-300 shadow-lg"
          style={{
            width: `${(selectedTemplate?.width || 100) * 2.5}px`,
            minHeight: `${(selectedTemplate?.height || 150) * 2.5}px`,
            padding: '16px',
          }}
        >
          {/* 제목 */}
          <h3 className="text-lg font-bold text-center border-b pb-2 mb-3">
            {getProcessName(data.processCode)}
          </h3>

          {/* LOT 정보 */}
          <div className="text-sm space-y-1 mb-3">
            <p>
              <span className="font-medium">LOT:</span> {data.lotNumber}
            </p>
            {data.productCode && (
              <p>
                <span className="font-medium">품번:</span> {data.productCode}
              </p>
            )}
            {data.productName && (
              <p className="text-xs text-gray-600 truncate">
                <span className="font-medium">품명:</span> {data.productName}
              </p>
            )}
            <p>
              <span className="font-medium">수량:</span>{' '}
              {data.quantity.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-medium">일자:</span> {data.date}
            </p>
            {data.lineCode && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">라인:</span> {data.lineCode}
              </p>
            )}
            {data.workerName && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">작업자:</span> {data.workerName}
              </p>
            )}
          </div>

          {/* QR 코드 */}
          {showQR && (
            <div className="flex justify-center mb-3">
              <QRCodeView
                data={qrData}
                size={template === '50x80mm' ? 60 : template === '75x125mm' ? 80 : 100}
                level="M"
              />
            </div>
          )}

          {/* 바코드 */}
          {showBarcode && (
            <div className="flex justify-center">
              <BarcodeView
                value={data.lotNumber}
                height={template === '50x80mm' ? 30 : template === '75x125mm' ? 40 : 50}
                width={template === '50x80mm' ? 1 : 2}
                fontSize={template === '50x80mm' ? 8 : 10}
                margin={5}
              />
            </div>
          )}
        </div>
      </div>

      {/* 버튼 그룹 */}
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={handlePreview}
          disabled={isGenerating}
        >
          미리보기
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={isGenerating}
        >
          다운로드
        </Button>
        <Button onClick={handlePrint} disabled={isGenerating}>
          인쇄
        </Button>
      </div>
    </div>
  )
}

export default LabelTemplate
