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
| 상태관리 | React Context API + localStorage |
| 라우팅 | React Router (HashRouter) |
| 차트 | Recharts |
| 데이터베이스 | PostgreSQL 16 + Prisma 6 |
| 데이터 영속화 | localStorage (브라우저/Electron 공통) |

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

품목마스터 관리 양식 기반 (20개 필드):

```typescript
interface Material {
  id: number
  // === 핵심 식별 ===
  code: string           // 경림품번 (MES 내부 품번)
  name: string           // 품명 (바코드 매칭용)
  // === 바코드 매칭용 ===
  supplierCode?: string  // 원자재 공급사 품번
  pdaCode?: string       // PDA 확인 품번
  hqCode?: string        // 본사 코드 (레거시)
  // === 공급처 ===
  supplier?: string      // 원자재-공급처
  customerCode?: string  // 출하 고객품번
  // === 규격 ===
  spec: string           // 규격1
  spec2?: string         // 규격2
  spec3?: string         // 규격3
  // === 전선 정보 ===
  wireMaterial?: string  // 전선재질
  wireGauge?: string     // 전선 굵기
  color?: string         // 색상
  // === 분류 ===
  projectCode?: string   // 프로젝트코드
  category: string       // 품목유형 (원재료)
  // === 단위 ===
  unit: string           // 단위 (EA, M)
  unitWeight?: number    // 단위중량
  weightUnit?: string    // 중량단위 (KG)
  // === 재고 ===
  stock: number          // 현재고
  safeStock: number      // 안전재고
}
```

**Excel Import 컬럼 매핑:**

| Excel 컬럼 | Material 필드 | 바코드 매칭 |
|------------|---------------|-------------|
| 경림품번 | `code` | ✅ |
| 품명 | `name` | ✅ |
| 원자재 공급사 품번 | `supplierCode` | ✅ |
| PDA 확인 품번 | `pdaCode` | ✅ |
| 원자재-공급처 | `supplier` | |
| 규격1 | `spec` | |
| 색상 | `color` | |
| 품목유형 | `category` | |
| 단위 | `unit` | |

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
| 본사(HQ) | `P[본사코드]Q[수량]S[LOT]V[버전]` | `P682028Q20000S250922V1` |

### 본사 바코드-자재 매핑

본사에서 입고되는 자재 바코드와 MES 자재 품번 간 매핑:

| 항목 | 예시 | 설명 |
|------|------|------|
| 본사 바코드 | `P682028Q20000S250922V1` | 본사 발행 바코드 |
| 본사 코드 (hqCode) | `682028` | 바코드에서 추출 |
| MES 품번 (code) | `250-1235` | 내부 관리 품번 |

**자재 등록 시 `hqCode` 필드에 본사 코드를 입력하면 바코드 스캔 시 자동 매칭됩니다.**

```typescript
// MaterialContext에서 본사 코드로 자재 조회
const { getMaterialByHQCode } = useMaterial()
const material = getMaterialByHQCode('682028')  // 본사코드로 자재 찾기
```

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

### 본사/생산처 바코드 매칭

바코드에서 추출한 코드로 자재를 찾는 **15단계 검색** (품목마스터 관리 양식 기반):

| 순서 | 검색 방법 | 대상 패턴 |
|------|-----------|-----------|
| **1** | **pdaCode 정확 일치** | **PDA 확인 품번 (가장 신뢰도 높음)** |
| **2** | **supplierCode 정확 일치** | **원자재 공급사 품번** |
| **3** | **name 정확 일치** | **품명 (생산처 바코드 대응)** |
| 4 | code 정확 일치 | 경림품번 |
| 5 | hqCode 정확 일치 | 본사 코드 (레거시) |
| 6 | 전선 색상코드 매핑 | 경신전선, 케이알로지스 (976개 매핑) |
| 7 | pdaCode 정규화 | 대시/공백 제거 비교 |
| 8 | supplierCode 정규화 | 대시/공백 제거 비교 |
| 9 | name 정규화 | 대시/공백 제거 비교 |
| 10 | code 정규화 | 대시/공백 제거 비교 |
| 11 | hqCode 정규화 | 대시/공백 제거 비교 |
| 12 | pdaCode 부분 일치 | 코드 포함 검색 |
| 13 | supplierCode 부분 일치 | 코드 포함 검색 |
| 14 | name 포함 검색 | 품명에 코드 포함 |
| 15 | hqCode/정규화 부분 일치 | 기타 예외 케이스 |

