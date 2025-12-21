# Vietnam MES 프로젝트

## 개요

베트남 제조 실행 시스템 (Manufacturing Execution System) - Electron 데스크톱 애플리케이션

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite 7 |
| 데스크톱 | Electron |
| 스타일링 | Tailwind CSS v4 |
| UI 컴포넌트 | Radix UI + MUI |
| 상태관리 | React Context API |
| 라우팅 | React Router (HashRouter) |
| 차트 | Recharts |
| 데이터베이스 | PostgreSQL 16 + Prisma 6 |

## 디렉토리 구조

```
src/
├── app/
│   ├── components/
│   │   ├── ui/           # 재사용 UI 컴포넌트 (Button, Dialog, Table 등)
│   │   ├── figma/        # Figma 디자인 컴포넌트
│   │   ├── label/        # 라벨 컴포넌트 (QRCodeView, BarcodeView, LabelTemplate)
│   │   ├── dialogs/      # 다이얼로그 (ExcelImportDialog, BackupDialog 등)
│   │   └── mbom/         # MBOM 컴포넌트 (MBOMTreeView, ProcessRoutingEditor)
│   ├── context/          # React Context (MaterialContext 등)
│   ├── layout/           # 레이아웃 (Header, Sidebar, MainLayout)
│   └── pages/            # 페이지 컴포넌트
│       ├── Dashboard.tsx
│       ├── MaterialReceiving.tsx
│       ├── MaterialStock.tsx
│       ├── ProcessView.tsx
│       └── ...
├── lib/
│   ├── prisma.ts         # Prisma Client 싱글톤
│   ├── db/index.ts       # DB 연결 유틸리티
│   ├── utils.ts          # 공통 유틸리티
│   └── excelUtils.ts     # Excel 다운로드 유틸리티
├── services/
│   ├── index.ts          # 서비스 Export
│   ├── barcodeService.ts # 바코드 생성/파싱 서비스
│   ├── sequenceService.ts # 일련번호 관리 서비스
│   ├── processService.ts # 공정 마스터 서비스
│   ├── semiProductService.ts # 반제품 품번 서비스
│   ├── mbomService.ts    # MBOM 서비스
│   ├── processRoutingService.ts # 공정 라우팅 서비스
│   └── bundleService.ts  # 번들/SET 서비스
├── styles/               # CSS 파일
└── main.tsx              # 앱 진입점

prisma/
└── schema.prisma         # 데이터베이스 스키마 (18개 모델)

docs/
├── MBOM_구현계획.md       # MBOM 7단계 구현 계획
├── MBOM_구현기록.md       # MBOM 단계별 구현 기록
└── MBOM_시스템_종합정리.md # MBOM 시스템 전체 정리

TEST/
├── stage1~6/             # MBOM 단계별 테스트 (282개)
└── phase3~5/             # 기존 기능 테스트

electron/
├── main.ts               # Electron 메인 프로세스
└── preload.ts            # Preload 스크립트
```

## 컴포넌트 규칙

### UI 컴포넌트 사용

```tsx
// Radix UI 기반 컴포넌트 사용
import { Button } from "@/app/components/ui/button"
import { Dialog } from "@/app/components/ui/dialog"
```

### className 조합

```tsx
// cn() 유틸리티로 조건부 className 조합
import { cn } from "@/lib/utils"

<div className={cn("base-class", isActive && "active-class")} />
```

### 반응형 디자인

```tsx
// Tailwind lg: 브레이크포인트 (1024px) 기준
<div className="hidden lg:block">  // 데스크톱
<div className="block lg:hidden">  // 모바일
```

## Context 사용 패턴

### 기존 Context 사용

```tsx
import { useMaterial } from "@/app/context/MaterialContext"

function MyComponent() {
  const { materials, addMaterial, updateMaterial } = useMaterial()
  // ...
}
```

### 새 Context 추가 시

