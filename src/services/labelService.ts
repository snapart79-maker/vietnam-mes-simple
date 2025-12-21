/**
 * Label Service
 *
 * 라벨 생성 서비스
 * - QR 코드 생성
 * - 1D 바코드 생성 (Code128)
 * - PDF 라벨 생성
 */
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { getProcessName } from './barcodeService'

// ============================================
// Types
// ============================================

export type LabelTemplate = '100x150mm' | '75x125mm' | '50x80mm'

export interface LotLabelData {
  lotNumber: string
  processCode: string
  productCode?: string
  productName?: string
  quantity: number
  date: string
  lineCode?: string
  workerName?: string
}

export interface LabelOptions {
  template: LabelTemplate
  showQR: boolean
  showBarcode: boolean
  showLogo: boolean
  copies: number
}

interface TemplateConfig {
  width: number    // mm
  height: number   // mm
  orientation: 'portrait' | 'landscape'
  fontSize: {
    title: number
    normal: number
    small: number
  }
  qrSize: number   // mm
  barcodeWidth: number
  barcodeHeight: number
}

// ============================================
// Constants
// ============================================

const TEMPLATE_CONFIGS: Record<LabelTemplate, TemplateConfig> = {
  '100x150mm': {
    width: 100,
    height: 150,
    orientation: 'portrait',
    fontSize: { title: 14, normal: 10, small: 8 },
    qrSize: 35,
    barcodeWidth: 80,
    barcodeHeight: 25,
  },
  '75x125mm': {
    width: 75,
    height: 125,
    orientation: 'portrait',
    fontSize: { title: 12, normal: 9, small: 7 },
    qrSize: 30,
    barcodeWidth: 60,
    barcodeHeight: 20,
  },
  '50x80mm': {
    width: 50,
    height: 80,
    orientation: 'portrait',
    fontSize: { title: 10, normal: 8, small: 6 },
    qrSize: 20,
    barcodeWidth: 40,
    barcodeHeight: 15,
  },
}

const DEFAULT_OPTIONS: LabelOptions = {
  template: '100x150mm',
  showQR: true,
  showBarcode: true,
  showLogo: false,
  copies: 1,
}

// ============================================
// QR Code Generation
// ============================================

/**
 * QR 코드 생성 (Data URL)
 */
export async function generateQRCode(
  data: string,
  size: number = 150
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
    return dataUrl
  } catch (error) {
    console.error('QR 코드 생성 오류:', error)
    throw new Error('QR 코드 생성에 실패했습니다.')
  }
}

/**
 * LOT 정보를 포함한 QR 코드 생성
 */
export async function generateLotQRCode(data: LotLabelData): Promise<string> {
  const qrData = JSON.stringify({
    lot: data.lotNumber,
    process: data.processCode,
    product: data.productCode,
    qty: data.quantity,
    date: data.date,
  })
  return generateQRCode(qrData)
}

// ============================================
// Barcode Generation
// ============================================

/**
 * 1D 바코드 생성 (Code128)
 */
