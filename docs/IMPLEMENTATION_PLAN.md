# Python Barcord → JavaScript MES 기능 통합 구현 계획서

> **작성일**: 2025-12-21
> **상태**: Phase 6 완료 (전체 완료) ✅
> **최종 업데이트**: 2025-12-21

## Phase 1 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| CI 바코드 생성 | `src/services/barcodeService.ts` | ✅ |
| CI 바코드 파싱 | `src/services/barcodeService.ts` | ✅ |
| CI 바코드 검증 | `src/services/barcodeService.ts` | ✅ |
| CI 시퀀스 서비스 | `src/services/sequenceService.ts` | ✅ |
| Mock 서비스 | `src/services/mock/sequenceService.mock.ts` | ✅ |

### 추가된 함수
```typescript
// barcodeService.ts
- generateCIBarcode(productCode, quantity, markingLot, sequence)
- parseCIBarcode(barcode): CIBarcodeData | null
- validateCIBarcode(barcode): boolean
- isCIBarcode(barcode): boolean
- formatCIBarcodeInfo(barcode): string
- CI_BARCODE_PATTERN (정규식)

// sequenceService.ts
- getNextCISequence(productCode, markingLot)
- getCurrentCISequence(productCode, markingLot)
- resetCISequence(productCode, markingLot?)
```

### 테스트 결과
```
테스트 파일: TEST/phase1_ci_barcode.test.ts
결과: 23개 테스트 모두 통과 ✅
```

---

## Phase 2 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| StartProductionInput 타입 | `src/services/productionService.ts` | ✅ |
| CompleteProductionInput 타입 | `src/services/productionService.ts` | ✅ |
| startNewProduction() | `src/services/productionService.ts` | ✅ |
| completeProductionV2() | `src/services/productionService.ts` | ✅ |
| deleteInProgressProduction() | `src/services/productionService.ts` | ✅ |
| getInProgressLots() | `src/services/productionService.ts` | ✅ |
| Mock 서비스 | `src/services/mock/productionService.mock.ts` | ✅ |

### 추가된 함수
```typescript
// productionService.ts - 2단계 워크플로우
- startNewProduction(input: StartProductionInput): Promise<LotWithRelations>
  // 바코드 생성 + LOT 생성 (status=IN_PROGRESS) + 이월 사용

- completeProductionV2(input: CompleteProductionInput): Promise<LotWithRelations>
  // 완료 수량 입력 + status=COMPLETED + 이월 생성

- deleteInProgressProduction(lotId, options?): Promise<void>
  // IN_PROGRESS LOT 삭제 (soft/hard) + 이월 롤백

- getInProgressLots(options?): Promise<LotWithRelations[]>
  // 진행 중 LOT 조회 (공정/라인/작업자 필터)

- isLotInProgress(lot): boolean
- isLotCompleted(lot): boolean
```

### 적용 공정
```
MO, CA, MC, MS, SB, HS, SP, PA, CI, VI (10개 전체)
```

### 워크플로우 다이어그램
```
┌─────────────────────────────────────────────────────────────┐
│  2단계 생산 워크플로우                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: startNewProduction()                               │
│    - 바코드 생성                                             │
│    - LOT 생성 (status=IN_PROGRESS)                          │
│    - 이월 수량 사용 (옵션)                                    │
│                           ↓                                 │
│                    [작업 수행]                               │
│                           ↓                                 │
│  Step 2: completeProductionV2()                             │
│    - 완료/불량 수량 입력                                      │
│    - status=COMPLETED                                       │
│    - 이월 생성 (옵션)                                        │
│                                                             │
│  (선택) deleteInProgressProduction()                        │
│    - 작업 취소 시                                            │
│    - 이월 사용 롤백                                          │
│    - status=CANCELLED 또는 삭제                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 테스트 결과
```
테스트 파일: TEST/phase2_two_step_workflow.test.ts
결과: 19개 테스트 모두 통과 ✅
```

---

## Phase 3 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| processValidation.ts 신규 생성 | `src/lib/processValidation.ts` | ✅ |
| 공정별 입력 규칙 정의 | `src/lib/processValidation.ts` | ✅ |
| 이전 공정 제한 규칙 | `src/lib/processValidation.ts` | ✅ |
| 바코드 타입 추론 | `src/lib/processValidation.ts` | ✅ |
| productionService 통합 | `src/services/productionService.ts` | ✅ |
| Mock 서비스 | `src/services/mock/productionService.mock.ts` | ✅ |

### 추가된 함수
```typescript
// processValidation.ts - 핵심 검증 함수
- isValidProcessCode(code): boolean
- isInputTypeAllowed(processCode, inputType): boolean
- inferInputType(barcode): InputType
- validateSingleInput(processCode, input): ValidationResult
- validateInputs(processCode, inputs[]): ValidationResult
- validateBarcodes(processCode, barcodes[]): ValidationResult
- createInputsFromBarcodes(barcodes[]): InputItem[]

