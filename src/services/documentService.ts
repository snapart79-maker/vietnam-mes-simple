/**
 * Document Service
 *
 * 문서/보고서 생성 서비스
 * - 투입 자재 명세서
 * - 생산 보고서
 * - 검사 성적서
 */
import { jsPDF } from 'jspdf'
import { prisma } from '../lib/prisma'
import { getProcessName } from './barcodeService'
import { findMaterialsByProduct } from './lotTraceService'

// ============================================
// Types
// ============================================

interface DocumentOptions {
  showLogo: boolean
  companyName: string
  showHeader: boolean
  showFooter: boolean
}

interface TableColumn {
  header: string
  key: string
  width: number
  align?: 'left' | 'center' | 'right'
}

// ============================================
// Constants
// ============================================

const DEFAULT_OPTIONS: DocumentOptions = {
  showLogo: true,
  companyName: 'Vietnam MES',
  showHeader: true,
  showFooter: true,
}

const PAGE_CONFIG = {
  width: 210,  // A4 width in mm
  height: 297, // A4 height in mm
  margin: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15,
  },
  fontSize: {
    title: 16,
    subtitle: 12,
    normal: 10,
    small: 8,
  },
}

// ============================================
// Helper Functions
// ============================================

/**
 * PDF 생성 (A4 기본)
 */
function createPDF(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
}

/**
 * 헤더 추가
 */
function addHeader(
  pdf: jsPDF,
  title: string,
  subtitle?: string,
  options: DocumentOptions = DEFAULT_OPTIONS
): number {
  const { margin, fontSize } = PAGE_CONFIG
  let y = margin.top

  // 회사명
  if (options.showHeader) {
    pdf.setFontSize(fontSize.small)
    pdf.setTextColor(128, 128, 128)
    pdf.text(options.companyName, margin.left, y)
    y += 5
  }

  // 제목
  pdf.setFontSize(fontSize.title)
  pdf.setTextColor(0, 0, 0)
  pdf.text(title, PAGE_CONFIG.width / 2, y, { align: 'center' })
  y += 8

  // 부제목
  if (subtitle) {
    pdf.setFontSize(fontSize.subtitle)
    pdf.setTextColor(64, 64, 64)
    pdf.text(subtitle, PAGE_CONFIG.width / 2, y, { align: 'center' })
    y += 8
  }

  // 구분선
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(margin.left, y, PAGE_CONFIG.width - margin.right, y)
  y += 8

  return y
}

/**
 * 푸터 추가
 */
function addFooter(pdf: jsPDF, pageNum: number, totalPages: number): void {
  const { margin, fontSize } = PAGE_CONFIG
  const y = PAGE_CONFIG.height - margin.bottom + 10

  pdf.setFontSize(fontSize.small)
  pdf.setTextColor(128, 128, 128)

  // 페이지 번호
  pdf.text(
    `Page ${pageNum} / ${totalPages}`,
    PAGE_CONFIG.width / 2,
    y,
    { align: 'center' }
  )

  // 생성 일시
  const now = new Date().toLocaleString('ko-KR')
  pdf.text(now, PAGE_CONFIG.width - margin.right, y, { align: 'right' })
}

/**
 * 테이블 그리기
 */
function drawTable(
  pdf: jsPDF,
  columns: TableColumn[],
  data: Array<Record<string, unknown>>,
  startY: number
): number {
  const { margin, fontSize } = PAGE_CONFIG
  const tableWidth = PAGE_CONFIG.width - margin.left - margin.right
  const rowHeight = 7
  let y = startY

  // 헤더 행
  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin.left, y, tableWidth, rowHeight, 'F')

  pdf.setFontSize(fontSize.small)
  pdf.setTextColor(0, 0, 0)

  let x = margin.left
  for (const col of columns) {
    const colWidth = (col.width / 100) * tableWidth
    pdf.text(col.header, x + 2, y + 5)
    x += colWidth
  }

  y += rowHeight

  // 데이터 행
  pdf.setFontSize(fontSize.small)

  for (const row of data) {
    // 페이지 넘김 체크
    if (y + rowHeight > PAGE_CONFIG.height - margin.bottom - 20) {
      pdf.addPage()
      y = margin.top
    }

    // 행 배경 (짝수 행)
    if (data.indexOf(row) % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(margin.left, y, tableWidth, rowHeight, 'F')
    }

    // 행 테두리
    pdf.setDrawColor(220, 220, 220)
    pdf.rect(margin.left, y, tableWidth, rowHeight, 'S')

    // 셀 값
    x = margin.left
    for (const col of columns) {
      const colWidth = (col.width / 100) * tableWidth
      const value = String(row[col.key] ?? '')
      const truncated = value.length > 20 ? value.substring(0, 20) + '...' : value

      if (col.align === 'right') {
        pdf.text(truncated, x + colWidth - 2, y + 5, { align: 'right' })
      } else if (col.align === 'center') {
        pdf.text(truncated, x + colWidth / 2, y + 5, { align: 'center' })
      } else {
        pdf.text(truncated, x + 2, y + 5)
      }

      x += colWidth
    }

    y += rowHeight
  }

  return y + 5
}