1. `src/app/context/[Name]Context.tsx` 파일 생성
2. `App.tsx`에서 Provider 등록

```tsx
// App.tsx
<MaterialProvider>
  <NewProvider>  {/* 새 Provider 추가 */}
    <RouterProvider router={router} />
  </NewProvider>
</MaterialProvider>
```

## 라우팅 규칙

### 라우터 설정

- **HashRouter** 사용 (Electron 호환성)
- 경로 패턴: `/도메인/액션`

### 주요 경로

| 경로 | 페이지 |
|------|--------|
| `/` | 대시보드 |
| `/material/receiving` | 자재 입고 |
| `/material/stock` | 재고 현황 |
| `/process/:processId` | 공정 모니터링 |
| `/inspection/:type` | 품질 검사 |
| `/report/:reportId` | 리포트 |
| `/master/:type` | 마스터 데이터 |

## 자재(Material) 데이터 구조

```typescript
interface Material {
  id: string
  code: string          // 자재 코드
  name: string          // 자재명
  spec: string          // 규격
  category: string      // 분류
  unit: string          // 단위
  stock: number         // 현재고
  safeStock: number     // 안전재고
  status: 'good' | 'warning' | 'danger' | 'exhausted'
}
```

## Import 별칭

```tsx
// @ = src 디렉토리
import { Component } from "@/app/components/ui/component"
import { useMaterial } from "@/app/context/MaterialContext"
```

## Excel 다운로드 기능

### 유틸리티 함수

```tsx
import { downloadExcel, downloadTemplate } from "@/lib/excelUtils"

// 데이터 내보내기
downloadExcel(data, '파일명', '시트명')

// 빈 템플릿 다운로드
downloadTemplate(['헤더1', '헤더2'], '파일명', '시트명')
```

### 지원 페이지

| 페이지 | 기능 | 파일명 |
|--------|------|--------|
| 자재 입고 | 입고 양식 템플릿 | `자재입고_양식.xlsx` |
| 재고 현황 | 재고 데이터 내보내기 | `재고현황_YYYYMMDD.xlsx` |
| 마스터 데이터 | 자재 등록 양식 | `자재등록_양식.xlsx` |
| 리포트 (생산) | 생산 현황 내보내기 | `생산현황_YYYYMMDD.xlsx` |
| 리포트 (투입) | 투입 이력 내보내기 | `투입이력_YYYYMMDD.xlsx` |

## 데이터베이스 (Prisma)

### 연결 설정

```bash
# .env 파일
DATABASE_URL="postgresql://postgres:password@localhost:5432/vietnam_mes?schema=public"
```

### 주요 모델 (15개)

| 모델 | 설명 |
|------|------|
| User | 사용자/인증 |
| Product | 제품 마스터 (완제품/반제품) |
| Material | 자재 마스터 |
| MaterialStock | 자재 재고 (LOT별) |
| ProductionLot | 생산 LOT (핵심) |
| LotMaterial | LOT-자재 관계 (추적용) |
| Inspection | 검사 기록 |
| SequenceCounter | 일련번호 카운터 |
| BOM | Bill of Materials |
| Line | 생산 라인 |
| CarryOver | 이월 수량 |
| BundleLot | CA 번들 LOT |
| BundleItem | 번들 아이템 |
| AppSettings | 앱 설정 |
| TableUserSettings | 사용자별 테이블 설정 |

### 마이그레이션

```bash
# 마이그레이션 생성 및 적용
npx prisma migrate dev --name init

# 클라이언트 생성
npx prisma generate

# DB 스튜디오
npx prisma studio
```

## 바코드 서비스

### 바코드 형식

| 버전 | 형식 | 예시 |
|------|------|------|
| V1 (레거시) | `XX-YYMMDD-XXXX` | `CA-241220-0001` |
| V2 (신규) | `[Process][Product]Q[Qty]-[Short][YYMMDD]-[LOT]` | `CAP001Q100-C241220-0001` |
| 번들 | `[Process][Product]Q[Set]-[Short][YYMMDD]-B[LOT]` | `CAP001Q4-C241220-B001` |

