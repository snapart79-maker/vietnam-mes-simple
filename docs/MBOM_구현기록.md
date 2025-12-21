# MBOM 시스템 구현 기록

> 시작일: 2025-12-21
> 기반 문서: `docs/MBOM_구현계획.md`

---

## 진행 상태 요약

| 단계 | 내용 | 상태 | 완료일 |
|------|------|------|--------|
| 1단계 | DB 스키마 확장 | ✅ 완료 | 2025-12-21 |
| 2단계 | 공정 마스터 서비스 | ✅ 완료 | 2025-12-21 |
| 3단계 | 반제품 품번 체계 | ✅ 완료 | 2025-12-21 |
| 4단계 | MBOM 서비스 확장 | ✅ 완료 | 2025-12-21 |
| 5단계 | 공정 라우팅 서비스 | ✅ 완료 | 2025-12-21 |
| 6단계 | 번들/SET 바코드 개선 | ✅ 완료 | 2025-12-21 |
| 7단계 | UI 컴포넌트 구현 | ✅ 완료 (승인 대기) | 2025-12-21 |

---

## 단계별 기록

### 1단계 완료: DB 스키마 확장

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: backend-architect
- **플래그**: --ultrathink, --context7

#### 구현 내용
1. **ProductType enum 확장**
   - `SEMI_MS` (중간스트립)
   - `SEMI_SB` (서브조립)
   - `SEMI_HS` (열수축)

2. **Product 모델 필드 추가**
   - `parentCode`: 완제품 품번 (반제품용)
   - `circuitNo`: 회로번호 (절압품용)
   - `bundleQty`: 기본 묶음 수량 (default: 100)
   - `processRoutings`: ProcessRouting 관계

3. **Process 모델 신규 생성**
   - `code`: 공정 코드 (CA, MC, MS 등)
   - `name`: 공정명
   - `seq`: 공정 순서
   - `hasMaterialInput`: 자재 투입 여부
   - `isInspection`: 검사 공정 여부
   - `shortCode`: 단축 코드

4. **ProcessRouting 모델 신규 생성**
   - `productId` + `processCode` 복합 유니크
   - `seq`: 제품 내 공정 순서
   - `isRequired`: 필수 공정 여부
   - Cascade Delete 설정

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `prisma/schema.prisma` | ProductType 확장, Product 필드 추가, Process/ProcessRouting 모델 추가 |
| `prisma/migrations/20251221055338_add_mbom_models/` | 마이그레이션 생성 |
| `vitest.config.ts` | 신규 생성 (테스트 설정) |
| `TEST/stage1/schema.test.ts` | 신규 생성 |
| `TEST/stage1/migration.test.ts` | 신규 생성 |
| `TEST/stage1/model-relations.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage1/
├── schema.test.ts           ✅ 5 tests passed
├── migration.test.ts        ✅ 6 tests passed
└── model-relations.test.ts  ✅ 5 tests passed

Total: 16 tests passed
```

#### 특이사항
- Process 모델의 `code` 필드가 VarChar(10)으로 제한되어 테스트 코드에서 짧은 코드 사용 필요
- vitest 패키지 신규 설치 (@vitest/ui 포함)

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 2단계 진행 승인

---

### 2단계 완료: 공정 마스터 서비스

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: backend-architect
- **플래그**: --think-hard, --context7

#### 구현 내용
1. **ProcessService 구현**
   - CRUD 함수: `createProcess`, `getProcessById`, `getProcessByCode`, `updateProcess`, `deleteProcess`, `hardDeleteProcess`
   - 조회 함수: `getAllProcesses`, `getMaterialInputProcesses`, `getInspectionProcesses`
   - 순서 함수: `getProcessSequence`, `getNextProcessBySeq`, `getPreviousProcessBySeq`, `getProcessSeq`
   - 검증 함수: `isValidProcessCode`, `getProcessByShortCode`
   - 유틸리티: `getShortCodeFromProcess`, `getProcessCodeFromShort`
   - Seed 함수: `seedProcesses`, `hasProcesses`, `countProcesses`

