# MBOM 시스템 종합 정리

> 작성일: 2025-12-21
> 프로젝트: Vietnam MES (Manufacturing Execution System)
> 구현 기간: 2025-12-21 (1일)

---

## 1. 개요

### 1.1 목적
와이어 하네스 제조 공정에 특화된 MBOM(Manufacturing BOM) 시스템 구현

### 1.2 주요 기능
- 공정 기반 BOM 관리 (공정별 자재/반제품 투입)
- 제품별 공정 라우팅 관리 (순서, 패턴)
- 반제품 품번 자동 생성 체계
- SET 번들 (다른 품번 묶음) 지원
- MBOM 트리 뷰 UI 컴포넌트

### 1.3 기술 스택
| 분류 | 기술 |
|------|------|
| 데이터베이스 | PostgreSQL 16 + Prisma 6 |
| 백엔드 서비스 | TypeScript |
| 프론트엔드 | React 18 + Radix UI + Tailwind CSS |
| 테스트 | Vitest |

---

## 2. 데이터베이스 스키마

### 2.1 신규 모델

#### Process (공정 마스터)
```prisma
model Process {
  id               Int       @id @default(autoincrement())
  code             String    @unique @db.VarChar(10)  // CA, MC, MS 등
  name             String    @db.VarChar(50)           // 공정명
  seq              Int                                  // 공정 순서
  hasMaterialInput Boolean   @default(false)           // 자재 투입 여부
  isInspection     Boolean   @default(false)           // 검사 공정 여부
  shortCode        String?   @db.VarChar(2)            // 단축코드
  isActive         Boolean   @default(true)

  processRoutings ProcessRouting[]
}
```

#### ProcessRouting (제품별 공정 순서)
```prisma
model ProcessRouting {
  id          Int       @id @default(autoincrement())
  productId   Int                                      // 제품 ID
  product     Product   @relation(...)
  processCode String    @db.VarChar(10)               // 공정 코드
  process     Process   @relation(...)
  seq         Int                                      // 제품 내 순서
  isRequired  Boolean   @default(true)                // 필수 여부

  @@unique([productId, processCode])
}
```

### 2.2 확장된 모델

#### Product 추가 필드
```prisma
model Product {
  // 기존 필드...
  parentCode    String?   // 완제품 품번 (반제품인 경우)
  circuitNo     Int?      // 회로번호 (절압품인 경우)
  bundleQty     Int @default(100)  // 기본 묶음 수량

  processRoutings ProcessRouting[]
}
```

#### ProductType 확장
```prisma
enum ProductType {
  FINISHED    // 완제품
  SEMI_CA     // CA 반제품 (절압품)
  SEMI_MS     // MS 반제품 (중간스트립)
  SEMI_MC     // MC 반제품 (수동압착)
  SEMI_SB     // SB 반제품 (서브조립)
  SEMI_HS     // HS 반제품 (열수축)
}
```

#### BundleType 추가
```prisma
enum BundleType {
  SAME_PRODUCT    // 동일 품번 묶음
  MULTI_PRODUCT   // 다른 품번 묶음 (SET)
}

model BundleLot {
  // 기존 필드...
  bundleType  BundleType  @default(SAME_PRODUCT)
}
```

### 2.3 BOM 구조
```prisma
model BOM {
  id             Int         @id
  productId      Int                    // 상위 제품 (완제품)
  itemType       BOMItemType            // MATERIAL | PRODUCT
  materialId     Int?                   // 자재 ID
  childProductId Int?                   // 반제품 ID
  quantity       Float       @default(1)
  unit           String?
  processCode    String?                // 투입 공정
}
```

---

## 3. 공정 마스터 데이터

### 3.1 10개 표준 공정