**생산처 바코드 패턴:**
- 바코드: `PPB625-03027Q500S25090191`
- 추출 코드: `PB625-03027`
- MES 자재: code=`250-351201`, **name=`PB625-03027`**
- 3단계에서 품명으로 매칭됨

```typescript
import { useMaterial } from '@/app/context/MaterialContext'

const { getMaterialByHQCode } = useMaterial()

// 바코드에서 추출한 코드로 자재 검색 (15단계)
const material = getMaterialByHQCode('PB625-03027')  // name으로 매칭
```

### 전선 색상코드 매핑

경신전선, 케이알로지스 등 전선 공급사는 바코드에 자체 색상코드를 사용합니다.
매핑 데이터는 `public/data/wire-color-mapping.json`에 저장됩니다.

| 공급사 | 예시 | 매핑 수 |
|--------|------|---------|
| 경신전선 | C1A1BKR → 210-4917 | 738개 |
| 케이알로지스 | E1A1RD0 → 210-8602 | 151개 |
| 히로세코리아 | 6442-0032-2-000 → 250-4431 | 87개 |

설정 → 데이터 및 백업에서 "기본 매핑 로드" 버튼으로 매핑을 로드할 수 있습니다.

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

## Windows 환경 설정

Windows에서 프로젝트를 실행하려면 `docs/WINDOWS_SETUP.md` 참조

### 빠른 시작

```bash
# 1. PostgreSQL 설치 (winget)
winget install PostgreSQL.PostgreSQL.17

# 2. 데이터베이스 설정 (관리자 권한)
.\setup_postgres.ps1

# 3. 앱 실행 (아래 중 택1)
.\run.bat              # Electron 모드 (데스크톱 앱)
.\run-browser.bat      # 브라우저 전용 모드
```

### 실행 모드

| 모드 | 실행 방법 | 설명 |
|------|----------|------|
| Electron | `run.bat` 또는 `npm run dev` | 데스크톱 앱으로 실행 |
| 브라우저 | `run-browser.bat` 또는 `npm run web` | 웹 브라우저에서 실행 |

### 주요 설정 파일

| 파일 | 용도 |
|------|------|
| `.env` | DB 연결 정보 (WSL용 IP 포함) |
| `setup_postgres.ps1` | PostgreSQL 초기 설정 |
| `add_wsl_access.ps1` | WSL 네트워크 허용 |
| `run.bat` | Electron 앱 실행 |
| `run-browser.bat` | 브라우저 전용 모드 실행 |

### 데이터 저장

기초 자료(제품, 자재, BOM)는 **localStorage**에 자동 저장됩니다:

| 데이터 | localStorage 키 |
|--------|----------------|
| 자재 마스터 | `vietnam_mes_materials` |
| 완제품 마스터 | `vietnam_mes_products` |
| BOM 마스터 | `vietnam_mes_bom` |

- 앱 재시작/브라우저 새로고침 시에도 데이터 유지
- 브라우저 데이터 삭제 시 초기화됨

---

## TODO: BOM Level 구현

> **상세 계획서**: `docs/BOM_LEVEL_구현계획.md`
> **트리거**: "내일 뭘해야 하지?" 질문 시 이 섹션 안내

### BOM Level 구조 (확정)

| Level | 공정코드 | 공정명 | 품번 형식 |
|-------|----------|--------|-----------|
| LV0 | - | 완제품 | `00315452` |
| LV1 | PA | 제품조립 | PA 투입 자재 |
| LV2 | MC | 수동압착 | `MC00315452` |
| LV3 | SB, MS | 서브조립, 중간탈피 | `SB00315452`, `MS00315452-001` |
| LV4 | CA | 자동절단압착 | `00315452-001` (절압품번) |

### 핵심 원칙
> **"품번이 붙어서 이동하는 공정만 BOM Level에 포함"**

### 제외 공정
- SP: 자재 수집 행위, 변환 없음
- HS: 형태 처리, 품번 미생성
- CQ, CI, VI: 검사 공정