2. **10개 공정 Seed 데이터**
   | 코드 | 공정명 | seq | 자재투입 | 검사 | 단축코드 |
   |------|--------|-----|---------|------|---------|
   | CA | 자동절단압착 | 10 | O | X | C |
   | MS | 중간스트립 | 20 | X | X | S |
   | MC | 수동압착 | 30 | O | X | M |
   | SB | 서브조립 | 40 | O | X | B |
   | HS | 열수축 | 50 | X | X | H |
   | CQ | 압착검사 | 60 | X | O | Q |
   | SP | 제품조립제공부품 | 70 | O | X | P |
   | PA | 제품조립 | 80 | O | X | A |
   | CI | 회로검사 | 90 | X | O | I |
   | VI | 육안검사 | 100 | X | O | V |

3. **prisma/seed.ts 업데이트**
   - 공정 마스터 Seed 코드 추가

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `src/services/processService.ts` | 신규 생성 |
| `src/services/index.ts` | Export 추가 |
| `prisma/seed.ts` | 공정 Seed 추가 |
| `TEST/stage2/processService.test.ts` | 신규 생성 |
| `TEST/stage2/processSeed.test.ts` | 신규 생성 |
| `TEST/stage2/processOrder.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage2/
├── processService.test.ts  ✅ 15 tests passed
├── processSeed.test.ts     ✅ 14 tests passed
└── processOrder.test.ts    ✅ 25 tests passed

Total: 54 tests passed
```

#### 특이사항
- 테스트 데이터 간섭 문제로 일부 테스트 조건 수정 (원본 공정 코드만 검증하도록)

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 3단계 진행 승인

---

### 3단계 완료: 반제품 품번 체계 서비스

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: backend-architect
- **플래그**: --think-hard, --context7

#### 구현 내용
1. **품번 생성 규칙 함수**
   - `generateCrimpCode(finishedCode, circuitNo)`: 절압품 코드 생성 (00315452-001)
   - `generateMSCode(crimpCode)`: MS 반제품 코드 생성 (MS00315452-001)
   - `generateSemiCode(processCode, finishedCode)`: MC/SB/HS 반제품 코드 생성

2. **품번 추론/추출 함수**
   - `inferProductType(code)`: 품번에서 제품 타입 추론
   - `extractFinishedCode(code)`: 품번에서 완제품 코드 추출
   - `extractCircuitNo(crimpCode)`: 절압품 코드에서 회로번호 추출
   - `isValidProductCode(code)`: 품번 유효성 검증
   - `isValidCircuitRange(circuitNo)`: 회로번호 범위 검증

3. **제품 생성 함수**
   - `generateCrimpProducts(finishedCode, circuitCount)`: 절압품 일괄 생성
   - `createMSProduct(crimpCode)`: MS 반제품 생성
   - `createSemiProduct(processCode, finishedCode)`: MC/SB/HS 반제품 생성
   - `createProductHierarchy(finishedCode, circuitCount, processPattern)`: 전체 계층 구조 생성

4. **조회 함수**
   - `getCrimpProductsByFinished(finishedCode)`: 완제품의 절압품 조회
   - `getSemiProductsByFinished(finishedCode)`: 완제품의 모든 반제품 조회
   - `countSemiProducts(finishedCode)`: 반제품 수 조회

#### 품번 체계
| 유형 | 형식 | 예시 |
|------|------|------|
| 완제품 | [품번] | 00315452 |
| 절압품(CA) | [품번]-[회로번호] | 00315452-001 |
| MS 반제품 | MS[절압품번] | MS00315452-001 |
| MC 반제품 | MC[품번] | MC00315452 |
| SB 반제품 | SB[품번] | SB00315452 |
| HS 반제품 | HS[품번] | HS00315452 |

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `src/services/semiProductService.ts` | 신규 생성 |
| `src/services/index.ts` | Export 추가 |
| `TEST/stage3/semiProductCode.test.ts` | 신규 생성 |
| `TEST/stage3/codeInference.test.ts` | 신규 생성 |
| `TEST/stage3/crimpProducts.test.ts` | 신규 생성 |
| `TEST/stage3/productHierarchy.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage3/
├── semiProductCode.test.ts    ✅ 9 tests passed
├── codeInference.test.ts      ✅ 23 tests passed
├── crimpProducts.test.ts      ✅ 15 tests passed
└── productHierarchy.test.ts   ✅ 7 tests passed

Total: 54 tests passed
```