| 순서 | 코드 | 공정명 | 자재투입 | 검사 | 단축코드 |
|------|------|--------|---------|------|---------|
| 10 | CA | 자동절단압착 | O | X | C |
| 20 | MS | 중간스트립 | X | X | S |
| 30 | MC | 수동압착 | O | X | M |
| 40 | SB | 서브조립 | O | X | B |
| 50 | HS | 열수축 | X | X | H |
| 60 | CQ | 압착검사 | X | O | Q |
| 70 | SP | 제품조립제공부품 | O | X | P |
| 80 | PA | 제품조립 | O | X | A |
| 90 | CI | 회로검사 | X | O | I |
| 100 | VI | 육안검사 | X | O | V |

### 3.2 공정 라우팅 패턴

| 패턴명 | 공정 구성 | 공정 수 |
|--------|----------|---------|
| simple | CA → SP → PA → CI → VI | 5개 |
| medium | CA → SB → MC → CQ → SP → PA → CI → VI | 8개 |
| complex | CA → MS → MC → SB → HS → CQ → SP → PA → CI → VI | 10개 |

---

## 4. 반제품 품번 체계

### 4.1 품번 규칙

| 유형 | 형식 | 예시 | 설명 |
|------|------|------|------|
| 완제품 | `[품번]` | 00315452 | 기본 품번 |
| 절압품(CA) | `[품번]-[회로번호]` | 00315452-001 | 회로별 생성 |
| MS 반제품 | `MS[절압품번]` | MS00315452-001 | 절압품 기반 |
| MC 반제품 | `MC[품번]` | MC00315452 | 완제품 기반 |
| SB 반제품 | `SB[품번]` | SB00315452 | 완제품 기반 |
| HS 반제품 | `HS[품번]` | HS00315452 | 완제품 기반 |

### 4.2 제품 계층 구조

```
완제품 (FINISHED): 00315452
├── 절압품 (SEMI_CA): 00315452-001, 00315452-002, ... (회로 수만큼)
│   └── MS 반제품 (SEMI_MS): MS00315452-001, MS00315452-002, ...
├── MC 반제품 (SEMI_MC): MC00315452
├── SB 반제품 (SEMI_SB): SB00315452
└── HS 반제품 (SEMI_HS): HS00315452
```

---

## 5. 서비스 API

### 5.1 ProcessService (공정 마스터)

| 함수 | 설명 |
|------|------|
| `getAllProcesses()` | 모든 공정 조회 (순서대로) |
| `getProcessByCode(code)` | 코드로 공정 조회 |
| `getMaterialInputProcesses()` | 자재 투입 가능 공정 |
| `getInspectionProcesses()` | 검사 공정만 조회 |
| `isValidProcessCode(code)` | 공정 코드 유효성 검증 |
| `seedProcesses()` | 10개 표준 공정 Seed |

### 5.2 SemiProductService (반제품 품번)

| 함수 | 설명 |
|------|------|
| `generateCrimpCode(finishedCode, circuitNo)` | 절압품 코드 생성 |
| `generateMSCode(crimpCode)` | MS 반제품 코드 생성 |
| `generateSemiCode(processCode, finishedCode)` | MC/SB/HS 코드 생성 |
| `inferProductType(code)` | 품번에서 타입 추론 |
| `extractFinishedCode(code)` | 완제품 코드 추출 |
| `createProductHierarchy(...)` | 전체 계층 구조 생성 |

### 5.3 MBOMService (Manufacturing BOM)

| 함수 | 설명 |
|------|------|
| `createMBOMEntry(input)` | BOM 항목 생성 |
| `getMBOMByProduct(productId)` | 제품별 BOM 조회 |
| `getMBOMByProcess(productId, processCode)` | 공정별 BOM 조회 |
| `getMBOMTree(productId)` | 트리 구조 조회 |
| `calculateProcessMaterialRequirements(...)` | 공정별 자재 소요량 |
| `calculateTotalMaterialRequirements(...)` | 전체 자재 소요량 |
| `calculateSemiProductRequirements(...)` | 반제품 소요량 |
| `addMaterialsToProcess(...)` | 자재 일괄 추가 |
| `copyMBOM(sourceId, targetId)` | BOM 복사 |

