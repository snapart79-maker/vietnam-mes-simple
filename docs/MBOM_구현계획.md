# MBOM 시스템 구현 계획

> 작성일: 2025-12-21
> 기반 문서: `docs/MBOM_설계_QnA.md`
> 목적: 와이어 하네스 제조 MBOM 구조 단계별 구현

---

## 구현 개요

### 현재 상태 분석

| 항목 | 현재 상태 | 필요 작업 |
|------|----------|----------|
| Product 모델 | FINISHED, SEMI_CA, SEMI_MC 지원 | SEMI_MS, SEMI_SB, SEMI_HS 추가 + 필드 확장 |
| Process 마스터 | 없음 | 신규 생성 필요 |
| BOM 테이블 | 기본 BOM 존재 | MBOM 구조로 확장 필요 |
| ProcessRouting | 없음 | 신규 생성 필요 |
| 바코드 서비스 | V1/V2 지원 | SET 묶음 바코드 기능 추가 |

### 구현 단계 요약

| 단계 | 내용 | 예상 복잡도 | 의존성 |
|------|------|------------|--------|
| 1단계 | DB 스키마 확장 | 높음 | 없음 |
| 2단계 | 공정 마스터 서비스 | 중간 | 1단계 |
| 3단계 | 반제품 품번 체계 | 중간 | 1단계 |
| 4단계 | MBOM 서비스 확장 | 높음 | 2, 3단계 |
| 5단계 | 공정 라우팅 서비스 | 중간 | 2단계 |
| 6단계 | 번들/SET 바코드 개선 | 중간 | 3단계 |
| 7단계 | UI 컴포넌트 구현 | 높음 | 4, 5단계 |

---

## 1단계: 데이터베이스 스키마 확장

### 목표
- Process 마스터 테이블 생성
- Product 모델 확장 (반제품 타입 + 필드)
- ProcessRouting 테이블 생성
- MBOM 테이블 확장

### 구현 내용

#### 1.1 Process 모델 추가 (prisma/schema.prisma)

```prisma
model Process {
  id               Int      @id @default(autoincrement())
  code             String   @unique @db.VarChar(10)
  name             String   @db.VarChar(50)
  seq              Int
  hasMaterialInput Boolean  @default(false) @map("has_material_input")
  isInspection     Boolean  @default(false) @map("is_inspection")
  shortCode        String?  @db.VarChar(2) @map("short_code")  // 단축코드 (C, M, S 등)
  description      String?  @db.Text
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relations
  processRoutings ProcessRouting[]

  @@map("processes")
}
```

#### 1.2 Product 모델 확장

```prisma
enum ProductType {
  FINISHED    // 완제품
  SEMI_CA     // CA 반제품 (절압품)
  SEMI_MS     // MS 반제품 (중간스트립)
  SEMI_MC     // MC 반제품 (수동압착)
  SEMI_SB     // SB 반제품 (서브조립)
  SEMI_HS     // HS 반제품 (열수축)
}

// Product 모델에 필드 추가
model Product {
  // 기존 필드...
  parentCode   String?  @db.VarChar(50) @map("parent_code")   // 완제품 품번 (반제품인 경우)
  circuitNo    Int?     @map("circuit_no")                    // 회로번호 (절압품인 경우)
  bundleQty    Int      @default(100) @map("bundle_qty")      // 기본 묶음 수량
}
```

#### 1.3 ProcessRouting 모델 추가

```prisma
model ProcessRouting {
  id          Int      @id @default(autoincrement())
  productId   Int      @map("product_id")
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  processCode String   @db.VarChar(10) @map("process_code")
  process     Process  @relation(fields: [processCode], references: [code])
  seq         Int
  isRequired  Boolean  @default(true) @map("is_required")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([productId, processCode])
  @@index([productId])
  @@map("process_routings")
}
```

### 파일 수정 목록

| 파일 | 작업 |
|------|------|
| `prisma/schema.prisma` | Process, ProcessRouting 모델 추가, Product 확장 |

### 테스트 항목