#### 특이사항
- 절압품(CA)은 회로수만큼 생성되고, MS 반제품은 절압품 각각에 대해 생성됨
- MC/SB/HS 반제품은 완제품당 1개씩 생성됨

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 4단계 진행 승인

---

### 4단계 완료: MBOM 서비스 확장

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: backend-architect
- **플래그**: --ultrathink, --context7

#### 구현 내용
1. **MBOM CRUD 기능**
   - `createMBOMEntry(input)`: BOM 항목 생성 (자재/반제품)
   - `updateMBOMEntry(id, input)`: BOM 항목 수정
   - `deleteMBOMEntry(id)`: BOM 항목 삭제
   - `getMBOMByProduct(productId)`: 제품별 BOM 조회
   - `getMBOMByProcess(productId, processCode)`: 공정별 BOM 조회
   - `hasMBOM(productId)`: BOM 존재 여부 확인
   - `clearProductMBOM(productId)`: 제품 BOM 전체 삭제

2. **MBOM 트리 구조**
   - `getMBOMTree(productId)`: 공정 순서대로 정렬된 트리 구조 반환
   - `getMBOMSummaryByProcess(productId)`: 공정별 BOM 요약 (자재/반제품 수)
   - `getMBOMCountByProcess(productId)`: 공정별 카운트 맵

3. **자재 소요량 계산**
   - `calculateProcessMaterialRequirements(productId, processCode, qty)`: 공정별 자재 소요량
   - `calculateTotalMaterialRequirements(productId, qty)`: 전체 자재 소요량 (공정 통합)

4. **반제품 소요량 계산**
   - `calculateSemiProductRequirements(productId, processCode, qty)`: 전공정품 소요량 계산

5. **일괄 작업**
   - `addMaterialsToProcess(productId, processCode, materials)`: 자재 일괄 추가
   - `clearProcessMaterials(productId, processCode)`: 공정별 자재 삭제
   - `copyMBOM(sourceProductId, targetProductId)`: BOM 복사

6. **검증 함수**
   - `canAddMaterialToProcess(processCode)`: 자재 투입 가능 공정 확인

#### 핵심 로직
| 기능 | 설명 |
|------|------|
| 공정 순서 정렬 | Process.seq 기준 트리 노드 정렬 |
| 자재 투입 검증 | Process.hasMaterialInput 확인 |
| 동일 자재 합산 | 여러 공정의 동일 자재 소요량 통합 |
| 반제품 추적 | inputSemiId로 전공정품 참조 |

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `src/services/mbomService.ts` | 신규 생성 (20+ 함수) |
| `src/services/index.ts` | Export 추가 |
| `TEST/stage4/mbomCrud.test.ts` | 신규 생성 |
| `TEST/stage4/mbomTree.test.ts` | 신규 생성 |
| `TEST/stage4/materialRequirements.test.ts` | 신규 생성 |
| `TEST/stage4/semiProductFlow.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage4/
├── mbomCrud.test.ts              ✅ 12 tests passed
├── mbomTree.test.ts              ✅ 6 tests passed
├── materialRequirements.test.ts  ✅ 7 tests passed
└── semiProductFlow.test.ts       ✅ 10 tests passed

Total: 35 tests passed
```

#### 특이사항
- MBOM 트리는 Process.seq 순서로 정렬되어 공정 흐름에 따라 표시
- 동일 자재가 여러 공정에서 사용될 경우 calculateTotalMaterialRequirements에서 합산
- canAddMaterialToProcess는 검사 공정(CQ, CI, VI) 및 자재투입 불가 공정(MS, HS) 제외

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 5단계 진행 승인

---

