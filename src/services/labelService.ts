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
import { registerKoreanFont } from '@/lib/koreanFont'
import { translate, getStoredLocale, type Locale } from '@/lib/i18n'

// ============================================
// i18n Helper (서비스에서 직접 사용)
// 라벨/전표는 생산 문서이므로 항상 한국어로 출력
// ============================================

function tr(key: string, params?: Record<string, string | number>): string {
  // 생산 문서는 항상 한국어로 출력 (회사 표준)
  return translate('ko', key, params)
}

// ============================================
// Types
// ============================================

// Barcord 스타일 라벨 크기 (작은 사이즈)
export type LabelTemplate = '75x45mm' | '50x30mm' | '100x50mm' | '80x40mm' | '60x40mm' | 'custom'

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
  // 사용자 정의 크기 (template이 'custom'일 때 사용)
  customWidth?: number  // mm
  customHeight?: number // mm
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
// Constants (Barcord 스타일 라벨 크기)
// ============================================

const TEMPLATE_CONFIGS: Record<Exclude<LabelTemplate, 'custom'>, TemplateConfig> = {
  '75x45mm': {
    width: 75,
    height: 45,
    orientation: 'landscape',
    fontSize: { title: 10, normal: 8, small: 6 },
    qrSize: 10,
    barcodeWidth: 60,
    barcodeHeight: 8,
  },
  '50x30mm': {
    width: 50,
    height: 30,
    orientation: 'landscape',
    fontSize: { title: 8, normal: 6, small: 5 },
    qrSize: 7,
    barcodeWidth: 40,
    barcodeHeight: 6,
  },
  '100x50mm': {
    width: 100,
    height: 50,
    orientation: 'landscape',
    fontSize: { title: 12, normal: 9, small: 7 },
    qrSize: 12,
    barcodeWidth: 80,
    barcodeHeight: 10,
  },
  '80x40mm': {
    width: 80,
    height: 40,
    orientation: 'landscape',
    fontSize: { title: 10, normal: 8, small: 6 },
    qrSize: 10,
    barcodeWidth: 65,
    barcodeHeight: 8,
  },
  '60x40mm': {
    width: 60,
    height: 40,
    orientation: 'landscape',
    fontSize: { title: 9, normal: 7, small: 6 },
    qrSize: 9,
    barcodeWidth: 50,
    barcodeHeight: 7,
  },
}

/**
 * 사용자 정의 크기로 TemplateConfig 생성
 */
function createCustomTemplateConfig(width: number, height: number): TemplateConfig {
  // 크기에 따라 폰트 크기와 요소 크기 비율 조정
  const scaleFactor = Math.min(width, height) / 45  // 기준: 75x45mm

  return {
    width,
    height,
    orientation: width >= height ? 'landscape' : 'portrait',
    fontSize: {
      title: Math.max(8, Math.min(14, Math.round(10 * scaleFactor))),
      normal: Math.max(6, Math.min(10, Math.round(8 * scaleFactor))),
      small: Math.max(5, Math.min(8, Math.round(6 * scaleFactor))),
    },
    qrSize: Math.max(7, Math.min(15, Math.round(10 * scaleFactor))),
    barcodeWidth: Math.max(40, Math.min(100, Math.round(width * 0.8))),
    barcodeHeight: Math.max(6, Math.min(12, Math.round(8 * scaleFactor))),
  }
}

/**
 * 옵션에서 TemplateConfig 가져오기
 */
function getTemplateConfig(opts: LabelOptions): TemplateConfig {
  if (opts.template === 'custom') {
    const width = opts.customWidth || 75
    const height = opts.customHeight || 45
    return createCustomTemplateConfig(width, height)
  }
  return TEMPLATE_CONFIGS[opts.template]
}