```
TEST/stage1/
├── schema.test.ts           # 스키마 유효성 검증
├── migration.test.ts        # 마이그레이션 성공 확인
└── model-relations.test.ts  # 관계 무결성 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Prisma | 마이그레이션 | `npx prisma migrate dev --name add_mbom_models` |
| Prisma | 클라이언트 생성 | `npx prisma generate` |
| Vitest | 테스트 | `npx vitest TEST/stage1/` |

### MCP / 페르소나 / 스킬 조합

```
도구: --seq (Sequential Thinking) + Native Prisma
페르소나: backend-architect
스킬: /sc:implement --focus database
```

### 완료 기준
- [ ] 마이그레이션 성공
- [ ] Prisma Client 정상 생성
- [ ] 테스트 통과 (3개)
- [ ] 사용자 승인

---

## 2단계: 공정 마스터 서비스

### 목표
- 공정 마스터 CRUD 서비스 구현
- 초기 공정 데이터 Seed 스크립트

### 구현 내용

#### 2.1 공정 마스터 Seed 데이터

```typescript
const PROCESS_SEED_DATA = [
  { code: 'CA', name: '자동절단압착', seq: 10, hasMaterialInput: true, isInspection: false, shortCode: 'C' },
  { code: 'MS', name: '중간스트립', seq: 20, hasMaterialInput: false, isInspection: false, shortCode: 'S' },
  { code: 'MC', name: '수동압착', seq: 30, hasMaterialInput: true, isInspection: false, shortCode: 'M' },
  { code: 'SB', name: '서브조립', seq: 40, hasMaterialInput: true, isInspection: false, shortCode: 'B' },
  { code: 'HS', name: '열수축', seq: 50, hasMaterialInput: false, isInspection: false, shortCode: 'H' },
  { code: 'CQ', name: '압착검사', seq: 60, hasMaterialInput: false, isInspection: true, shortCode: 'Q' },
  { code: 'SP', name: '제품조립제공부품', seq: 70, hasMaterialInput: true, isInspection: false, shortCode: 'P' },
  { code: 'PA', name: '제품조립', seq: 80, hasMaterialInput: true, isInspection: false, shortCode: 'A' },
  { code: 'CI', name: '회로검사', seq: 90, hasMaterialInput: false, isInspection: true, shortCode: 'I' },
  { code: 'VI', name: '육안검사', seq: 100, hasMaterialInput: false, isInspection: true, shortCode: 'V' },
]
```

#### 2.2 ProcessService 구현

```typescript
// src/services/processService.ts
export async function getAllProcesses(): Promise<Process[]>
export async function getProcessByCode(code: string): Promise<Process | null>
export async function getProcessesByMaterialInput(hasMaterialInput: boolean): Promise<Process[]>
export async function getInspectionProcesses(): Promise<Process[]>
export async function getProcessSequence(processCodes: string[]): Promise<Process[]>  // 순서 정렬
export async function seedProcesses(): Promise<void>
```

### 파일 생성/수정 목록

| 파일 | 작업 |
|------|------|
| `src/services/processService.ts` | 신규 생성 |
| `prisma/seed.ts` | 공정 Seed 추가 |
| `src/services/index.ts` | Export 추가 |

### 테스트 항목

```
TEST/stage2/
├── processService.test.ts   # CRUD 테스트
├── processSeed.test.ts      # Seed 데이터 검증
└── processOrder.test.ts     # 공정 순서 정렬 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Prisma | Seed 실행 | `npx prisma db seed` |
| Vitest | 테스트 | `npx vitest TEST/stage2/` |
| TypeScript | 타입체크 | `npx tsc --noEmit` |

### MCP / 페르소나 / 스킬 조합

```
도구: Native Prisma + Vitest
페르소나: backend-architect
스킬: /sc:implement --focus service
```

### 완료 기준
- [ ] ProcessService 구현 완료
- [ ] Seed 스크립트 정상 동작
- [ ] 테스트 통과 (3개)
- [ ] 사용자 승인

---