// processValidation.ts - 유틸리티 함수
- getInputTypeName(type): string
- getProcessInputDescription(processCode): string
- getAllProcessInputRules(): ProcessRuleInfo[]
- formatValidationErrors(result): string
- summarizeValidationResult(result): ValidationSummary

// productionService.ts - 통합 함수
- validateProcessInputs(processCode, barcodes): ValidationResult
- validateMaterialInput(lotId, barcode): Promise<ValidationResult>
- addMaterialWithValidation(input, options): Promise<Result>
- addMaterialsBatch(lotId, materials, options): Promise<Result>
- getAllowedInputTypes(processCode): InputType[] | null
- inferBarcodeInputType(barcode): InputType
```

### 공정별 입력 규칙
```typescript
const PROCESS_INPUT_RULES = {
  MO: ['material'],           // 자재만
  CA: ['material'],           // 자재만
  MC: ['semi_product'],       // 반제품만
  MS: ['semi_product'],       // 반제품만
  SB: ['material', 'semi_product'], // 자재 + 반제품
  HS: ['semi_product'],       // 반제품만
  SP: ['semi_product'],       // 반제품만
  PA: ['semi_product'],       // 반제품만
  CI: ['production'],         // 생산 LOT만
  VI: ['production'],         // 생산 LOT만
}
```

### 이전 공정 제한 규칙
```typescript
const ALLOWED_PREVIOUS_PROCESSES = {
  MO: [],           // 자재만
  CA: [],           // 자재만
  MC: ['CA', 'SB'], // CA 또는 SB 출력
  MS: ['CA'],       // CA 출력
  SB: ['CA', 'MC'], // CA 또는 MC 출력
  HS: ['CA', 'MC', 'MS', 'SB'],
  SP: ['CA', 'MC', 'MS', 'SB', 'HS'],
  PA: ['SP'],       // SP 출력만
  CI: ['PA'],       // PA 출력만
  VI: ['CI'],       // CI 출력만
}
```

### 테스트 결과
```
테스트 파일: TEST/phase3_process_validation.test.ts
결과: 46개 테스트 모두 통과 ✅

테스트 카테고리:
- isValidProcessCode: 2개
- isInputTypeAllowed: 10개 (10개 공정 각각)
- inferInputType: 6개
- validateSingleInput: 5개
- validateInputs: 5개
- validateBarcodes: 3개
- createInputsFromBarcodes: 1개
- 유틸리티 함수: 5개
- 상수 검증: 4개
- Mock 서비스 통합: 3개
- 복합 시나리오: 2개
```

---

## Phase 4 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| BOM 소요량 조회 함수 | `src/services/bomService.ts` | ✅ |
| 필요 자재 수량 계산 | `src/services/bomService.ts` | ✅ |
| 다단계 BOM 전개 | `src/services/bomService.ts` | ✅ |
| FIFO 자재 차감 (음수 허용) | `src/services/stockService.ts` | ✅ |
| BOM 기반 자재 차감 | `src/services/stockService.ts` | ✅ |
| 차감 롤백 | `src/services/stockService.ts` | ✅ |
| 가용 재고 확인 | `src/services/stockService.ts` | ✅ |
| Mock BOM 서비스 | `src/services/mock/bomService.mock.ts` | ✅ (신규) |
| Mock Stock 서비스 확장 | `src/services/mock/stockService.mock.ts` | ✅ |

### 추가된 함수
```typescript
// bomService.ts - BOM 소요량 조회
- getBOMRequirements(productId, processCode?): Promise<BOMRequirement[]>
- calculateRequiredMaterials(productId, processCode, productionQty): Promise<CalculatedRequirement[]>
- explodeBOM(productId, productionQty, maxDepth?): Promise<Map<number, CalculatedRequirement>>
- hasBOM(productId, processCode?): Promise<boolean>
- getBOMCountByProcess(productId): Promise<Record<string, number>>