const DEFAULT_OPTIONS: LabelOptions = {
  template: '75x45mm',  // Barcord 기본 사이즈
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
  const opts = { ...DEFAULT_OPTIONS, ...options } as LabelOptions
  const config = getTemplateConfig(opts)

  // PDF 생성
  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  // 한글 폰트 등록
  const fontRegistered = await registerKoreanFont(pdf)
  if (!fontRegistered) {
    console.warn('한글 폰트 등록 실패, 기본 폰트 사용')
    pdf.setFont('helvetica')
  }

  /**
   * Barcord 스타일 라벨 레이아웃:
   * ┌─────────────────────────────┐
   * │ [CA] 자동절단압착      [QR] │
   * │ 품번: 00299318         [QR] │
   * │ LOT: CA00299318Q1000-C...   │
   * │ 수량: 1000 EA               │
   * │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (1D 바코드) │
   * │ 일시: 2025-12-11 22:52      │
   * └─────────────────────────────┘
   */

  const margin = 4
  let y = margin + 2

  // QR 코드 (우측 상단)
  const qrSize = Math.min(config.qrSize, config.height * 0.25)
  let qrDataUrl: string | null = null

  if (opts.showQR) {
    try {
      qrDataUrl = await generateLotQRCode(data)
      pdf.addImage(
        qrDataUrl,
        'PNG',
        config.width - margin - qrSize,
        margin,
        qrSize,
        qrSize
      )
    } catch {
      console.warn('QR 코드 추가 실패')
    }
  }

  // 텍스트 영역 너비 (QR이 있으면 그 왼쪽까지)
  const textWidth = opts.showQR ? config.width - margin * 2 - qrSize - 2 : config.width - margin * 2

  // 1. 공정명 ([CA] 자동절단압착)
  const processName = tr(`process.${data.processCode}`) || getProcessName(data.processCode)
  pdf.setFontSize(config.fontSize.title)
  pdf.setTextColor(0, 0, 0)
  pdf.text(`[${data.processCode}] ${processName}`, margin, y + 4)
  y += config.fontSize.title * 0.45

  // 2. 품번 (i18n 적용)
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`${tr('label_print.product_code_prefix')} ${data.productCode || '-'}`, margin, y + 4)
  y += config.fontSize.normal * 0.5

  // 3. LOT 번호 (길이에 따라 폰트 크기 조절)
  const lotNumber = data.lotNumber
  let lotFontSize = config.fontSize.normal
  if (lotNumber.length > 25) {
    lotFontSize = config.fontSize.small * 0.9
  } else if (lotNumber.length > 20) {
    lotFontSize = config.fontSize.small
  }
  pdf.setFontSize(lotFontSize)
  pdf.text(`${tr('label_print.lot_prefix')} ${lotNumber}`, margin, y + 4)
  y += lotFontSize * 0.5

  // 4. 수량 (i18n 적용)
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`${tr('label_print.quantity_prefix')} ${data.quantity.toLocaleString()} EA`, margin, y + 4)
  y += config.fontSize.normal * 0.6

  // 5. 1D 바코드 (중앙)
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
      y += config.barcodeHeight + 2
    } catch {
      console.warn('바코드 추가 실패')
    }
  }

  // 6. 일시 (하단) - i18n 적용
  pdf.setFontSize(config.fontSize.small)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`${tr('label_print.date_prefix')} ${data.date}`, margin, y + 3)

  // 테두리
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.rect(1, 1, config.width - 2, config.height - 2, 'S')

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
  const opts = { ...DEFAULT_OPTIONS, ...options } as LabelOptions
  const config = getTemplateConfig(opts)

  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  // 한글 폰트 등록
  const fontRegistered = await registerKoreanFont(pdf)
  if (!fontRegistered) {
    console.warn('한글 폰트 등록 실패, 기본 폰트 사용')
    pdf.setFont('helvetica')
  }

  /**
   * Barcord 스타일 번들 라벨 레이아웃
   */

  const margin = 4
  let y = margin + 2

  // QR 코드 (우측 상단)
  const qrSize = Math.min(config.qrSize, config.height * 0.25)

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
      pdf.addImage(
        qrDataUrl,
        'PNG',
        config.width - margin - qrSize,
        margin,
        qrSize,
        qrSize
      )
    } catch {
      console.warn('QR 코드 추가 실패')
    }
  }

  // 1. 번들 타이틀 (i18n 적용)
  pdf.setFontSize(config.fontSize.title)
  pdf.setTextColor(0, 0, 0)
  pdf.text(tr('label_print.bundle_title'), margin, y + 4)
  y += config.fontSize.title * 0.45

  // 2. 품번 (i18n 적용)
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`${tr('label_print.product_code_prefix')} ${productCode}`, margin, y + 4)
  y += config.fontSize.normal * 0.5

  // 3. 품명
  const truncatedName = productName.length > 20
    ? productName.substring(0, 20) + '..'
    : productName
  pdf.setFontSize(config.fontSize.small)
  pdf.text(`${tr('label.productName')}: ${truncatedName}`, margin, y + 4)
  y += config.fontSize.small * 0.5

  // 4. 번들 번호 (i18n 적용)
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`${tr('label_print.lot_prefix')} ${bundleNo}`, margin, y + 4)
  y += config.fontSize.normal * 0.5

  // 5. 수량 정보 (i18n 적용)
  pdf.setFontSize(config.fontSize.normal)
  pdf.text(`${tr('label_print.set_qty')} ${setQty}  |  ${tr('label_print.total_qty')} ${totalQty.toLocaleString()} EA`, margin, y + 4)
  y += config.fontSize.normal * 0.6

  // 6. 1D 바코드 (중앙)
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
      y += config.barcodeHeight + 2
    } catch {
      console.warn('바코드 추가 실패')
    }
  }

  // 7. 일시 (하단) - i18n 적용
  pdf.setFontSize(config.fontSize.small)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`${tr('label_print.date_prefix')} ${date}`, margin, y + 3)

  // 테두리
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.rect(1, 1, config.width - 2, config.height - 2, 'S')

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
 * 템플릿 목록 조회 (Barcord 스타일 작은 라벨 사이즈)
 */