### 5.4 ProcessRoutingService (공정 라우팅)

| 함수 | 설명 |
|------|------|
| `createProcessRouting(productId, codes)` | 라우팅 생성 |
| `createRoutingFromPattern(productId, pattern)` | 패턴으로 생성 |
| `getProcessRouting(productId)` | 라우팅 조회 |
| `getNextProcess(productId, current)` | 다음 공정 |
| `getPreviousProcess(productId, current)` | 이전 공정 |
| `getFirstProcess(productId)` | 첫 공정 |
| `getLastProcess(productId)` | 마지막 공정 |
| `validateProcessOrder(...)` | 공정 순서 검증 |
| `validateRouting(productId)` | 전체 라우팅 검증 |
| `copyRouting(sourceId, targetId)` | 라우팅 복사 |

### 5.5 BundleService 확장 (SET 번들)

| 함수 | 설명 |
|------|------|
| `createSetBundle(items)` | SET 번들 생성 |
| `determineBundleType(bundleId)` | 번들 타입 판별 |
| `getBundleTypeById(bundleId)` | 저장된 타입 조회 |
| `formatSetInfo(bundleId)` | SET 정보 문자열 |
| `getBundleDetails(bundleNo)` | 상세 조회 |
| `findItemInBundle(bundleNo, productCode)` | 품번 검색 |
| `getProductsInBundle(bundleId)` | 품번별 집계 |
| `getSetBundleStats()` | 타입별 통계 |

---

## 6. UI 컴포넌트

### 6.1 MBOMTreeView

MBOM 구조를 트리 형태로 표시하는 컴포넌트

```tsx
import { MBOMTreeView } from '@/app/components/mbom'

<MBOMTreeView
  productId={123}
  data={mbomTreeData}
  onNodeSelect={(node) => handleSelect(node)}
  onMaterialClick={(material, processCode) => handleMaterialClick(material)}
  onAddMaterial={(processCode) => handleAddMaterial(processCode)}
  onDeleteMaterial={(id, processCode) => handleDelete(id)}
  editable={true}
  loading={false}
/>
```

**주요 기능:**
- 공정 순서대로 트리 표시
- 노드 펼침/접기 (Collapsible)
- 공정별 자재/반제품 목록
- 검색 (공정, 자재, 반제품)
- 편집 모드 (추가/삭제)

### 6.2 ProcessRoutingEditor

제품별 공정 라우팅을 편집하는 컴포넌트

```tsx
import { ProcessRoutingEditor } from '@/app/components/mbom'

<ProcessRoutingEditor
  productId={123}
  routing={currentRouting}
  availableProcesses={allProcesses}
  patterns={[
    { name: 'simple', processes: ['CA', 'SP', 'PA', 'CI', 'VI'], description: '단순 공정' },
    // ...
  ]}
  onSave={async (routing) => await saveRouting(routing)}
  onValidate={async (routing) => await validateRouting(routing)}
  loading={false}
/>
```

**주요 기능:**
- 드래그 앤 드롭 순서 변경
- 공정 추가/삭제
- 패턴 템플릿 선택
- 필수/선택 토글
- 변경 추적 및 저장
- 검증 에러 표시

---

## 7. 파일 구조

### 7.1 신규 생성 파일

```
src/
├── services/
│   ├── processService.ts          # 공정 마스터 서비스
│   ├── semiProductService.ts      # 반제품 품번 서비스
│   ├── mbomService.ts             # MBOM 서비스
│   ├── processRoutingService.ts   # 공정 라우팅 서비스
│   └── bundleService.ts           # (확장) SET 번들 기능
│
├── app/components/mbom/
│   ├── MBOMTreeView.tsx           # MBOM 트리 뷰
│   ├── ProcessRoutingEditor.tsx   # 공정 라우팅 편집기
│   └── index.ts                   # Export
│
prisma/
├── schema.prisma                  # (확장) Process, ProcessRouting, BundleType
├── seed.ts                        # (확장) 공정 Seed
└── migrations/
    ├── 20251221055338_add_mbom_models/
    └── 20251221083624_add_bundle_type/

TEST/
├── stage1/                        # DB 스키마 테스트 (16개)
├── stage2/                        # 공정 마스터 테스트 (54개)
├── stage3/                        # 반제품 품번 테스트 (54개)
├── stage4/                        # MBOM 서비스 테스트 (35개)
├── stage5/                        # 공정 라우팅 테스트 (86개)
└── stage6/                        # SET 번들 테스트 (37개)
```