// stockService.ts - BOM 기반 자재 차감
- consumeStockFIFOWithNegative(materialId, quantity, productionLotId?, allowNegative?): Promise<FIFOResult>
- deductByBOM(productId, processCode, productionQty, inputMaterials?, allowNegative?, productionLotId?): Promise<DeductionResult>
- rollbackBOMDeduction(productionLotId): Promise<number>
- checkBOMAvailability(productId, processCode, productionQty): Promise<AvailabilityResult>
```

### 핵심 기능

**BOM 소요량 계산**:
```typescript
// 생산 수량 기반 필요 자재 계산
const requirements = await calculateRequiredMaterials(productId, 'CA', 100)
// [{ materialId: 1, materialCode: 'WIRE-001', requiredQty: 250, ... }]
```

**음수 재고 허용 차감**:
```typescript
// allowNegative=true (기본값): 재고 부족해도 차감 진행
const result = await deductByBOM(productId, 'CA', 100, [], true)
// result.success = true (음수 재고 발생 가능)
```

**FIFO 자재 차감**:
```
1. 가용 재고 조회 (입고일 오래된 순)
2. 각 LOT에서 순차 차감
3. 음수 허용 시 마지막 LOT에서 초과 차감
4. 자재 투입 기록 (LotMaterial) 생성
```

**차감 롤백**:
```typescript
// 생산 취소 시 차감된 자재 복원
const restoredCount = await rollbackBOMDeduction(productionLotId)
```

### 테스트 결과
```
테스트 파일: TEST/phase4_bom_deduction.test.ts
결과: 18개 테스트 모두 통과 ✅

테스트 카테고리:
- BOM 소요량 조회: 4개
- 필요 자재 수량 계산: 2개
- FIFO 자재 차감: 3개
- 음수 재고 허용: 2개
- BOM 기반 자재 차감: 3개
- 차감 롤백: 1개
- 가용 재고 확인: 2개
- 복합 시나리오: 1개
```

---

## Phase 5 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| 검사 대상 공정 규칙 정의 | `src/services/inspectionService.ts` | ✅ |
| 공정별 검사 대상 검증 | `src/services/inspectionService.ts` | ✅ |
| 중복 검사 방지 | `src/services/inspectionService.ts` | ✅ |
| LOT 검사 상태 조회 | `src/services/inspectionService.ts` | ✅ |
| Mock 서비스 확장 | `src/services/mock/inspectionService.mock.ts` | ✅ |

### 추가된 타입 및 상수
```typescript
// inspectionService.ts - 타입 정의
type InspectionProcessCode = 'MO' | 'CA' | 'MC' | 'MS' | 'SB' | 'HS' | 'SP' | 'PA' | 'CI' | 'VI'

// 검사 유형별 허용 공정 규칙
const INSPECTION_TARGET_PROCESS: Record<InspectionType, InspectionProcessCode[]> = {
  CRIMP: ['CA', 'MC'],    // 압착 검사 → CA, MC만
  CIRCUIT: ['PA'],        // 회로 검사 → PA만
  VISUAL: ['CI'],         // 육안 검사 → CI만
}

// 검사 유형 한글명
const INSPECTION_TYPE_NAMES: Record<InspectionType, string> = {
  CRIMP: '압착검사',
  CIRCUIT: '회로검사',
  VISUAL: '육안검사',
}

// 공정 한글명
const INSPECTION_PROCESS_NAMES: Record<InspectionProcessCode, string>
```

### 추가된 함수
```typescript
// inspectionService.ts - 검사 대상 검증
- validateInspectionTarget(inspectionType, lotNumber): Promise<InspectionTargetValidation>
  // LOT의 공정 코드가 검사 유형에 허용되는지 검증

- checkDuplicateInspection(lotNumber, inspectionType): Promise<DuplicateCheckResult>
  // 동일 LOT에 동일 유형 검사 이미 수행되었는지 확인

- canPerformInspection(inspectionType, lotNumber, allowDuplicate?): Promise<CanInspectResult>
  // 대상 검증 + 중복 확인 통합

- createInspectionWithValidation(input, options): Promise<InspectionWithValidationResult>
  // 검증 후 검사 기록 생성

- getAllowedProcessesForInspection(inspectionType): InspectionProcessCode[]
  // 검사 유형에 허용되는 공정 목록

- getApplicableInspectionTypes(processCode): InspectionType[]
  // 공정에 적용 가능한 검사 유형 목록

- getLotInspectionStatus(lotNumber): Promise<LotInspectionStatus>
  // LOT의 검사 상태 (완료/대기 목록)