### 5단계 완료: 공정 라우팅 서비스

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: backend-architect
- **플래그**: --think-hard, --context7

#### 구현 내용
1. **CRUD 기능**
   - `createRoutingEntry(input)`: 단일 라우팅 엔트리 생성
   - `createProcessRouting(productId, processCodes)`: 일괄 라우팅 생성
   - `getProcessRouting(productId)`: 라우팅 조회
   - `updateRoutingEntry(id, input)`: 엔트리 수정
   - `deleteRoutingEntry(id)`: 엔트리 삭제
   - `clearProcessRouting(productId)`: 전체 삭제
   - `copyRouting(sourceId, targetId)`: 라우팅 복사

2. **패턴 기반 생성**
   - `createRoutingFromPattern(productId, patternName)`: 패턴으로 라우팅 생성
   - `getPatternName(processCodes)`: 패턴명 식별
   - `getAvailablePatterns()`: 사용 가능한 패턴 목록

3. **공정 네비게이션**
   - `getNextProcess(productId, currentCode)`: 다음 공정 조회
   - `getPreviousProcess(productId, currentCode)`: 이전 공정 조회
   - `getFirstProcess(productId)`: 첫 공정 조회
   - `getLastProcess(productId)`: 마지막 공정 조회
   - `isProcessInRouting(productId, processCode)`: 라우팅 포함 여부
   - `getProcessSeqInRouting(productId, processCode)`: 순서 조회

4. **검증 기능**
   - `validateProcessOrder(productId, from, to)`: 공정 순서 검증
   - `validateRouting(productId)`: 전체 라우팅 검증
   - `validateProcessCodes(codes)`: 공정 코드 배열 검증

5. **조회 기능**
   - `getRequiredProcesses(productId)`: 필수 공정만 조회
   - `getMaterialInputRoutings(productId)`: 자재투입 공정 조회
   - `getInspectionRoutings(productId)`: 검사 공정 조회

#### 공정 패턴
| 패턴 | 공정 수 | 구성 |
|------|---------|------|
| simple | 5 | CA → SP → PA → CI → VI |
| medium | 8 | CA → SB → MC → CQ → SP → PA → CI → VI |
| complex | 10 | CA → MS → MC → SB → HS → CQ → SP → PA → CI → VI |

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `src/services/processRoutingService.ts` | 신규 생성 (25+ 함수) |
| `src/services/index.ts` | Export 추가 |
| `TEST/stage5/routingCrud.test.ts` | 신규 생성 |
| `TEST/stage5/routingPattern.test.ts` | 신규 생성 |
| `TEST/stage5/processNavigation.test.ts` | 신규 생성 |
| `TEST/stage5/routingValidation.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage5/
├── routingCrud.test.ts          ✅ 20 tests passed
├── routingPattern.test.ts       ✅ 18 tests passed
├── processNavigation.test.ts    ✅ 25 tests passed
└── routingValidation.test.ts    ✅ 23 tests passed

Total: 86 tests passed
```

#### 특이사항
- 라우팅 생성 시 기존 라우팅을 자동으로 삭제 후 재생성
- validateRouting은 시작 공정(CA/MC)과 검사 공정 종료를 검증
- 패턴 복사 기능으로 제품 간 라우팅 템플릿 공유 가능

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 6단계 진행 승인

---

### 6단계 완료: 번들/SET 바코드 개선

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: Prisma, Vitest
- **페르소나**: fullstack
- **플래그**: --think-hard, --context7

#### 구현 내용
1. **스키마 확장**
   - `BundleType` enum 추가 (SAME_PRODUCT, MULTI_PRODUCT)
   - `BundleLot.bundleType` 필드 추가

2. **SET 번들 생성**
   - `createSetBundle(items)`: 다른 품번 묶음 번들 생성
   - 자동 번들 타입 결정 (동일 품번/다른 품번)
   - SET 바코드 포맷 적용

3. **번들 타입 관리**
   - `determineBundleType(bundleId)`: 아이템 기반 타입 판별
   - `getBundleTypeById(bundleId)`: 저장된 타입 조회
   - `updateBundleType(bundleId)`: 타입 재계산 및 업데이트