### 구현 단계
1. BOMContext.tsx 타입 및 그룹핑 로직 수정
2. MasterData.tsx Import 매핑 수정 (processCode → level 자동 산출)
3. MasterData.tsx 트리 UI 구현 (품번 → Level → crimpCode 3단계)
4. 테스트 (Excel Import → 트리 표시)

### 관련 파일
- `src/app/context/BOMContext.tsx` - BOMItem 타입, determineLevel(), 그룹핑 로직
- `src/app/pages/MasterData.tsx` - Import 매핑, 트리 UI
- `docs/BOM_LEVEL_구현계획.md` - 상세 구현 계획서

---

---

## 2025-12-22 품목마스터 관리 양식 적용 (상세)

### 배경
- 생산처 바코드 스캔 시 매칭 실패 (PB625-03027, 632969-5 등)
- 기존 hqCode 중심 매칭에서 품명(name) 기반 매칭 필요
- 실제 운영 중인 "품목마스터 관리.xlsx" 양식 (4,885건) 기반으로 시스템 통일

### 수정 파일

#### 1. MaterialContext.tsx (바코드 매칭 핵심)
**경로**: `src/app/context/MaterialContext.tsx`

**Material 타입 확장** (10 → 20 필드):
```typescript
interface Material {
  // 핵심 식별
  code: string           // 경림품번 (예: 250-351201)
  name: string           // 품명 (예: PB625-03027) - 바코드 매칭용!

  // 바코드 매칭용 (신규)
  supplierCode?: string  // 원자재 공급사 품번
  pdaCode?: string       // PDA 확인 품번
  hqCode?: string        // 본사 코드 (레거시)

  // 공급처 정보 (신규)
  supplier?: string      // 원자재-공급처
  customerCode?: string  // 출하 고객품번

  // 규격 (확장)
  spec: string           // 규격1
  spec2?: string         // 규격2
  spec3?: string         // 규격3

  // 전선 정보 (신규)
  wireMaterial?: string  // 전선재질
  wireGauge?: string     // 전선 굵기
  color?: string         // 색상

  // 분류 (신규)
  projectCode?: string   // 프로젝트코드 (주자재/부자재)
  category: string       // 품목유형

  // 단위 (확장)
  unit: string
  unitWeight?: number    // 단위중량
  weightUnit?: string    // 중량단위 (KG)
}
```

**getMaterialByHQCode() 15단계 검색**:
| 단계 | 검색 방법 | 용도 |
|------|-----------|------|
| 1 | pdaCode 정확 일치 | PDA 바코드 (최우선) |
| 2 | supplierCode 정확 일치 | 공급사 바코드 |
| 3 | name 정확 일치 | 생산처 바코드 (품명=코드) |
| 4 | code 정확 일치 | 경림품번 |
| 5 | hqCode 정확 일치 | 본사 코드 |
| 6 | 전선 색상코드 매핑 | 경신전선 등 (976개) |
| 7-11 | 정규화 일치 | 대시/공백 제거 비교 |
| 12-15 | 부분 일치 | 포함 검색 |

#### 2. excelImportService.ts (Import/템플릿)
**경로**: `src/services/excelImportService.ts`

**MaterialImportRow 타입**: 20개 필드 정의

**한글 헤더 매핑** (KOREAN_TO_ENGLISH_MAPPING):
```typescript
material: {
  '경림품번': 'code',
  '품명': 'name',
  '원자재 공급사 품번': 'supplierCode',
  'PDA 확인 품번': 'pdaCode',
  '원자재-공급처': 'supplier',
  '규격1': 'spec',
  '색상': 'color',
  '품목유형': 'category',
  // ... 17개 컬럼 매핑
}
```

**템플릿 다운로드** (품목마스터.xlsx):
- 시트명: '품목마스터'
- 17개 컬럼: 프로젝트코드, 경림품번, 품명, 출하고객품번, 원자재공급사품번, PDA확인품번, 원자재-공급처, 규격1~3, 전선재질, 전선굵기, 색상, 품목유형, 단위, 단위중량, 중량단위
- 예제 데이터 3건 (한국단자공업, 경신전선, 우주일렉트로닉스)
- 안내 시트: 바코드 매칭 필드 설명 포함

#### 3. MasterData.tsx (UI 테이블)
**경로**: `src/app/pages/MasterData.tsx`