```

### 검증 규칙
```
┌─────────────────────────────────────────────────────────────┐
│  검사 대상 공정 제한 규칙                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CRIMP (압착검사)                                           │
│    └─ CA (자동절단압착), MC (수동압착) 공정만 대상             │
│                                                             │
│  CIRCUIT (회로검사)                                         │
│    └─ PA (제품조립) 공정만 대상                              │
│                                                             │
│  VISUAL (육안검사)                                          │
│    └─ CI (회로검사) 공정만 대상                              │
│                                                             │
│  중복 검사 방지                                              │
│    └─ 동일 LOT + 동일 검사 유형 재검사 불가                   │
│    └─ allowDuplicate=true 옵션으로 재검사 허용 가능           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 테스트 결과
```
테스트 파일: TEST/phase5_inspection.test.ts
결과: 39개 테스트 모두 통과 ✅

테스트 카테고리:
- 검사 대상 공정 규칙: 3개
- validateInspectionTarget: 8개
- checkDuplicateInspection: 4개
- canPerformInspection: 5개
- getApplicableInspectionTypes: 7개
- getAllowedProcessesForInspection: 3개
- getLotInspectionStatus: 4개
- 상수 검증: 2개
- 복합 시나리오: 3개
```

---

## Phase 6 구현 완료 기록

### 완료 일시
2025-12-21

### 구현 내용
| 항목 | 파일 | 상태 |
|------|------|------|
| Mock 서비스 신규 생성 | `src/services/mock/bundleService.mock.ts` | ✅ (신규) |
| 개별 아이템 출하 | `src/services/bundleService.ts` | ✅ |
| 전체 번들 출하 | `src/services/bundleService.ts` | ✅ |
| 개별 아이템 번들 해제 | `src/services/bundleService.ts` | ✅ |
| 전체 번들 해제 | `src/services/bundleService.ts` | ✅ |
| 출하 통계 조회 | `src/services/bundleService.ts` | ✅ |

### 추가된 타입 및 상수 (Mock)
```typescript
// bundleService.mock.ts - 번들 상태 타입
type BundleStatus = 'ACTIVE' | 'PARTIAL' | 'SHIPPED' | 'UNBUNDLED'
type BundleItemStatus = 'BUNDLED' | 'SHIPPED'

// 번들 상태 한글명
const BUNDLE_STATUS_NAMES: Record<BundleStatus, string> = {
  ACTIVE: '활성',
  PARTIAL: '일부 출하',
  SHIPPED: '출하 완료',
  UNBUNDLED: '해제됨',
}

// 아이템 상태 한글명
const BUNDLE_ITEM_STATUS_NAMES: Record<BundleItemStatus, string> = {
  BUNDLED: '번들 포함',
  SHIPPED: '출하됨',
}
```

### 추가된 함수
```typescript
// bundleService.ts - Phase 6 출하 관리
- shipBundleItem(bundleId, itemId): Promise<ShipmentResult>
  // 개별 아이템 출하

- shipEntireBundle(bundleId): Promise<ShipmentResult>
  // 번들 전체 출하

- unbundleItem(bundleId, itemId): Promise<UnbundleResult>
  // 개별 아이템 번들 해제 (원본 LOT 번호 반환)

- unbundleAll(bundleId): Promise<UnbundleResult>
  // 전체 번들 해제 (원본 LOT 번호 목록 반환)

- getBundleShippingStats(): Promise<ShippingStats>
  // 출하 통계 조회

- getShippedBundles(): Promise<BundleLotWithItems[]>
  // 출하된 번들 조회

// Mock 전용 추가 함수
- cancelItemShipment(bundleId, itemId): Promise<ShipmentResult>
  // 출하 취소 (SHIPPED → BUNDLED)

- getBundlesByStatus(status): Promise<BundleLotWithItems[]>
  // 상태별 번들 조회

- getActiveBundles(): Promise<BundleLotWithItems[]>
  // 활성 번들 조회 (ACTIVE + PARTIAL)

- getShippedItems(): Promise<MockBundleItem[]>
  // 출하된 아이템 조회
```

### 번들 상태 전이
```
┌─────────────────────────────────────────────────────────────┐
│  번들 상태 자동 전이                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIVE (활성)                                              │
│    └─ 아이템 있음, 출하된 아이템 없음                          │
│    └─ 일부 출하 → PARTIAL                                   │
│    └─ 전체 해제 → UNBUNDLED                                 │
│                                                             │
│  PARTIAL (일부 출하)                                         │
│    └─ 일부 아이템 출하됨                                      │
│    └─ 나머지 출하 → SHIPPED                                  │
│    └─ 나머지 해제 → SHIPPED (출하된 것만 남음)                 │
│    └─ 출하 취소 → ACTIVE                                     │
│                                                             │
│  SHIPPED (출하 완료)                                         │
│    └─ 모든 아이템 출하됨                                      │
│    └─ 재출하/해제 불가                                       │
│                                                             │
│  UNBUNDLED (해제됨)                                          │
│    └─ 모든 아이템 해제됨                                      │
│    └─ 빈 번들 상태                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 테스트 결과
```
테스트 파일: TEST/phase6_bundle_shipping.test.ts
결과: 38개 테스트 모두 통과 ✅