### 공정 단축코드

| 공정 | 코드 | 단축 | 설명 |
|------|------|------|------|
| 자재출고 | MO | O | Material Out |
| 자동절압착 | CA | C | Cutting & Auto-crimp |
| 수동압착 | MC | M | Manual Crimp |
| 미드스플라이스 | MS | S | Mid Splice |
| 서브조립 | SB | B | Sub-assembly |
| 스플라이스 | SP | P | Splice |
| 제품조립 | PA | A | Product Assembly |
| 하우징삽입 | HS | H | Housing |
| 회로검사 | CI | I | Circuit Inspection |
| 육안검사 | VI | V | Visual Inspection |

### 사용법

```typescript
import {
  generateBarcodeV1,
  generateBarcodeV2,
  generateBundleBarcode,
  parseBarcode,
  parseHQBarcode,
} from '@/services/barcodeService'

// V1 바코드 생성
const v1 = generateBarcodeV1('CA', 1)  // CA-241220-0001

// V2 바코드 생성
const v2 = generateBarcodeV2('CA', 'P001', 100, 1)  // CAP001Q100-C241220-0001

// 번들 바코드 생성
const bundle = generateBundleBarcode('CA', 'P001', 4, 1)  // CAP001Q4-C241220-B001

// 바코드 파싱 (V1/V2 자동 감지)
const parsed = parseBarcode('CAP001Q100-C241220-0001')
// { version: 2, processCode: 'CA', productCode: 'P001', quantity: 100, ... }
```

## 일련번호 서비스

```typescript
import { getNextSequence, getNextBundleSequence } from '@/services/sequenceService'

// 다음 일련번호 (0001-9999)
const seq = await getNextSequence('CA')
// { prefix: 'CA', dateKey: '241220', sequence: 1, formatted: '0001' }

// 번들 일련번호 (001-999)
const bundleSeq = await getNextBundleSequence('CA')
// { prefix: 'CA_BUNDLE', dateKey: '241220', sequence: 1, formatted: '001' }
```

## 라벨 서비스

### 지원 기능

| 기능 | 설명 |
|------|------|
| QR 코드 | LOT 정보 JSON 인코딩 |
| 1D 바코드 | Code128 포맷 |
| PDF 라벨 | 3가지 템플릿 크기 |

### 라벨 템플릿

| 템플릿 | 크기 | 용도 |
|--------|------|------|
| 대형 | 100x150mm | 완제품/팔레트 |
| 중형 | 75x125mm | 반제품/박스 |
| 소형 | 50x80mm | 단품/개별 |

### 사용법

```typescript
import {
  createLabel,
  downloadLabel,
  printLabel,
  previewLabel,
  generateQRCode,
  generate1DBarcode,
} from '@/services/labelService'

// PDF 라벨 생성
const pdf = await createLabel({
  lotNumber: 'CAP001Q100-C241220-0001',
  processCode: 'CA',
  productCode: 'P001',
  productName: '제품명',
  quantity: 100,
  date: '2024-12-20',
}, { template: '100x150mm', showQR: true, showBarcode: true })

// 다운로드/인쇄/미리보기
downloadLabel(pdf, 'label_filename')
printLabel(pdf)
const previewUrl = previewLabel(pdf)
```

### 라벨 컴포넌트

```tsx
import { LabelTemplate, QRCodeView, BarcodeView } from '@/app/components/label'

// 라벨 미리보기 + 인쇄
<LabelTemplate
  data={{ lotNumber, processCode, quantity, date }}
  onPrint={() => console.log('인쇄됨')}
/>

// QR 코드 단독 표시
<QRCodeView data={{ lotNumber, processCode }} size={128} />

// 바코드 단독 표시
<BarcodeView value="CAP001Q100-C241220-0001" height={50} />
```