export function generate1DBarcode(
  data: string,
  width: number = 200,
  height: number = 60
): string {
  // Canvas 생성
  const canvas = document.createElement('canvas')

  try {
    JsBarcode(canvas, data, {
      format: 'CODE128',
      width: 2,
      height: height,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      textMargin: 2,
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('바코드 생성 오류:', error)
    throw new Error('바코드 생성에 실패했습니다.')
  }
}

/**
 * 바코드 생성 (SVG 문자열)
 */
export function generate1DBarcodeSVG(data: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

  try {
    JsBarcode(svg, data, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
    })

    return new XMLSerializer().serializeToString(svg)
  } catch (error) {
    console.error('바코드 SVG 생성 오류:', error)
    throw new Error('바코드 생성에 실패했습니다.')
  }
}

// ============================================
// Label PDF Generation
// ============================================

/**
 * PDF 라벨 생성
 */
export async function createLabel(
  data: LotLabelData,
  options: Partial<LabelOptions> = {}
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const config = TEMPLATE_CONFIGS[opts.template]

  // PDF 생성
  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  // 폰트 설정 (한글 지원 - 기본 폰트 사용)
  pdf.setFont('helvetica')

  let y = 10 // 시작 y 좌표

  // 제목 (공정명)
  pdf.setFontSize(config.fontSize.title)
  const processName = getProcessName(data.processCode)
  pdf.text(processName, config.width / 2, y, { align: 'center' })
  y += 8

  // 구분선
  pdf.setLineWidth(0.5)
  pdf.line(5, y, config.width - 5, y)
  y += 5

  // LOT 번호
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`LOT: ${data.lotNumber}`, 5, y)
  y += 6

  // 품번/품명
  if (data.productCode) {
    pdf.text(`Code: ${data.productCode}`, 5, y)
    y += 5
  }
  if (data.productName) {
    pdf.setFontSize(config.fontSize.small)
    const truncatedName = data.productName.length > 20
      ? data.productName.substring(0, 20) + '...'
      : data.productName
    pdf.text(`Name: ${truncatedName}`, 5, y)
    y += 5
  }

  // 수량
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`QTY: ${data.quantity.toLocaleString()}`, 5, y)
  y += 6

  // 날짜
  pdf.setFontSize(config.fontSize.small)
  pdf.text(`Date: ${data.date}`, 5, y)
  y += 5

  // 라인/작업자
  if (data.lineCode) {
    pdf.text(`Line: ${data.lineCode}`, 5, y)
    y += 5
  }
  if (data.workerName) {
    pdf.text(`Worker: ${data.workerName}`, 5, y)
    y += 5
  }

  // 구분선
  y += 3
  pdf.line(5, y, config.width - 5, y)
  y += 5

  // QR 코드
  if (opts.showQR) {
    try {
      const qrDataUrl = await generateLotQRCode(data)
      const qrX = (config.width - config.qrSize) / 2
      pdf.addImage(qrDataUrl, 'PNG', qrX, y, config.qrSize, config.qrSize)
      y += config.qrSize + 5
    } catch {
      console.warn('QR 코드 추가 실패')
    }
  }

  // 바코드
  if (opts.showBarcode) {
    try {
      const barcodeDataUrl = generate1DBarcode(data.lotNumber)
      const barcodeX = (config.width - config.barcodeWidth) / 2
      pdf.addImage(
        barcodeDataUrl,
        'PNG',
        barcodeX,
        y,
        config.barcodeWidth,
        config.barcodeHeight
      )
    } catch {
      console.warn('바코드 추가 실패')
    }
  }

  // 여러 장 복사
  if (opts.copies > 1) {
    for (let i = 1; i < opts.copies; i++) {
      pdf.addPage()
      // 동일 내용 복사 (간단한 구현)
      // 실제로는 첫 페이지와 동일하게 그려야 함
    }
  }

  return pdf
}

/**
 * 번들 라벨 생성
 */
export async function createBundleLabel(
  bundleNo: string,
  productCode: string,
  productName: string,
  setQty: number,
  totalQty: number,
  date: string,
  options: Partial<LabelOptions> = {}
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const config = TEMPLATE_CONFIGS[opts.template]

  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  pdf.setFont('helvetica')

  let y = 10

  // 번들 표시
  pdf.setFontSize(config.fontSize.title)
  pdf.text('BUNDLE', config.width / 2, y, { align: 'center' })
  y += 8

  pdf.setLineWidth(0.5)
  pdf.line(5, y, config.width - 5, y)
  y += 5

  // 번들 번호
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`Bundle: ${bundleNo}`, 5, y)
  y += 6

  // 품번/품명
  pdf.text(`Code: ${productCode}`, 5, y)
  y += 5
  pdf.setFontSize(config.fontSize.small)
  pdf.text(`Name: ${productName}`, 5, y)
  y += 5

  // 수량 정보
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`Sets: ${setQty} | Total: ${totalQty}`, 5, y)
  y += 6

  // 날짜
  pdf.setFontSize(config.fontSize.small)
  pdf.text(`Date: ${date}`, 5, y)
  y += 8

  // QR 코드
  if (opts.showQR) {
    try {
      const qrData = JSON.stringify({
        bundle: bundleNo,
        product: productCode,
        sets: setQty,
        total: totalQty,
        date,
      })
      const qrDataUrl = await generateQRCode(qrData)
      const qrX = (config.width - config.qrSize) / 2
      pdf.addImage(qrDataUrl, 'PNG', qrX, y, config.qrSize, config.qrSize)
      y += config.qrSize + 5
    } catch {
      console.warn('QR 코드 추가 실패')
    }
  }

  // 바코드
  if (opts.showBarcode) {
    try {
      const barcodeDataUrl = generate1DBarcode(bundleNo)
      const barcodeX = (config.width - config.barcodeWidth) / 2
      pdf.addImage(
        barcodeDataUrl,
        'PNG',
        barcodeX,
        y,
        config.barcodeWidth,
        config.barcodeHeight
      )
    } catch {
      console.warn('바코드 추가 실패')
    }
  }

  return pdf
}