테스트 카테고리:
- 번들 생성 및 아이템 추가: 3개
- shipBundleItem (개별 아이템 출하): 5개
- shipEntireBundle (전체 번들 출하): 5개
- cancelItemShipment (출하 취소): 2개
- unbundleItem (개별 아이템 번들 해제): 4개
- unbundleAll (전체 번들 해제): 5개
- 번들 상태 자동 전이: 4개
- getBundleShippingStats (출하 통계): 2개
- 조회 기능: 3개
- 상수 검증: 2개
- 복합 시나리오: 3개
```

### 스키마 변경 안내
```
현재 Prisma 스키마에서는 BundleItem에 status 필드가 없어
개별 아이템 상태 관리가 제한됩니다.

완전한 개별 아이템 출하 관리를 위해서는:
1. BundleItem 모델에 status 필드 추가
2. BundleStatus에 PARTIAL 상태 추가

권장 스키마 변경:
```prisma
model BundleItem {
  // ... 기존 필드
  status    BundleItemStatus @default(BUNDLED)
  shippedAt DateTime?        @map("shipped_at")
}

enum BundleItemStatus {
  BUNDLED
  SHIPPED
}

enum BundleStatus {
  CREATED   // → ACTIVE로 매핑
  PARTIAL   // 신규 추가
  SHIPPED
  UNBUNDLED
}
```
```

---

## 1. 프로젝트 개요

### 1.1 목적
Python으로 구현된 Barcord 프로젝트의 검증된 비즈니스 로직을 현재 JavaScript/TypeScript MES 프로젝트에 통합

### 1.2 제약사항
- UI/UX 변경 금지 (Figma 디자인 유지)
- 기존 서비스 인터페이스 호환성 유지
- Mock 서비스 동시 업데이트 필수

### 1.3 작업 규칙
| 규칙 | 설명 |
|------|------|
| 승인 필수 | 각 Phase 구현 전 사용자 승인 필요 |
| 테스트 필수 | `/TEST` 폴더에 테스트 파일 생성 |
| 사용자 확인 | 테스트 후 직접 확인 단계 포함 |
| 문서 업데이트 | 기능별 `.md` 파일 지속 기록 |

---

## 2. 공정 정의

### 2.1 전체 공정 목록 (10개)

| 코드 | 단축 | 한국어 | 베트남어 | 설명 |
|------|------|--------|----------|------|
| MO | O | 자재불출 | Xuất vật tư | 자재 출고 |
| CA | C | 자동절단압착 | Cắt ép tự động | 와이어 절단 + 자동 압착 |
| MC | M | 수동압착 | Ép thủ công | 수동 압착 |
| MS | S | 중간스트립 | Tước giữa | 중간 피복 제거 |
| SB | B | Sub | Sub | 서브 조립 |
| HS | H | 열수축 | Co nhiệt | 열수축 튜브 |
| **SP** | P | **제품조립제공부품** | Linh kiện lắp ráp | **키팅 - PA 투입 자재 묶음** |
| PA | A | 제품조립 | Lắp ráp sản phẩm | 최종 조립 |
| CI | I | 회로검사 | Kiểm tra mạch | 전기 회로 검사 |
| VI | V | 육안검사 | Kiểm tra ngoại quan | 외관 검사 |

### 2.2 SP 공정 (제품조립제공부품) 상세

```
┌─────────────────────────────────────────────────────────────┐
│  SP 공정 = 키팅(Kitting) 작업                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  입력 1: 전공정 완료된 반조립품 바코드들                        │
│         (CA, MC, MS, SB 등에서 생성된 바코드)                  │
│                           +                                 │
│  입력 2: 조립에 필요한 자재 바코드들                           │
│         (커넥터, 터미널, 튜브 등)                              │
│                           ↓                                 │
│              SP 바코드 1개 + 전표 생성                        │
│                           ↓                                 │
│              PA 공정에서 SP 바코드 1개만 스캔                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 바코드 형식

### 3.1 기존 바코드 형식

| 형식 | 패턴 | 예시 |
|------|------|------|
| V1 레거시 | `{공정}-{YYMMDD}-{4자리}` | `CA-241220-0001` |
| V2 신규 | `{공정}{품번}Q{수량}-{단축}{YYMMDD}-{4자리}` | `CAP001Q100-C241220-0001` |
| 번들 | `{공정}{품번}Q{세트수}-{단축}{YYMMDD}-B{3자리}` | `CAP001Q4-C241220-B001` |

### 3.2 CI 바코드 신규 형식 (사용자 정의)

```
CA-{완제품품번}-{수량}-{MarkingLOT}-{4자리시퀀스}

예시: CA-P00123-100-5MT-0001
```