/**
 * 정보 섹션 추가
 */
function addInfoSection(
  pdf: jsPDF,
  items: Array<{ label: string; value: string }>,
  startY: number
): number {
  const { margin, fontSize } = PAGE_CONFIG
  let y = startY

  pdf.setFontSize(fontSize.normal)

  for (const item of items) {
    pdf.setTextColor(100, 100, 100)
    pdf.text(`${item.label}:`, margin.left, y)
    pdf.setTextColor(0, 0, 0)
    pdf.text(item.value, margin.left + 40, y)
    y += 6
  }

  return y + 5
}

// ============================================
// Document Generation
// ============================================

/**
 * 투입 자재 명세서 생성
 */
export async function generateMaterialSheet(
  lotId: number,
  options: Partial<DocumentOptions> = {}
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // LOT 정보 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    include: {
      product: true,
      worker: true,
      lotMaterials: {
        include: {
          material: true,
        },
      },
    },
  })

  if (!lot) {
    throw new Error('LOT를 찾을 수 없습니다.')
  }

  const pdf = createPDF()

  // 헤더
  let y = addHeader(
    pdf,
    '투입 자재 명세서',
    `Material Input Sheet`,
    opts
  )

  // LOT 정보
  y = addInfoSection(pdf, [
    { label: 'LOT 번호', value: lot.lotNumber },
    { label: '공정', value: getProcessName(lot.processCode) },
    { label: '품번', value: lot.product?.code || '-' },
    { label: '품명', value: lot.product?.name || '-' },
    { label: '생산수량', value: `${lot.completedQty.toLocaleString()} EA` },
    { label: '작업자', value: lot.worker?.name || '-' },
    { label: '작업일', value: lot.startedAt.toLocaleDateString('ko-KR') },
  ], y)

  y += 5

  // 투입 자재 테이블
  pdf.setFontSize(PAGE_CONFIG.fontSize.subtitle)
  pdf.text('투입 자재 목록', PAGE_CONFIG.margin.left, y)
  y += 8

  const columns: TableColumn[] = [
    { header: 'No', key: 'no', width: 8, align: 'center' },
    { header: '자재코드', key: 'code', width: 20 },
    { header: '자재명', key: 'name', width: 32 },
    { header: '자재LOT', key: 'lotNo', width: 25 },
    { header: '투입수량', key: 'qty', width: 15, align: 'right' },
  ]

  const tableData = lot.lotMaterials.map((lm, idx) => ({
    no: idx + 1,
    code: lm.material.code,
    name: lm.material.name,
    lotNo: lm.materialLotNo,
    qty: `${lm.quantity.toLocaleString()} ${lm.material.unit}`,
  }))

  if (tableData.length > 0) {
    y = drawTable(pdf, columns, tableData, y)
  } else {
    pdf.setFontSize(PAGE_CONFIG.fontSize.normal)
    pdf.setTextColor(128, 128, 128)
    pdf.text('투입된 자재가 없습니다.', PAGE_CONFIG.width / 2, y, { align: 'center' })
    y += 10
  }

  // 합계
  y += 5
  pdf.setFontSize(PAGE_CONFIG.fontSize.normal)
  pdf.text(`총 ${tableData.length}개 자재 투입`, PAGE_CONFIG.margin.left, y)

  // 푸터
  addFooter(pdf, 1, 1)

  return pdf
}

/**
 * 생산 보고서 생성
 */