## 3단계: 반제품 품번 체계 서비스

### 목표
- 반제품 품번 생성 규칙 구현
- 완제품 → 절압품 자동 생성
- MS/MC/SB/HS 반제품 코드 생성

### 구현 내용

#### 3.1 품번 생성 규칙

```typescript
// 품번 체계
interface ProductCodeRules {
  finished: string;           // 00315452 (완제품)
  semiCA: string;            // 00315452-001 (절압품, 회로번호)
  semiMS: string;            // MS00315452-001 (공정+절압품번)
  semiMC: string;            // MC00315452 (공정+완제품번)
  semiSB: string;            // SB00315452 (공정+완제품번)
  semiHS: string;            // HS00315452 (공정+완제품번)
}
```

#### 3.2 SemiProductService 구현

```typescript
// src/services/semiProductService.ts

// 절압품 생성 (CA공정 반제품)
export async function generateCrimpProducts(
  finishedProductCode: string,
  circuitCount: number
): Promise<Product[]>

// MS 반제품 코드 생성
export function generateMSCode(crimpProductCode: string): string
// 결과: MS00315452-001

// MC/SB/HS 반제품 코드 생성
export function generateSemiCode(
  processCode: 'MC' | 'SB' | 'HS',
  finishedProductCode: string
): string
// 결과: MC00315452, SB00315452, HS00315452

// 품번으로 반제품 타입 추론
export function inferProductType(code: string): ProductType

// 완제품에서 전체 반제품 구조 생성
export async function createProductHierarchy(
  finishedProductCode: string,
  circuitCount: number,
  processPattern: string[]  // ['CA', 'MS', 'MC', 'SB', 'HS']
): Promise<ProductHierarchy>
```

### 파일 생성/수정 목록

| 파일 | 작업 |
|------|------|
| `src/services/semiProductService.ts` | 신규 생성 |
| `src/services/productService.ts` | 타입 확장 |
| `src/services/index.ts` | Export 추가 |

### 테스트 항목

```
TEST/stage3/
├── semiProductCode.test.ts     # 품번 생성 규칙 테스트
├── crimpProducts.test.ts       # 절압품 생성 테스트
├── productHierarchy.test.ts    # 제품 계층 구조 테스트
└── codeInference.test.ts       # 품번 타입 추론 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Vitest | 테스트 | `npx vitest TEST/stage3/` |
| TypeScript | 타입체크 | `npx tsc --noEmit` |

### MCP / 페르소나 / 스킬 조합

```
도구: Native TypeScript
페르소나: backend-architect
스킬: /sc:implement --focus service
```

### 완료 기준
- [ ] 품번 생성 함수 구현 완료
- [ ] 제품 계층 구조 생성 함수 완료
- [ ] 테스트 통과 (4개)
- [ ] 사용자 승인

---

## 4단계: MBOM 서비스 확장

### 목표
- 공정별 자재 투입 관리
- MBOM 트리 구조 조회
- 공정별 자재 소요량 계산

### 구현 내용

#### 4.1 MBOM 데이터 구조

```typescript
// 공정별 자재 투입 정보
interface MBOMEntry {
  productId: number;          // 완제품 ID
  semiProductId?: number;     // 반제품 ID (절압품 등)
  processCode: string;        // 투입 공정
  itemType: 'MATERIAL' | 'SEMI_PRODUCT';
  materialId?: number;        // 자재 ID
  inputSemiId?: number;       // 투입 반제품 ID (전공정품)
  quantity: number;
  unit: string;
}
```

#### 4.2 MBOMService 확장

```typescript
// src/services/mbomService.ts

// 공정별 자재 투입 등록
export async function createMBOMEntry(input: CreateMBOMInput): Promise<MBOM>

// 완제품의 MBOM 전체 조회
export async function getMBOMByProduct(productId: number): Promise<MBOMWithDetails[]>

// 공정별 자재 조회
export async function getMBOMByProcess(
  productId: number,
  processCode: string
): Promise<MBOMEntry[]>