4. **SET 정보 포맷**
   - `formatSetInfo(bundleId)`: SET 정보 문자열 생성
   - SAME_PRODUCT: "품번코드 × 총수량 (개수개)"
   - MULTI_PRODUCT: "SET × 총수량 (품번수품번)"
   - `getProductsInBundle(bundleId)`: 품번별 집계 조회

5. **번들 검색**
   - `getBundleDetails(bundleNo)`: 상세 조회 (SetBundle 형식)
   - `findItemInBundle(bundleNo, productCode)`: 품번 검색
   - `getMultiProductBundles()`: MULTI_PRODUCT 번들만 조회

6. **통계 기능**
   - `getSetBundleStats()`: 번들 타입별 통계

#### 번들 타입
| 타입 | 설명 | 바코드 예시 |
|------|------|------------|
| SAME_PRODUCT | 동일 품번 묶음 | CAP001Q4-C241221-B001 |
| MULTI_PRODUCT | 다른 품번 묶음 (SET) | CASETQ4-C241221-B001 |

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `prisma/schema.prisma` | BundleType enum, BundleLot.bundleType 추가 |
| `prisma/migrations/20251221083624_add_bundle_type/` | 마이그레이션 |
| `src/services/bundleService.ts` | SET 번들 기능 추가 (10+ 함수) |
| `TEST/stage6/setBundle.test.ts` | 신규 생성 |
| `TEST/stage6/bundleType.test.ts` | 신규 생성 |
| `TEST/stage6/bundleFormat.test.ts` | 신규 생성 |
| `TEST/stage6/bundleSearch.test.ts` | 신규 생성 |

#### 테스트 결과
```
TEST/stage6/
├── setBundle.test.ts      ✅ 11 tests passed
├── bundleType.test.ts     ✅ 6 tests passed
├── bundleFormat.test.ts   ✅ 7 tests passed
└── bundleSearch.test.ts   ✅ 13 tests passed

Total: 37 tests passed
```

#### 특이사항
- 테스트 병렬 실행 시 시퀀스 카운터 충돌 발생 → `--no-file-parallelism` 옵션으로 해결
- BundleLotWithItems 인터페이스에 bundleType 필드 추가로 기존 코드 호환성 유지
- SET 번들은 첫 번째 LOT의 품번을 기준으로 productId 설정

#### 사용자 승인
- **승인일**: 2025-12-21
- **승인자**: 사용자
- **비고**: 7단계 진행 승인

---

### 7단계 완료: UI 컴포넌트 구현

#### 기본 정보
- **완료일**: 2025-12-21
- **사용 도구**: React, Radix UI, Tailwind CSS
- **페르소나**: fullstack
- **플래그**: --magic, --context7

#### 구현 내용
1. **MBOMTreeView 컴포넌트**
   - 공정 순서대로 MBOM 트리 구조 표시
   - 노드 펼침/접기 기능 (Collapsible)
   - 공정별 자재/반제품 목록 표시
   - 검색 기능 (공정, 자재, 반제품)
   - 편집 모드 (자재 추가/삭제)
   - 노드 선택 콜백

2. **ProcessRoutingEditor 컴포넌트**
   - 드래그 앤 드롭 공정 순서 변경
   - 공정 추가/삭제
   - 공정 패턴 템플릿 선택 (simple/medium/complex)
   - 필수/선택 공정 토글
   - 변경 사항 추적 및 저장
   - 검증 에러 표시
   - 초기화 확인 다이얼로그

3. **컴포넌트 Features**
   | 컴포넌트 | 기능 |
   |----------|------|
   | MBOMTreeView | 트리 표시, 펼침/접기, 검색, 선택, 편집 |
   | ProcessRoutingEditor | 드래그앤드롭, 패턴 선택, 필수 토글, 저장 |