| 구성요소 | 설명 | 예시 |
|----------|------|------|
| 완제품품번 | 제품 코드 | P00123 |
| 수량 | 검사 수량 | 100 |
| MarkingLOT | 3자리 영숫자 | 5MT, ABC, 12A |
| 시퀀스 | 4자리 일련번호 | 0001-9999 |

---

## 4. 구현 Phase 목록

### Phase별 SuperClaude 조합표

| Phase | 작업 | 명령어 | 페르소나 | MCP | 추가 옵션 |
|-------|------|--------|---------|-----|----------|
| 1 | CI 바코드 확장 | `/implement` | `--persona-fullstack` | `--context7` | `--think-hard` |
| 2 | 2단계 생산 워크플로우 | `/implement` | `--persona-architect` | `--context7` | `--ultrathink` |
| 3 | 공정별 입력 검증 | `/implement` | `--persona-fullstack` | `--context7` | `--think-hard` |
| 4 | BOM 기반 자재 차감 | `/implement` | `--persona-performance` | `--context7` | `--ultrathink` |
| 5 | 검사 워크플로우 강화 | `/implement` | `--persona-fullstack` | `--context7` | `--think-hard` |
| 6 | 번들 출하 관리 | `/implement` | `--persona-fullstack` | `--context7` | `--think-hard` |

---

### Phase 1: CI 바코드 확장
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-fullstack --context7 --think-hard`
- **목표**: CI 공정 바코드 신규 형식 구현
- **수정 파일**:
  - `src/services/barcodeService.ts`
  - `src/services/sequenceService.ts`
  - `src/services/mock/barcodeService.mock.ts` (필요시)
- **테스트 파일**: `TEST/phase1_ci_barcode.test.ts`

### Phase 2: 2단계 생산 워크플로우
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-architect --context7 --ultrathink`
- **목표**: 시작 → 완료 분리 워크플로우 (전 공정 적용)
- **적용 공정**: MO, CA, MC, MS, SB, HS, SP, PA, CI, VI (10개 전체)
- **수정 파일**:
  - `src/services/productionService.ts`
  - `src/services/mock/productionService.mock.ts`
  - `prisma/schema.prisma` (필요시)
- **테스트 파일**: `TEST/phase2_two_step_workflow.test.ts`

### Phase 3: 공정별 입력 검증
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-fullstack --context7 --think-hard`
- **목표**: 각 공정에서 허용되는 입력 타입 검증
- **수정 파일**:
  - `src/lib/processValidation.ts` (신규)
  - `src/services/productionService.ts`
- **테스트 파일**: `TEST/phase3_input_validation.test.ts`

### Phase 4: BOM 기반 자재 차감
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-performance --context7 --ultrathink`
- **목표**: 생산 시 BOM에 따른 자동 자재 차감
- **설정**: 음수 재고 허용
- **수정 파일**:
  - `src/services/stockService.ts`
  - `src/services/bomService.ts`
- **테스트 파일**: `TEST/phase4_bom_deduction.test.ts`

### Phase 5: 검사 워크플로우 강화
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-fullstack --context7 --think-hard`
- **목표**: 공정별 검사 대상 제한 및 중복 방지
- **검증 규칙**:
  - CRIMP → CA, MC만 대상
  - CIRCUIT → PA만 대상
  - VISUAL → CI만 대상
- **수정 파일**:
  - `src/services/inspectionService.ts`
- **테스트 파일**: `TEST/phase5_inspection.test.ts`

### Phase 6: 번들 출하 관리
- **상태**: ⏳ 대기
- **SuperClaude**: `/implement --persona-fullstack --context7 --think-hard`
- **목표**: 번들 개별/일괄 출하 및 해제
- **수정 파일**:
  - `src/services/bundleService.ts`
  - `prisma/schema.prisma` (BundleItem status 추가)
- **테스트 파일**: `TEST/phase6_bundle_shipping.test.ts`

---

## 5. Phase별 상세 구현 내용

### 5.1 Phase 1: CI 바코드 확장

#### 신규 함수
```typescript
// CI 바코드 생성
generateCIBarcode(
  productCode: string,   // 완제품품번
  quantity: number,      // 수량
  markingLot: string,    // 3자리 영숫자
  sequence: number       // 4자리 시퀀스
): string

// CI 바코드 파싱
parseCIBarcode(barcode: string): CIBarcodeData | null