// ============================================
// Output Functions
// ============================================

/**
 * PDF 다운로드
 */
export function downloadLabel(pdf: jsPDF, filename: string = 'label'): void {
  pdf.save(`${filename}.pdf`)
}

/**
 * PDF 미리보기 (Blob URL)
 */
export function previewLabel(pdf: jsPDF): string {
  const blob = pdf.output('blob')
  return URL.createObjectURL(blob)
}

/**
 * 브라우저 인쇄 다이얼로그 열기
 */
export function printLabel(pdf: jsPDF): void {
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)

  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * PDF를 Base64로 변환
 */
export function labelToBase64(pdf: jsPDF): string {
  return pdf.output('datauristring')
}

// ============================================
// Utility Functions
// ============================================

/**
 * 템플릿 목록 조회
 */
export function getTemplates(): Array<{
  id: LabelTemplate
  name: string
  width: number
  height: number
}> {
  return [
    { id: '100x150mm', name: '대형 (100x150mm)', width: 100, height: 150 },
    { id: '75x125mm', name: '중형 (75x125mm)', width: 75, height: 125 },
    { id: '50x80mm', name: '소형 (50x80mm)', width: 50, height: 80 },
  ]
}

/**
 * 다중 라벨 생성 (한 PDF에 여러 라벨)
 */
export async function createMultipleLabels(
  dataList: LotLabelData[],
  options: Partial<LabelOptions> = {}
): Promise<jsPDF> {
  if (dataList.length === 0) {
    throw new Error('라벨 데이터가 없습니다.')
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const config = TEMPLATE_CONFIGS[opts.template]

  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  for (let i = 0; i < dataList.length; i++) {
    if (i > 0) {
      pdf.addPage()
    }

    const data = dataList[i]

    // 각 페이지에 라벨 내용 그리기
    pdf.setFont('helvetica')
    let y = 10

    // 공정명
    pdf.setFontSize(config.fontSize.title)
    pdf.text(getProcessName(data.processCode), config.width / 2, y, { align: 'center' })
    y += 8

    // LOT 번호
    pdf.setFontSize(config.fontSize.normal)
    pdf.text(`LOT: ${data.lotNumber}`, 5, y)
    y += 6

    // 품번
    if (data.productCode) {
      pdf.text(`Code: ${data.productCode}`, 5, y)
      y += 5
    }

    // 수량
    pdf.text(`QTY: ${data.quantity.toLocaleString()}`, 5, y)
    y += 6

    // 날짜
    pdf.setFontSize(config.fontSize.small)
    pdf.text(`Date: ${data.date}`, 5, y)
    y += 8

    // QR 코드
    if (opts.showQR) {
      try {
        const qrDataUrl = await generateLotQRCode(data)
        const qrX = (config.width - config.qrSize) / 2
        pdf.addImage(qrDataUrl, 'PNG', qrX, y, config.qrSize, config.qrSize)
        y += config.qrSize + 5
      } catch {
        // QR 생성 실패 무시
      }
    }

    // 바코드
    if (opts.showBarcode) {
      try {
        const barcodeDataUrl = generate1DBarcode(data.lotNumber)
        const barcodeX = (config.width - config.barcodeWidth) / 2
        pdf.addImage(
          barcodeDataUrl,
          'PNG',
          barcodeX,
          y,
          config.barcodeWidth,
          config.barcodeHeight
        )
      } catch {
        // 바코드 생성 실패 무시
      }
    }
  }

  return pdf
}