## 문서 서비스

### 지원 문서

| 문서 | 함수 | 설명 |
|------|------|------|
| 투입자재명세서 | `generateMaterialSheet(lotId)` | LOT에 투입된 자재 목록 |
| 생산보고서 | `generateProductionReport(startDate, endDate)` | 기간별 생산 현황 |
| 검사성적서 | `generateInspectionCertificate(lotId)` | LOT 검사 결과 |

### 사용법

```typescript
import {
  generateMaterialSheet,
  generateProductionReport,
  generateInspectionCertificate,
} from '@/services/documentService'

// 투입 자재 명세서
const materialPdf = await generateMaterialSheet(lotId)
materialPdf.save('material_sheet.pdf')

// 생산 보고서
const reportPdf = await generateProductionReport('2024-12-01', '2024-12-20')
reportPdf.save('production_report.pdf')

// 검사 성적서
const certPdf = await generateInspectionCertificate(lotId)
certPdf.save('inspection_cert.pdf')
```

## Excel Import

### 지원 Import

| 유형 | 함수 | 설명 |
|------|------|------|
| 제품 | `importProducts(file)` | 제품 일괄 등록 |
| 자재 | `importMaterials(file)` | 자재 일괄 등록 |
| BOM | `importBOM(file)` | BOM 일괄 등록 |
| 재고 | `importStock(file)` | 재고 일괄 등록 |

### 사용법

```tsx
import { ExcelImportDialog } from '@/app/components/dialogs'
import { downloadImportTemplate } from '@/services/excelImportService'

// 템플릿 다운로드
downloadImportTemplate('product')  // product, material, bom, stock

// Import 다이얼로그
<ExcelImportDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  importType="product"
  onImportComplete={(result) => console.log(result)}
/>
```

## 백업/복원

### 사용법

```tsx
import { BackupDialog } from '@/app/components/dialogs'
import { createBackup, downloadBackup, restoreBackup } from '@/services/backupService'

// 백업 생성 및 다운로드
const backup = await createBackup({ includeSystemTables: false })
downloadBackup(backup)

// 백업 다이얼로그
<BackupDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  onRestoreComplete={(result) => console.log(result)}
/>
```

## 다국어 (i18n)

### 지원 언어

| 코드 | 언어 | 파일 |
|------|------|------|
| ko | 한국어 (기본) | `src/locales/ko.json` |
| vi | 베트남어 | `src/locales/vi.json` |

### 사용법

```tsx
import { useTranslation } from '@/lib/i18n'
import { I18nProvider } from '@/app/context/I18nContext'

// Provider 설정 (App.tsx)
<I18nProvider>
  <App />
</I18nProvider>

// 컴포넌트에서 사용
function MyComponent() {
  const { t, locale } = useTranslation()

  return (
    <div>
      <h1>{t('menu.dashboard')}</h1>
      <p>{t('message.saveSuccess')}</p>
      <p>{t('message.importSuccess', { count: 10 })}</p>
    </div>
  )
}
```

## Electron 프린터

### IPC 채널

| 채널 | 설명 |
|------|------|
| `get-printers` | 시스템 프린터 목록 |
| `print-pdf` | PDF 인쇄 |
| `print-to-pdf` | PDF 파일 저장 |
| `print-label` | 라벨 인쇄 (ZPL) |

### 사용법

```tsx
import {
  getPrinters,
  printPDF,
  printLabel,
  isElectron,
} from '@/lib/electronBridge'

// Electron 환경 체크
if (isElectron()) {
  // 프린터 목록 조회
  const printers = await getPrinters()

  // PDF 인쇄
  await printPDF({ printerName: 'HP LaserJet', copies: 1 })

  // 라벨 인쇄
  await printLabel({ printerName: 'Zebra ZD420', zplData: '^XA...' })
}
```