// MBOM 트리 구조 조회 (공정 순서대로)
export async function getMBOMTree(productId: number): Promise<MBOMTreeNode>

// 공정별 자재 소요량 계산
export async function calculateProcessMaterialRequirements(
  productId: number,
  processCode: string,
  quantity: number
): Promise<MaterialRequirement[]>

// 전공정 반제품 소요량 계산
export async function calculateSemiProductRequirements(
  productId: number,
  processCode: string,
  quantity: number
): Promise<SemiProductRequirement[]>
```

### 파일 생성/수정 목록

| 파일 | 작업 |
|------|------|
| `src/services/mbomService.ts` | 신규 생성 |
| `src/services/bomService.ts` | MBOM 연동 추가 |
| `src/services/index.ts` | Export 추가 |

### 테스트 항목

```
TEST/stage4/
├── mbomCrud.test.ts              # MBOM CRUD 테스트
├── mbomTree.test.ts              # MBOM 트리 구조 테스트
├── materialRequirements.test.ts  # 자재 소요량 계산 테스트
└── semiProductFlow.test.ts       # 반제품 흐름 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Vitest | 테스트 | `npx vitest TEST/stage4/` |
| TypeScript | 타입체크 | `npx tsc --noEmit` |

### MCP / 페르소나 / 스킬 조합

```
도구: --seq (Sequential Thinking) - 복잡한 트리 구조 분석
페르소나: backend-architect
스킬: /sc:implement --focus service --think-hard
```

### 완료 기준
- [ ] MBOMService 구현 완료
- [ ] MBOM 트리 조회 기능 완료
- [ ] 소요량 계산 기능 완료
- [ ] 테스트 통과 (4개)
- [ ] 사용자 승인

---

## 5단계: 공정 라우팅 서비스

### 목표
- 제품별 공정 순서 관리
- 공정 패턴 템플릿 지원
- 공정 흐름 검증

### 구현 내용

#### 5.1 공정 패턴 정의

```typescript
// 기본 공정 패턴
const PROCESS_PATTERNS = {
  simple: ['CA', 'SP', 'PA', 'CI', 'VI'],
  medium: ['CA', 'SB', 'MC', 'CQ', 'SP', 'PA', 'CI', 'VI'],
  complex: ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI'],
}
```

#### 5.2 ProcessRoutingService 구현

```typescript
// src/services/processRoutingService.ts

// 제품별 공정 라우팅 생성
export async function createProcessRouting(
  productId: number,
  processCodes: string[]
): Promise<ProcessRouting[]>

// 패턴 기반 라우팅 생성
export async function createRoutingFromPattern(
  productId: number,
  patternName: 'simple' | 'medium' | 'complex'
): Promise<ProcessRouting[]>

// 제품별 공정 순서 조회
export async function getProcessRouting(productId: number): Promise<ProcessRouting[]>

// 다음 공정 조회
export async function getNextProcess(
  productId: number,
  currentProcessCode: string
): Promise<string | null>

// 이전 공정 조회
export async function getPreviousProcess(
  productId: number,
  currentProcessCode: string
): Promise<string | null>

// 공정 순서 유효성 검증
export async function validateProcessOrder(
  productId: number,
  fromProcess: string,
  toProcess: string
): Promise<{ valid: boolean; error?: string }>

// 공정 라우팅 업데이트
export async function updateProcessRouting(
  productId: number,
  newProcessCodes: string[]
): Promise<ProcessRouting[]>
```

### 파일 생성/수정 목록

| 파일 | 작업 |
|------|------|
| `src/services/processRoutingService.ts` | 신규 생성 |
| `src/services/index.ts` | Export 추가 |

### 테스트 항목