export async function generateProductionReport(
  startDate: Date,
  endDate: Date,
  options: Partial<DocumentOptions> = {}
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // 생산 데이터 조회
  const lots = await prisma.productionLot.findMany({
    where: {
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      product: true,
    },
    orderBy: { startedAt: 'desc' },
  })

  const pdf = createPDF()

  // 헤더
  const dateRange = `${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}`
  let y = addHeader(pdf, '생산 현황 보고서', dateRange, opts)

  // 요약 정보
  const completed = lots.filter(l => l.status === 'COMPLETED')
  const totalPlanned = lots.reduce((sum, l) => sum + l.plannedQty, 0)
  const totalCompleted = lots.reduce((sum, l) => sum + l.completedQty, 0)
  const totalDefects = lots.reduce((sum, l) => sum + l.defectQty, 0)
  const yieldRate = totalCompleted > 0
    ? ((totalCompleted - totalDefects) / totalCompleted * 100).toFixed(1)
    : '0.0'

  y = addInfoSection(pdf, [
    { label: '전체 LOT', value: `${lots.length}건` },
    { label: '완료 LOT', value: `${completed.length}건` },
    { label: '계획수량', value: `${totalPlanned.toLocaleString()} EA` },
    { label: '완료수량', value: `${totalCompleted.toLocaleString()} EA` },
    { label: '불량수량', value: `${totalDefects.toLocaleString()} EA` },
    { label: '직행률', value: `${yieldRate}%` },
  ], y)

  y += 10

  // 공정별 현황
  pdf.setFontSize(PAGE_CONFIG.fontSize.subtitle)
  pdf.text('공정별 생산 현황', PAGE_CONFIG.margin.left, y)
  y += 8

  // 공정별 그룹핑
  const byProcess = new Map<string, { count: number; completed: number; defects: number }>()
  for (const lot of lots) {
    const current = byProcess.get(lot.processCode) || { count: 0, completed: 0, defects: 0 }
    current.count++
    current.completed += lot.completedQty
    current.defects += lot.defectQty
    byProcess.set(lot.processCode, current)
  }

  const processColumns: TableColumn[] = [
    { header: '공정', key: 'process', width: 25 },
    { header: 'LOT수', key: 'count', width: 15, align: 'center' },
    { header: '완료수량', key: 'completed', width: 20, align: 'right' },
    { header: '불량수량', key: 'defects', width: 20, align: 'right' },
    { header: '직행률', key: 'yield', width: 20, align: 'right' },
  ]

  const processData = Array.from(byProcess.entries()).map(([code, stats]) => ({
    process: getProcessName(code),
    count: stats.count,
    completed: stats.completed.toLocaleString(),
    defects: stats.defects.toLocaleString(),
    yield: stats.completed > 0
      ? `${((stats.completed - stats.defects) / stats.completed * 100).toFixed(1)}%`
      : '-',
  }))

  y = drawTable(pdf, processColumns, processData, y)

  y += 10

  // 상세 LOT 목록
  pdf.setFontSize(PAGE_CONFIG.fontSize.subtitle)
  pdf.text('LOT 상세 목록', PAGE_CONFIG.margin.left, y)
  y += 8

  const lotColumns: TableColumn[] = [
    { header: 'LOT번호', key: 'lotNumber', width: 30 },
    { header: '공정', key: 'process', width: 15, align: 'center' },
    { header: '품번', key: 'product', width: 20 },
    { header: '상태', key: 'status', width: 15, align: 'center' },
    { header: '수량', key: 'qty', width: 20, align: 'right' },
  ]

  const lotData = lots.slice(0, 50).map(lot => ({  // 최대 50개
    lotNumber: lot.lotNumber,
    process: lot.processCode,
    product: lot.product?.code || '-',
    status: lot.status === 'COMPLETED' ? '완료' : lot.status === 'IN_PROGRESS' ? '진행중' : lot.status,
    qty: `${lot.completedQty.toLocaleString()}/${lot.plannedQty.toLocaleString()}`,
  }))

  drawTable(pdf, lotColumns, lotData, y)

  // 푸터
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    addFooter(pdf, i, totalPages)
  }

  return pdf
}

/**
 * 검사 성적서 생성
 */