4. **Props 인터페이스**
   ```typescript
   // MBOMTreeView
   interface MBOMTreeViewProps {
     productId: number
     data?: MBOMTreeNode[]
     onNodeSelect?: (node: MBOMTreeNode) => void
     onMaterialClick?: (material, processCode) => void
     onAddMaterial?: (processCode: string) => void
     onDeleteMaterial?: (materialId: number, processCode: string) => void
     editable?: boolean
     loading?: boolean
   }

   // ProcessRoutingEditor
   interface ProcessRoutingEditorProps {
     productId: number
     routing?: ProcessRoutingItem[]
     availableProcesses?: Process[]
     patterns?: PatternDef[]
     onSave?: (routing: ProcessRoutingItem[]) => Promise<void>
     onValidate?: (routing: ProcessRoutingItem[]) => Promise<ValidationResult>
     loading?: boolean
   }
   ```

#### 수정된 파일
| 파일 | 작업 |
|------|------|
| `src/app/components/mbom/MBOMTreeView.tsx` | 신규 생성 |
| `src/app/components/mbom/ProcessRoutingEditor.tsx` | 신규 생성 |
| `src/app/components/mbom/index.ts` | 신규 생성 (Export) |

#### 테스트 결과
```
타입 체크: ✅ 에러 없음 (MBOM 컴포넌트 관련)
```

#### 특이사항
- 기존 UI 컴포넌트 패턴(Radix UI, Tailwind CSS)을 그대로 활용
- cn() 유틸리티로 조건부 className 조합
- Collapsible 컴포넌트 활용하여 트리 펼침/접기 구현
- HTML5 드래그앤드롭 API로 공정 순서 변경 구현
- 편집 모드와 뷰 모드 분리로 권한 기반 사용 가능

#### 사용자 승인
- **승인일**: (대기 중)
- **승인자**: -
- **비고**: -

---

<!-- 각 단계 완료 시 아래 템플릿 복사하여 사용 -->

<!--
## 단계 N 완료

### 기본 정보
- **완료일**: YYYY-MM-DD
- **소요 시간**: X시간

### 구현 내용
- 항목 1
- 항목 2

### 수정된 파일
| 파일 | 작업 |
|------|------|
| `path/to/file.ts` | 신규 생성 / 수정 |

### 테스트 결과
```
TEST/stageN/
├── test1.test.ts    ✅ 통과
├── test2.test.ts    ✅ 통과
└── test3.test.ts    ✅ 통과
```

### 특이사항
- 없음 / 특이사항 내용

### 사용자 승인
- **승인일**: YYYY-MM-DD
- **승인자**: 사용자
- **비고**: 승인 코멘트
-->

---

## 이슈 및 해결

<!-- 발생한 이슈와 해결 방법 기록 -->

| 단계 | 이슈 | 해결 방법 | 날짜 |
|------|------|----------|------|
| 1단계 | Process.code VarChar(10) 제한으로 테스트 코드 길이 초과 | Date.now() 대신 짧은 타임스탬프 사용 | 2025-12-21 |

---

## 학습 및 개선점

<!-- 구현 과정에서 배운 점이나 향후 개선이 필요한 사항 -->

| 단계 | 항목 | 설명 |
|------|------|------|
| - | - | - |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-21 | 기록 파일 생성 |
| 2025-12-21 | 1단계 완료: DB 스키마 확장 (Process, ProcessRouting 모델, Product 확장) |
| 2025-12-21 | 2단계 완료: 공정 마스터 서비스 (ProcessService CRUD + Seed 10개 공정) |
| 2025-12-21 | 3단계 완료: 반제품 품번 체계 서비스 (SemiProductService 품번 생성 규칙) |
| 2025-12-21 | 4단계 완료: MBOM 서비스 확장 (트리 구조, 소요량 계산, 일괄 작업) |
| 2025-12-21 | 5단계 완료: 공정 라우팅 서비스 (패턴 기반 생성, 네비게이션, 검증) |
| 2025-12-21 | 6단계 완료: 번들/SET 바코드 개선 (BundleType enum, SET 번들 CRUD, 포맷/검색) |
| 2025-12-21 | 7단계 완료: UI 컴포넌트 구현 (MBOMTreeView, ProcessRoutingEditor) |