**renderMaterialTable() 컬럼**:
| 컬럼 | 필드 | 설명 |
|------|------|------|
| 경림품번 | code | 파란색 폰트 |
| 품명 | name | 최대 150px |
| 공급사품번 | supplierCode | - |
| PDA품번 | pdaCode | - |
| 공급처 | supplier | 최대 100px |
| 규격 | spec | - |
| 색상 | color | Badge |
| 단위 | unit | Badge |
| 품목유형 | category | - |

**handleImportComplete()**: 전체 필드 매핑 처리

### 테스트 시나리오

1. **양식 다운로드**: 기초자료 → 자재관리 → "양식" 버튼 → 품목마스터.xlsx 다운로드
2. **업로드**: "업로드" 버튼 → 품목마스터 관리.xlsx 선택 → 4,885건 등록
3. **바코드 스캔**:
   - PB625-03027 → name 일치 → 250-351201 자재 매칭
   - 632969-5 → name 일치 → 해당 자재 매칭
   - 682028 → pdaCode 일치 → 250-8668 자재 매칭

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 공정 모니터링 개선 (ProcessView.tsx: 완제품 선택 자동완성, CA 절압착 품번 선택, 선택 삭제 버튼, 승인 시 검증 로직) |
| 2025-12-22 | 자재 재고 삭제 기능 (MaterialStock.tsx: 전체 삭제 버튼, stockService.mock.ts: deleteStockItems/deleteReceivingRecords/resetAllStockData 함수) |
| 2025-12-22 | 품목마스터 양식 템플릿 변경 (17개 컬럼, 바코드 매칭 안내, 품목마스터.xlsx) |
| 2025-12-22 | 품목마스터 관리 양식 적용 (Material 20필드 확장, 15단계 매칭, Excel Import/UI 개선) |
| 2025-12-22 | 전선 색상코드 매핑 (경신전선/케이알로지스 976개 매핑, WireColorMapping 타입, 설정 페이지 로드 UI) |
| 2025-12-22 | 바코드 매칭 개선 (9단계 검색: hqCode→code→name→wireMapping→정규화→부분일치, 76.1% 매칭률) |
| 2025-12-22 | 본사 바코드-자재 매핑 기능 (hqCode 필드 추가, parseHQBarcode 개선, getMaterialByHQCode 함수) |
| 2025-12-22 | Context localStorage 영속화 (MaterialContext, ProductContext, BOMContext - 앱 재시작 시 데이터 유지) |
| 2025-12-22 | Electron 실행 환경 개선 (빈 화면 수정, DevTools 제거, 브라우저 전용 모드 추가) |
| 2025-12-22 | 간편 실행 배치 파일 생성 (run.bat: Electron 모드, run-browser.bat: 브라우저 전용 모드) |
| 2025-12-21 | Excel Import → Context 연동 (ProductContext, BOMContext 생성, 일괄등록 함수 addProducts/addMaterials/addBOMItems) |
| 2025-12-21 | BOM 트리 UI 구현 (품번별 그룹핑, 펼침/접기 토글, 자재 목록 테이블) |
| 2025-12-21 | React state batching 버그 수정 (forEach+setState → 일괄 setState) |
| 2025-12-21 | Windows 환경 설정 (PostgreSQL 17, WSL 연동, 설정 스크립트, 실행 가이드) |
| 2025-12-21 | MBOM 시스템 구현 (7단계: DB 스키마, 공정 마스터, 반제품 품번, MBOM 서비스, 공정 라우팅, SET 번들, UI 컴포넌트) |
| 2025-12-20 | 4단계 마무리 기능 구현 (Excel Import, 백업/복원, 다국어 ko/vi, Electron 프린터 IPC) |
| 2025-12-20 | 3단계 라벨/PDF 기능 구현 (LabelService, DocumentService, 라벨 컴포넌트 3개) |
| 2025-12-20 | 2단계 핵심 기능 구현 (ProductionService, LotTraceService, InspectionService, AuthService, 마스터 서비스 5개) |
| 2025-12-20 | 1단계 DB 기반 구축 (Prisma 6 + PostgreSQL, 15개 모델, 바코드/일련번호 서비스) |
| 2025-12-20 | Excel 다운로드 기능 구현 (xlsx 라이브러리, 4개 페이지 5개 버튼) |