// CI 바코드 검증
validateCIBarcode(barcode: string): boolean
```

#### 정규식 패턴
```typescript
const CI_BARCODE_PATTERN = /^CA-([A-Z0-9]+)-(\d+)-([A-Z0-9]{3})-(\d{4})$/
```

#### 검증 항목
- [ ] CI 바코드 생성 정상 동작
- [ ] CI 바코드 파싱 정상 동작
- [ ] MarkingLOT 3자리 검증
- [ ] 시퀀스 4자리 검증
- [ ] 잘못된 형식 거부

---

### 5.2 Phase 2: 2단계 생산 워크플로우

#### 신규 함수
```typescript
// 생산 시작 (바코드 생성, LOT 생성, 자재 차감)
startProduction(input: StartProductionInput): Promise<ProductionLot>

// 생산 완료 (수량 입력, 이월 처리, 상태 변경)
completeProduction(
  lotId: number,
  completedQty: number,
  defectQty: number
): Promise<ProductionLot>

// 진행중 작업 삭제 (롤백)
deleteInProgressProduction(lotId: number): Promise<void>
```

#### 워크플로우
```
1. startProduction()
   - 바코드 생성
   - ProductionLot 생성 (status = IN_PROGRESS)
   - 투입 자재 연결 (LotMaterial)
   - 자재 재고 차감

2. 실제 생산 작업 수행

3. completeProduction()
   - 완료 수량, 불량 수량 입력
   - 잔량 계산 (계획 - 완료 - 불량)
   - 잔량 > 0이면 CarryOver 생성
   - status = COMPLETED
   - completedAt 설정

4. (선택) deleteInProgressProduction()
   - 자재 재고 복원
   - LotMaterial 삭제
   - ProductionLot 삭제
```

#### 검증 항목
- [ ] 시작 → 완료 정상 흐름
- [ ] 시작 → 삭제 롤백 정상
- [ ] 자재 차감/복원 정확성
- [ ] 이월 수량 생성 정확성
- [ ] 상태 전이 정확성

---

### 5.3 Phase 3: 공정별 입력 검증

#### 검증 규칙
```typescript
const PROCESS_INPUT_RULES: Record<ProcessCode, InputType[]> = {
  MO: ['material'],                    // 자재만
  CA: ['material'],                    // 자재만 (터미널, 와이어, 실)
  MC: ['semi_product'],                // 반제품 (CA 출력물)
  MS: ['semi_product'],                // 반제품 (CA 출력물)
  SB: ['material', 'semi_product'],    // 자재 + 반제품
  HS: ['semi_product'],                // 반제품
  SP: ['material', 'semi_product'],    // 자재 + 반제품 (키팅)
  PA: ['semi_product'],                // 반제품 (SP 바코드)
  CI: ['production'],                  // 생산 LOT (PA 바코드)
  VI: ['production']                   // 생산 LOT (CI 바코드)
}
```

#### 신규 함수
```typescript
// 입력 타입 검증
validateProcessInput(
  processCode: string,
  inputBarcode: string
): { valid: boolean; inputType: InputType; error?: string }
```

#### 검증 항목
- [ ] 각 공정별 올바른 입력 허용
- [ ] 잘못된 입력 타입 거부
- [ ] 에러 메시지 정확성

---

### 5.4 Phase 4: BOM 기반 자재 차감

#### 신규 함수
```typescript
// BOM 기반 자재 차감
deductByBOM(
  productId: number,
  processCode: string,
  quantity: number,
  inputMaterials: MaterialInput[],
  allowNegative: boolean = true  // 음수 허용 (확정)
): Promise<DeductionResult>

// BOM 소요량 조회
getBOMRequirements(
  productId: number,
  processCode: string
): Promise<BOMRequirement[]>
```

#### 차감 로직
```
1. BOM에서 해당 제품/공정의 소요 자재 조회
2. 각 자재별 필요량 = BOM 소요량 × 생산 수량
3. 스캔된 자재 LOT에서 FIFO로 차감
4. 음수 재고 허용 (설정에 따라)
5. 차감 결과 반환
```

#### 검증 항목
- [ ] BOM 소요량 정확히 계산
- [ ] FIFO 차감 정상 동작
- [ ] 음수 재고 허용 시 정상 진행
- [ ] 차감 이력 정확히 기록

---

### 5.5 Phase 5: 검사 워크플로우 강화

#### 검증 규칙
```typescript
const INSPECTION_TARGET_PROCESS: Record<InspectionType, ProcessCode[]> = {
  CRIMP: ['CA', 'MC'],   // 압착 검사 → CA, MC만
  CIRCUIT: ['PA'],       // 회로 검사 → PA만
  VISUAL: ['CI']         // 육안 검사 → CI만
}
```

#### 신규 함수
```typescript
// 검사 대상 검증
validateInspectionTarget(
  inspectionType: InspectionType,
  lotNumber: string
): Promise<{ valid: boolean; error?: string }>