### 7.2 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | ProductType 확장, Product 필드 추가, Process/ProcessRouting 모델, BundleType |
| `prisma/seed.ts` | 공정 Seed 데이터 추가 |
| `src/services/index.ts` | 신규 서비스 Export |
| `src/services/bundleService.ts` | SET 번들 기능 추가 |

---

## 8. 테스트 현황

### 8.1 테스트 요약

| 단계 | 테스트 파일 | 테스트 수 | 상태 |
|------|------------|----------|------|
| Stage 1 | schema, migration, model-relations | 16 | ✅ |
| Stage 2 | processService, processSeed, processOrder | 54 | ✅ |
| Stage 3 | semiProductCode, codeInference, crimpProducts, productHierarchy | 54 | ✅ |
| Stage 4 | mbomCrud, mbomTree, materialRequirements, semiProductFlow | 35 | ✅ |
| Stage 5 | routingCrud, routingPattern, processNavigation, routingValidation | 86 | ✅ |
| Stage 6 | setBundle, bundleType, bundleFormat, bundleSearch | 37 | ✅ |
| **합계** | **24개 파일** | **282** | ✅ |

### 8.2 테스트 실행 명령

```bash
# 전체 테스트
npx vitest run TEST/ --no-file-parallelism

# 단계별 테스트
npx vitest run TEST/stage1/
npx vitest run TEST/stage2/
# ...

# 감시 모드
npx vitest --watch TEST/
```

---

## 9. 사용 예시

### 9.1 제품 및 BOM 설정

```typescript
import {
  createProductHierarchy,
  createRoutingFromPattern,
  createMBOMEntry,
  getMBOMTree,
} from '@/services'

// 1. 제품 계층 구조 생성 (완제품 + 반제품들)
const hierarchy = await createProductHierarchy('00315452', 10, ['CA', 'MC', 'SB'])
// → 완제품 1개 + 절압품 10개 + MS 10개 + MC 1개 + SB 1개 생성

// 2. 공정 라우팅 설정
const routing = await createRoutingFromPattern(hierarchy.finished.id, 'medium')
// → CA → SB → MC → CQ → SP → PA → CI → VI

// 3. 공정별 자재 투입 설정
await createMBOMEntry({
  productId: hierarchy.finished.id,
  processCode: 'CA',
  itemType: 'MATERIAL',
  materialId: wireId,
  quantity: 10,
  unit: 'm',
})

await createMBOMEntry({
  productId: hierarchy.finished.id,
  processCode: 'PA',
  itemType: 'SEMI_PRODUCT',
  inputSemiId: hierarchy.semiMC.id,
  quantity: 1,
})

// 4. MBOM 트리 조회
const tree = await getMBOMTree(hierarchy.finished.id)
// → 공정 순서대로 자재/반제품 트리 구조
```

### 9.2 생산 시 소요량 계산

```typescript
import {
  calculateProcessMaterialRequirements,
  calculateTotalMaterialRequirements,
  getNextProcess,
} from '@/services'

// 공정별 자재 소요량
const caMaterials = await calculateProcessMaterialRequirements(productId, 'CA', 100)
// → CA 공정에서 100개 생산 시 필요한 자재 목록

// 전체 자재 소요량
const totalMaterials = await calculateTotalMaterialRequirements(productId, 100)
// → 모든 공정 합산 자재 소요량

// 다음 공정 확인
const nextProcess = await getNextProcess(productId, 'CA')
// → 'SB' (medium 패턴 기준)
```