export async function generateInspectionCertificate(
  lotId: number,
  options: Partial<DocumentOptions> = {}
): Promise<jsPDF> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // LOT 및 검사 정보 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    include: {
      product: true,
      inspections: {
        include: {
          inspector: true,
        },
        orderBy: { inspectedAt: 'asc' },
      },
    },
  })

  if (!lot) {
    throw new Error('LOT를 찾을 수 없습니다.')
  }

  const pdf = createPDF()

  // 헤더
  let y = addHeader(pdf, '검사 성적서', 'Inspection Certificate', opts)

  // 제품 정보
  y = addInfoSection(pdf, [
    { label: 'LOT 번호', value: lot.lotNumber },
    { label: '품번', value: lot.product?.code || '-' },
    { label: '품명', value: lot.product?.name || '-' },
    { label: '생산수량', value: `${lot.completedQty.toLocaleString()} EA` },
    { label: '불량수량', value: `${lot.defectQty.toLocaleString()} EA` },
    { label: '생산일', value: lot.startedAt.toLocaleDateString('ko-KR') },
  ], y)

  y += 10

  // 검사 결과 요약
  const passCount = lot.inspections.filter(i => i.result === 'PASS').length
  const failCount = lot.inspections.filter(i => i.result === 'FAIL').length
  const overallResult = failCount === 0 && passCount > 0 ? '합격' : failCount > 0 ? '불합격' : '미검사'

  pdf.setFontSize(PAGE_CONFIG.fontSize.subtitle)
  pdf.text('검사 결과', PAGE_CONFIG.margin.left, y)
  y += 8

  // 결과 박스
  pdf.setFillColor(overallResult === '합격' ? 200 : overallResult === '불합격' ? 255 : 240, overallResult === '합격' ? 255 : 200, 200)
  pdf.rect(PAGE_CONFIG.margin.left, y, 180, 15, 'F')
  pdf.setFontSize(PAGE_CONFIG.fontSize.title)
  pdf.setTextColor(overallResult === '합격' ? 0 : overallResult === '불합격' ? 180 : 100, overallResult === '합격' ? 128 : 0, 0)
  pdf.text(overallResult, PAGE_CONFIG.width / 2, y + 10, { align: 'center' })
  pdf.setTextColor(0, 0, 0)
  y += 25

  // 검사 상세
  pdf.setFontSize(PAGE_CONFIG.fontSize.subtitle)
  pdf.text('검사 이력', PAGE_CONFIG.margin.left, y)
  y += 8

  const inspColumns: TableColumn[] = [
    { header: '검사유형', key: 'type', width: 20 },
    { header: '결과', key: 'result', width: 15, align: 'center' },
    { header: '검사자', key: 'inspector', width: 20 },
    { header: '검사일시', key: 'date', width: 25 },
    { header: '불량사유', key: 'reason', width: 20 },
  ]

  const typeNames: Record<string, string> = {
    CRIMP: '압착검사',
    CIRCUIT: '회로검사',
    VISUAL: '육안검사',
  }

  const inspData = lot.inspections.map(insp => ({
    type: typeNames[insp.type] || insp.type,
    result: insp.result === 'PASS' ? '합격' : '불합격',
    inspector: insp.inspector?.name || '-',
    date: insp.inspectedAt.toLocaleString('ko-KR'),
    reason: insp.defectReason || '-',
  }))

  if (inspData.length > 0) {
    y = drawTable(pdf, inspColumns, inspData, y)
  } else {
    pdf.setFontSize(PAGE_CONFIG.fontSize.normal)
    pdf.setTextColor(128, 128, 128)
    pdf.text('검사 이력이 없습니다.', PAGE_CONFIG.width / 2, y, { align: 'center' })
  }

  // 서명란
  y = PAGE_CONFIG.height - 60
  pdf.setDrawColor(0, 0, 0)
  pdf.setFontSize(PAGE_CONFIG.fontSize.normal)

  // 검사자 서명
  pdf.text('검사자:', PAGE_CONFIG.margin.left + 10, y)
  pdf.line(PAGE_CONFIG.margin.left + 35, y, PAGE_CONFIG.margin.left + 80, y)

  // 승인자 서명
  pdf.text('승인자:', PAGE_CONFIG.width / 2 + 10, y)
  pdf.line(PAGE_CONFIG.width / 2 + 35, y, PAGE_CONFIG.width / 2 + 80, y)

  // 푸터
  addFooter(pdf, 1, 1)

  return pdf
}

// ============================================
// Download Functions
// ============================================

/**
 * 문서 다운로드
 */
export function downloadDocument(pdf: jsPDF, filename: string): void {
  pdf.save(`${filename}.pdf`)
}

/**
 * 문서 미리보기
 */
export function previewDocument(pdf: jsPDF): string {
  const blob = pdf.output('blob')
  return URL.createObjectURL(blob)
}

/**
 * 문서 인쇄
 */
export function printDocument(pdf: jsPDF): void {
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)

  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}