// 검사 중복 체크
checkDuplicateInspection(
  lotNumber: string,
  inspectionType: InspectionType
): Promise<boolean>
```

#### 검증 항목
- [ ] CRIMP 검사 → CA, MC LOT만 허용
- [ ] CIRCUIT 검사 → PA LOT만 허용
- [ ] VISUAL 검사 → CI LOT만 허용
- [ ] 중복 검사 거부
- [ ] 이미 검사된 LOT 재검사 방지

---

### 5.6 Phase 6: 번들 출하 관리

#### 번들 상태
```typescript
enum BundleItemStatus {
  BUNDLED = 'bundled',   // 번들에 포함됨
  SHIPPED = 'shipped'    // 출하됨
}

enum BundleStatus {
  ACTIVE = 'active',     // 전체 보유
  PARTIAL = 'partial',   // 일부 출하
  SHIPPED = 'shipped'    // 전체 출하
}
```

#### 신규 함수
```typescript
// 개별 아이템 출하
shipBundleItem(bundleId: number, itemId: number): Promise<void>

// 전체 번들 출하
shipEntireBundle(bundleId: number): Promise<void>

// 개별 아이템 번들 해제
unbundleItem(bundleId: number, itemId: number): Promise<string>

// 전체 번들 해제
unbundleAll(bundleId: number): Promise<string[]>
```

#### 스키마 변경
```prisma
// BundleItem에 status 추가
model BundleItem {
  // ... 기존 필드
  status    BundleItemStatus @default(BUNDLED)
}
```

#### 검증 항목
- [ ] 개별 아이템 출하 정상
- [ ] 전체 번들 출하 정상
- [ ] 번들 상태 자동 전이 (ACTIVE → PARTIAL → SHIPPED)
- [ ] 개별 해제 후 CA LOT 복원
- [ ] 전체 해제 후 번들 삭제

---

## 6. 사용자 확정 사항

| # | 항목 | 결정 |
|---|------|------|
| 1 | CI 바코드 형식 | `CA-{완제품품번}-{수량}-{MarkingLOT 3자리}-{4자리}` |
| 2 | 2단계 워크플로우 | **전 공정** 적용 (10개 모두) |
| 3 | BOM 음수 재고 | **허용** |
| 4 | SP 공정 정의 | 반조립품 + 자재 → 키팅 → PA 투입 |
| 5 | 진행 순서 | Phase 1 → 2 → 3 → 4 → 5 → 6 순차 |

---

## 7. 진행 이력

| 날짜 | Phase | 상태 | 비고 |
|------|-------|------|------|
| 2025-12-21 | 계획 수립 | ✅ 완료 | 초기 계획서 작성 |
| 2025-12-21 | Phase 1 | ✅ 완료 | CI 바코드 확장 (23개 테스트) |
| 2025-12-21 | Phase 2 | ✅ 완료 | 2단계 생산 워크플로우 (19개 테스트) |
| 2025-12-21 | Phase 3 | ✅ 완료 | 공정별 입력 검증 (46개 테스트) |
| 2025-12-21 | Phase 4 | ✅ 완료 | BOM 기반 자재 차감 (18개 테스트) |
| 2025-12-21 | Phase 5 | ✅ 완료 | 검사 워크플로우 강화 (39개 테스트) |
| 2025-12-21 | Phase 6 | ✅ 완료 | 번들 출하 관리 (38개 테스트) |

---

## 8. 파일 구조

```
vietnam-mes-simple/
├── docs/
│   └── IMPLEMENTATION_PLAN.md    # 이 파일
├── TEST/
│   ├── phase1_ci_barcode.test.ts
│   ├── phase2_two_step_workflow.test.ts
│   ├── phase3_input_validation.test.ts
│   ├── phase4_bom_deduction.test.ts
│   ├── phase5_inspection.test.ts
│   └── phase6_bundle_shipping.test.ts
└── src/
    ├── lib/
    │   └── processValidation.ts   # Phase 3에서 생성
    └── services/
        ├── barcodeService.ts      # Phase 1
        ├── sequenceService.ts     # Phase 1
        ├── productionService.ts   # Phase 2
        ├── stockService.ts        # Phase 4
        ├── bomService.ts          # Phase 4
        ├── inspectionService.ts   # Phase 5
        └── bundleService.ts       # Phase 6
```

---

## 9. 다음 단계

**Phase 1 (CI 바코드) 구현을 승인해 주시면 작업을 시작하겠습니다.**

승인 시 진행 순서:
1. `barcodeService.ts` 수정
2. `sequenceService.ts` 수정 (필요시)
3. `TEST/phase1_ci_barcode.test.ts` 생성
4. 테스트 실행 및 결과 보고
5. 사용자 확인
6. 이 문서 업데이트