### 9.3 SET 번들 생성

```typescript
import { createSetBundle, getBundleDetails, formatSetInfo } from '@/services'

// 다른 품번 LOT들을 SET으로 묶기
const setBundle = await createSetBundle([
  { lotId: lot1Id, quantity: 100 },  // 품번 A
  { lotId: lot2Id, quantity: 100 },  // 품번 B
  { lotId: lot3Id, quantity: 100 },  // 품번 C
])
// → bundleType: 'MULTI_PRODUCT'

// SET 정보 문자열
const info = await formatSetInfo(setBundle.id)
// → "SET × 300 (3품번)"

// 상세 조회
const details = await getBundleDetails(setBundle.bundleNo)
// → { items: [...], uniqueProductCount: 3, totalQuantity: 300 }
```

---

## 10. 아키텍처 다이어그램

### 10.1 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MBOM 시스템 아키텍처                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Product   │────▶│     BOM     │────▶│  Material   │     │   Process   │
│   (제품)    │     │  (BOM항목)  │     │   (자재)    │     │ (공정마스터)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                    │                                       ▲
      │                    │ processCode                           │
      │                    ▼                                       │
      │             ┌─────────────┐                               │
      │             │    공정     │◀──────────────────────────────┘
      │             │  (투입공정) │
      │             └─────────────┘
      │
      ▼
┌─────────────────┐
│ ProcessRouting  │
│ (제품별 공정순서)│
└─────────────────┘
```

### 10.2 서비스 계층

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Service Layer                                   │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────┐
│  ProcessService │ SemiProductSvc  │   MBOMService   │ProcessRoutingService│
│  (공정 마스터)  │ (반제품 품번)   │    (MBOM)       │   (공정 라우팅)     │
├─────────────────┼─────────────────┼─────────────────┼─────────────────────┤
│ - CRUD          │ - 품번 생성     │ - BOM CRUD      │ - 라우팅 CRUD       │
│ - Seed          │ - 타입 추론     │ - 트리 조회     │ - 패턴 생성         │
│ - 순서 관리     │ - 계층 구조     │ - 소요량 계산   │ - 네비게이션        │
│ - 검증          │ - 추출/검증     │ - 일괄 작업     │ - 검증              │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI Components                                   │
├─────────────────────────────────┬───────────────────────────────────────────┤
│        MBOMTreeView             │         ProcessRoutingEditor              │
│   (MBOM 트리 뷰 컴포넌트)       │      (공정 라우팅 편집기)                 │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 11. 구현 단계 요약

| 단계 | 내용 | 주요 산출물 | 테스트 |
|------|------|------------|--------|
| 1단계 | DB 스키마 확장 | Process, ProcessRouting, Product 확장 | 16개 |
| 2단계 | 공정 마스터 서비스 | processService.ts, 10개 공정 Seed | 54개 |
| 3단계 | 반제품 품번 체계 | semiProductService.ts | 54개 |
| 4단계 | MBOM 서비스 확장 | mbomService.ts (20+ 함수) | 35개 |
| 5단계 | 공정 라우팅 서비스 | processRoutingService.ts (25+ 함수) | 86개 |
| 6단계 | SET 번들 개선 | bundleService.ts 확장, BundleType | 37개 |
| 7단계 | UI 컴포넌트 | MBOMTreeView, ProcessRoutingEditor | 타입 체크 |

**총 테스트: 282개 (모두 통과)**

---

## 12. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-21 | MBOM 시스템 7단계 전체 구현 완료 |

---

## 13. 향후 계획 (참고)

1. **MBOM 관리 페이지 구현** - MBOMTreeView, ProcessRoutingEditor 통합
2. **생산 지시와 연동** - MBOM 기반 자재 자동 할당
3. **소요량 예측** - 생산 계획 기반 자재 수요 예측
4. **Excel Import/Export** - MBOM 데이터 일괄 등록/내보내기