## MBOM 시스템

### 개요

공정 기반 BOM(Manufacturing BOM) 관리 시스템. 상세 문서: `docs/MBOM_시스템_종합정리.md`

### 공정 마스터

| 코드 | 공정명 | 자재투입 | 검사 |
|------|--------|---------|------|
| CA | 자동절단압착 | O | X |
| MS | 중간스트립 | X | X |
| MC | 수동압착 | O | X |
| SB | 서브조립 | O | X |
| HS | 열수축 | X | X |
| CQ | 압착검사 | X | O |
| SP | 제품조립제공부품 | O | X |
| PA | 제품조립 | O | X |
| CI | 회로검사 | X | O |
| VI | 육안검사 | X | O |

### 공정 라우팅 패턴

```typescript
const PROCESS_PATTERNS = {
  simple: ['CA', 'SP', 'PA', 'CI', 'VI'],
  medium: ['CA', 'SB', 'MC', 'CQ', 'SP', 'PA', 'CI', 'VI'],
  complex: ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI'],
}
```

### 반제품 품번 체계

| 유형 | 형식 | 예시 |
|------|------|------|
| 완제품 | [품번] | 00315452 |
| 절압품(CA) | [품번]-[회로번호] | 00315452-001 |
| MS 반제품 | MS[절압품번] | MS00315452-001 |
| MC/SB/HS | [공정][품번] | MC00315452 |

### MBOM 서비스

```typescript
import {
  createMBOMEntry,
  getMBOMTree,
  getMBOMByProcess,
  calculateProcessMaterialRequirements,
  calculateTotalMaterialRequirements,
} from '@/services/mbomService'

// MBOM 트리 조회 (공정 순서대로)
const tree = await getMBOMTree(productId)

// 공정별 자재 소요량
const materials = await calculateProcessMaterialRequirements(productId, 'CA', 100)
```

### 공정 라우팅 서비스

```typescript
import {
  createRoutingFromPattern,
  getNextProcess,
  validateProcessOrder,
} from '@/services/processRoutingService'

// 패턴으로 라우팅 생성
await createRoutingFromPattern(productId, 'medium')

// 다음 공정 조회
const next = await getNextProcess(productId, 'CA') // 'SB'
```

### MBOM UI 컴포넌트

```tsx
import { MBOMTreeView, ProcessRoutingEditor } from '@/app/components/mbom'

// MBOM 트리 뷰
<MBOMTreeView
  productId={123}
  data={mbomTree}
  onNodeSelect={(node) => {}}
  editable={true}
/>

// 공정 라우팅 편집기
<ProcessRoutingEditor
  productId={123}
  routing={routing}
  availableProcesses={processes}
  onSave={async (routing) => {}}
/>
```

## 엔터프라이즈 규칙 참조

회사 전반 코딩 스탠더드는 `~/.claude/ENTERPRISE.md` 참조

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-21 | MBOM 시스템 구현 (7단계: DB 스키마, 공정 마스터, 반제품 품번, MBOM 서비스, 공정 라우팅, SET 번들, UI 컴포넌트) |
| 2025-12-20 | 4단계 마무리 기능 구현 (Excel Import, 백업/복원, 다국어 ko/vi, Electron 프린터 IPC) |
| 2025-12-20 | 3단계 라벨/PDF 기능 구현 (LabelService, DocumentService, 라벨 컴포넌트 3개) |
| 2025-12-20 | 2단계 핵심 기능 구현 (ProductionService, LotTraceService, InspectionService, AuthService, 마스터 서비스 5개) |
| 2025-12-20 | 1단계 DB 기반 구축 (Prisma 6 + PostgreSQL, 15개 모델, 바코드/일련번호 서비스) |
| 2025-12-20 | Excel 다운로드 기능 구현 (xlsx 라이브러리, 4개 페이지 5개 버튼) |