```
TEST/stage5/
├── routingCrud.test.ts        # 라우팅 CRUD 테스트
├── routingPattern.test.ts     # 패턴 기반 생성 테스트
├── processNavigation.test.ts  # 다음/이전 공정 조회 테스트
└── routingValidation.test.ts  # 공정 순서 검증 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Vitest | 테스트 | `npx vitest TEST/stage5/` |
| TypeScript | 타입체크 | `npx tsc --noEmit` |

### MCP / 페르소나 / 스킬 조합

```
도구: Native Prisma
페르소나: backend-architect
스킬: /sc:implement --focus service
```

### 완료 기준
- [ ] ProcessRoutingService 구현 완료
- [ ] 공정 패턴 템플릿 동작
- [ ] 공정 순서 검증 기능 완료
- [ ] 테스트 통과 (4개)
- [ ] 사용자 승인

---

## 6단계: 번들/SET 바코드 개선

### 목표
- 다른 품번 묶음 (SET) 지원
- 취합 바코드 기능 강화
- 번들 정보 조회 API

### 구현 내용

#### 6.1 SET 번들 구조

```typescript
interface SetBundle {
  bundleNo: string;           // 취합 바코드
  bundleType: 'SAME_PRODUCT' | 'MULTI_PRODUCT';
  items: Array<{
    productCode: string;
    lotNumber: string;
    quantity: number;
  }>;
  setQuantity: number;        // SET 기준 수량 (다른 품번인 경우)
  totalQuantity: number;      // 총 수량
}
```

#### 6.2 BundleService 확장

```typescript
// src/services/bundleService.ts (기존 파일 확장)

// SET 번들 생성 (다른 품번 묶음)
export async function createSetBundle(
  items: Array<{ lotId: number; quantity: number }>
): Promise<BundleLot>

// 번들 타입 판별
export function getBundleType(bundle: BundleLot): 'SAME_PRODUCT' | 'MULTI_PRODUCT'

// SET 정보 문자열 생성
export function formatSetInfo(bundle: BundleLot): string
// 결과: "SET × 100 (4품번)" 또는 "00315452-001 × 600"

// 번들 상세 조회
export async function getBundleDetails(bundleNo: string): Promise<SetBundle>

// 번들에서 특정 품번 검색
export async function findItemInBundle(
  bundleNo: string,
  productCode: string
): Promise<BundleItem | null>
```

### 파일 수정 목록

| 파일 | 작업 |
|------|------|
| `src/services/bundleService.ts` | SET 기능 추가 |
| `src/services/barcodeService.ts` | SET 바코드 포맷 지원 |
| `prisma/schema.prisma` | BundleLot에 bundleType 필드 추가 |

### 테스트 항목

```
TEST/stage6/
├── setBundle.test.ts          # SET 번들 생성 테스트
├── bundleType.test.ts         # 번들 타입 판별 테스트
├── bundleFormat.test.ts       # SET 정보 포맷 테스트
└── bundleSearch.test.ts       # 번들 내 검색 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Vitest | 테스트 | `npx vitest TEST/stage6/` |
| Prisma | 마이그레이션 | `npx prisma migrate dev --name add_bundle_type` |

### MCP / 페르소나 / 스킬 조합

```
도구: Native Prisma
페르소나: backend-architect
스킬: /sc:implement --focus service
```

### 완료 기준
- [ ] SET 번들 기능 구현 완료
- [ ] 번들 타입 판별 기능 완료
- [ ] 바코드 포맷 확장 완료
- [ ] 테스트 통과 (4개)
- [ ] 사용자 승인

---

## 7단계: UI 컴포넌트 구현

### 목표
- MBOM 트리 뷰 컴포넌트
- 공정 라우팅 편집기
- 공정별 자재 투입 관리 화면

### 구현 내용

#### 7.1 MBOM 트리 뷰

```tsx
// src/app/components/mbom/MBOMTreeView.tsx
interface MBOMTreeViewProps {
  productId: number;
  onNodeSelect?: (node: MBOMTreeNode) => void;
  editable?: boolean;
}

// 기능:
// - 공정 순서대로 트리 표시
// - 노드 펼침/접기
// - 노드 선택 시 상세 정보 표시
// - 편집 모드에서 자재/반제품 추가/삭제
```

#### 7.2 공정 라우팅 편집기