export function getTemplates(): Array<{
  id: LabelTemplate
  name: string
  width: number
  height: number
  isCustom?: boolean
}> {
  return [
    { id: '75x45mm', name: '75 x 45 (기본)', width: 75, height: 45 },
    { id: '50x30mm', name: '50 x 30', width: 50, height: 30 },
    { id: '100x50mm', name: '100 x 50', width: 100, height: 50 },
    { id: '80x40mm', name: '80 x 40', width: 80, height: 40 },
    { id: '60x40mm', name: '60 x 40', width: 60, height: 40 },
    { id: 'custom', name: '사용자 정의', width: 0, height: 0, isCustom: true },
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

  const opts = { ...DEFAULT_OPTIONS, ...options } as LabelOptions
  const config = getTemplateConfig(opts)

  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: [config.width, config.height],
  })

  // 한글 폰트 등록
  const fontRegistered = await registerKoreanFont(pdf)
  if (!fontRegistered) {
    console.warn('한글 폰트 등록 실패, 기본 폰트 사용')
  }

  for (let i = 0; i < dataList.length; i++) {
    if (i > 0) {
      pdf.addPage()
    }

    const data = dataList[i]

    // Barcord 스타일 라벨 레이아웃
    const margin = 4
    let y = margin + 2

    // QR 코드 (우측 상단)
    const qrSize = Math.min(config.qrSize, config.height * 0.25)

    if (opts.showQR) {
      try {
        const qrDataUrl = await generateLotQRCode(data)
        pdf.addImage(
          qrDataUrl,
          'PNG',
          config.width - margin - qrSize,
          margin,
          qrSize,
          qrSize
        )
      } catch {
        // QR 생성 실패 무시
      }
    }

    // 1. 공정명 (i18n 적용)
    const processName = tr(`process.${data.processCode}`) || getProcessName(data.processCode)
    pdf.setFontSize(config.fontSize.title)
    pdf.setTextColor(0, 0, 0)
    pdf.text(`[${data.processCode}] ${processName}`, margin, y + 4)
    y += config.fontSize.title * 0.45

    // 2. 품번 (i18n 적용)
    pdf.setFontSize(config.fontSize.normal)
    pdf.text(`${tr('label_print.product_code_prefix')} ${data.productCode || '-'}`, margin, y + 4)
    y += config.fontSize.normal * 0.5

    // 3. LOT 번호 (i18n 적용)
    pdf.setFontSize(config.fontSize.normal)
    pdf.text(`${tr('label_print.lot_prefix')} ${data.lotNumber}`, margin, y + 4)
    y += config.fontSize.normal * 0.5

    // 4. 수량 (i18n 적용)
    pdf.text(`${tr('label_print.quantity_prefix')} ${data.quantity.toLocaleString()} EA`, margin, y + 4)
    y += config.fontSize.normal * 0.6

    // 5. 1D 바코드 (중앙)
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
        y += config.barcodeHeight + 2
      } catch {
        // 바코드 생성 실패 무시
      }
    }

    // 6. 일시 (하단) - i18n 적용
    pdf.setFontSize(config.fontSize.small)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`${tr('label_print.date_prefix')} ${data.date}`, margin, y + 3)

    // 테두리
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    pdf.rect(1, 1, config.width - 2, config.height - 2, 'S')
  }

  return pdf
}