```tsx
// src/app/components/mbom/ProcessRoutingEditor.tsx
interface ProcessRoutingEditorProps {
  productId: number;
  onSave?: (routing: ProcessRouting[]) => void;
}

// 기능:
// - 드래그 앤 드롭으로 공정 순서 변경
// - 공정 추가/삭제
// - 공정 패턴 템플릿 선택
// - 필수/선택 공정 설정
```

#### 7.3 공정별 자재 관리

```tsx
// src/app/components/mbom/ProcessMaterialManager.tsx
interface ProcessMaterialManagerProps {
  productId: number;
  processCode: string;
  onMaterialChange?: () => void;
}

// 기능:
// - 공정에 투입되는 자재 목록 표시
// - 자재 추가/수정/삭제
// - 전공정 반제품 선택
// - 소요량 입력
```

### 파일 생성 목록

| 파일 | 작업 |
|------|------|
| `src/app/components/mbom/MBOMTreeView.tsx` | 신규 생성 |
| `src/app/components/mbom/ProcessRoutingEditor.tsx` | 신규 생성 |
| `src/app/components/mbom/ProcessMaterialManager.tsx` | 신규 생성 |
| `src/app/components/mbom/index.ts` | Export 파일 |
| `src/app/pages/MBOMManagement.tsx` | MBOM 관리 페이지 |

### 테스트 항목

```
TEST/stage7/
├── MBOMTreeView.test.tsx         # 트리 뷰 렌더링 테스트
├── ProcessRoutingEditor.test.tsx  # 라우팅 편집기 테스트
├── ProcessMaterialManager.test.tsx # 자재 관리 테스트
└── MBOMPage.test.tsx              # 페이지 통합 테스트
```

### 사용 도구/명령어

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Vitest | 테스트 | `npx vitest TEST/stage7/` |
| TypeScript | 타입체크 | `npx tsc --noEmit` |

### MCP / 페르소나 / 스킬 조합

```
도구: --magic (21st.dev UI 패턴) + Radix UI
페르소나: frontend-architect
스킬: /sc:implement --focus ui --think
```

### 완료 기준
- [ ] MBOM 트리 뷰 컴포넌트 완료
- [ ] 공정 라우팅 편집기 완료
- [ ] 공정별 자재 관리 화면 완료
- [ ] 테스트 통과 (4개)
- [ ] 사용자 승인

---

## 테스트 전략

### 테스트 파일 구조

```
TEST/
├── stage1/          # 1단계: DB 스키마
├── stage2/          # 2단계: 공정 마스터
├── stage3/          # 3단계: 반제품 품번
├── stage4/          # 4단계: MBOM 서비스
├── stage5/          # 5단계: 공정 라우팅
├── stage6/          # 6단계: 번들/SET
├── stage7/          # 7단계: UI 컴포넌트
├── integration/     # 통합 테스트
└── e2e/             # E2E 테스트
```

### 테스트 실행 명령어

```bash
# 단계별 테스트
npx vitest TEST/stage1/
npx vitest TEST/stage2/
# ...

# 전체 테스트
npx vitest TEST/

# 감시 모드
npx vitest --watch TEST/stage1/
```

### 테스트 통과 기준

- 모든 단위 테스트 통과
- 커버리지 80% 이상
- 타입 에러 없음 (`npx tsc --noEmit`)

---

## 기록 관리

### 단계별 완료 기록

각 단계 완료 시 `docs/MBOM_구현기록.md`에 기록:

```markdown
## 단계 N 완료

- 완료일: YYYY-MM-DD
- 구현 내용: [요약]
- 수정된 파일: [목록]
- 테스트 결과: [통과/실패 내역]
- 특이사항: [있는 경우]
- 사용자 승인: ✅
```

---

## 참고 문서

| 문서 | 위치 |
|------|------|
| MBOM 설계 Q&A | `docs/MBOM_설계_QnA.md` |
| 프로젝트 규칙 | `CLAUDE.md` |
| Prisma 스키마 | `prisma/schema.prisma` |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-21 | 초안 작성 (7단계 구현 계획) |
