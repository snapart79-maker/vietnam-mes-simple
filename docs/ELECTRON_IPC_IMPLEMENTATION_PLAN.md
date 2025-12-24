# Electron IPC 연동 실행 계획서

> **작성일**: 2025-12-24
> **목적**: Mock 서비스 → 실제 Prisma 서비스 연동
> **제약**: UI/UX 변경 없음, 기존 백엔드 로직 수정 없음

---

## 1. 개요

### 1.1 현재 문제점

```
[현재]
React Context → 직접 import → Mock Service (localStorage)
                              ↓
                        DB 연동 안됨!

[목표]
React Context → electronAPI → Preload → IPC → Main Process → Real Service → Prisma → PostgreSQL
```

### 1.2 수정 범위

| 구분 | 파일 | 작업 |
|------|------|------|
| Electron Main | `electron/main.ts` | IPC 핸들러 추가 |
| Preload | `electron/preload.ts` | API 노출 확장 |
| 타입 정의 | `src/lib/electronBridge.ts` | 비즈니스 API 타입 |
| Context | `src/app/context/*.tsx` | electronAPI 호출로 변경 |

### 1.3 수정하지 않는 파일

- `src/services/*.ts` - 실제 서비스 (그대로 사용)
- `src/services/mock/*.ts` - Mock 서비스 (브라우저 모드용 유지)
- `src/app/pages/*.tsx` - UI 컴포넌트
- `src/app/components/**/*.tsx` - UI 컴포넌트

---

## 2. 단계별 실행 계획

### Phase 1: Electron Main IPC 핸들러 (우선순위: 1)

**파일**: `electron/main.ts`

#### 1.1 서비스 Import 추가

```typescript
// === 서비스 Import ===
import * as productionService from '../src/services/productionService'
import * as stockService from '../src/services/stockService'
import * as bomService from '../src/services/bomService'
import * as materialService from '../src/services/materialService'
import * as lotTraceService from '../src/services/lotTraceService'
import * as inspectionService from '../src/services/inspectionService'
import * as lineService from '../src/services/lineService'
import * as sequenceService from '../src/services/sequenceService'
```

#### 1.2 IPC 핸들러 등록 (카테고리별)

**Production API (10개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `production:createLot` | `createLot(input)` | LOT 생성 |
| `production:startProduction` | `startProduction(lotId, lineCode, workerId)` | 작업 시작 |
| `production:completeProduction` | `completeProduction(input)` | 작업 완료 |
| `production:addMaterial` | `addMaterial(input)` | 자재 투입 |
| `production:removeMaterial` | `removeMaterial(lotMaterialId)` | 자재 투입 취소 |
| `production:getLotById` | `getLotById(id)` | LOT ID 조회 |
| `production:getLotByNumber` | `getLotByNumber(lotNumber)` | LOT 번호 조회 |
| `production:getLotsByProcess` | `getLotsByProcess(processCode, options)` | 공정별 조회 |
| `production:getLotsByStatus` | `getLotsByStatus(status, options)` | 상태별 조회 |
| `production:updateLotQuantity` | `updateLotQuantity(lotId, updates)` | 수량 업데이트 |

**Stock API (8개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `stock:receiveStock` | `receiveStock(input)` | 자재 입고 |
| `stock:consumeStock` | `consumeStock(input)` | 자재 출고 |
| `stock:deductByBOM` | `deductByBOM(productId, qty, lotId)` | **BOM 기반 재고 차감** |
| `stock:getStockByMaterial` | `getStockByMaterial(materialId)` | 자재별 재고 |
| `stock:getStockSummary` | `getStockSummary()` | 재고 현황 요약 |
| `stock:getLowStockItems` | `getLowStockItems()` | 부족 재고 목록 |
| `stock:registerProcessStock` | `registerProcessStock(input)` | 공정 재고 등록 |
| `stock:consumeProcessStock` | `consumeProcessStock(processCode, materialId, qty)` | 공정 재고 차감 |

**BOM API (4개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `bom:calculateRequirements` | `calculateRequiredMaterials(productId, qty)` | 소요량 계산 |
| `bom:getBOMByProduct` | `getBOMByProduct(productId)` | 제품 BOM 조회 |
| `bom:createBOM` | `createBOM(input)` | BOM 생성 |
| `bom:updateBOM` | `updateBOM(bomId, input)` | BOM 수정 |

**Material API (5개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `material:getAll` | `getAllMaterials()` | 전체 자재 목록 |
| `material:getById` | `getMaterialById(id)` | 자재 상세 |
| `material:create` | `createMaterial(input)` | 자재 생성 |
| `material:update` | `updateMaterial(id, input)` | 자재 수정 |
| `material:delete` | `deleteMaterial(id)` | 자재 삭제 |

**LotTrace API (3개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `lot:getTrace` | `getFullTrace(lotNumber)` | LOT 추적 |
| `lot:getForwardTrace` | `getForwardTrace(lotNumber)` | 정방향 추적 |
| `lot:getBackwardTrace` | `getBackwardTrace(lotNumber)` | 역방향 추적 |

**기타 API (5개)**

| 채널 | 서비스 함수 | 설명 |
|------|-------------|------|
| `inspection:create` | `createInspection(input)` | 검사 등록 |
| `inspection:getByLot` | `getInspectionsByLot(lotId)` | LOT 검사 조회 |
| `line:getAll` | `getAllLines()` | 라인 목록 |
| `line:getByProcess` | `getLinesByProcess(processCode)` | 공정별 라인 |
| `sequence:getNext` | `getNextSequence(prefix)` | 다음 일련번호 |

**총 35개 IPC 핸들러**

#### 1.3 핸들러 구현 패턴

```typescript
// 표준 패턴: try-catch + 결과 반환
ipcMain.handle('production:createLot', async (_event, input) => {
  try {
    const result = await productionService.createLot(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:createLot error:', error)
    return { success: false, error: String(error) }
  }
})

// 간단 패턴: 직접 반환 (에러는 프론트엔드에서 처리)
ipcMain.handle('material:getAll', async () => {
  return materialService.getAllMaterials()
})
```

---

### Phase 2: Preload Script 확장 (우선순위: 1)

**파일**: `electron/preload.ts`

#### 2.1 네임스페이스 구조

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // 기존 API (유지)
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printPDF: (options) => ipcRenderer.invoke('print-pdf', options),
  // ...

  // === 신규 비즈니스 API ===

  // Production 네임스페이스
  production: {
    createLot: (input) => ipcRenderer.invoke('production:createLot', input),
    startProduction: (lotId, lineCode, workerId) =>
      ipcRenderer.invoke('production:startProduction', lotId, lineCode, workerId),
    completeProduction: (input) =>
      ipcRenderer.invoke('production:completeProduction', input),
    addMaterial: (input) =>
      ipcRenderer.invoke('production:addMaterial', input),
    removeMaterial: (lotMaterialId) =>
      ipcRenderer.invoke('production:removeMaterial', lotMaterialId),
    getLotById: (id) =>
      ipcRenderer.invoke('production:getLotById', id),
    getLotByNumber: (lotNumber) =>
      ipcRenderer.invoke('production:getLotByNumber', lotNumber),
    getLotsByProcess: (processCode, options) =>
      ipcRenderer.invoke('production:getLotsByProcess', processCode, options),
    getLotsByStatus: (status, options) =>
      ipcRenderer.invoke('production:getLotsByStatus', status, options),
    updateLotQuantity: (lotId, updates) =>
      ipcRenderer.invoke('production:updateLotQuantity', lotId, updates),
  },

  // Stock 네임스페이스
  stock: {
    receiveStock: (input) => ipcRenderer.invoke('stock:receiveStock', input),
    consumeStock: (input) => ipcRenderer.invoke('stock:consumeStock', input),
    deductByBOM: (productId, qty, lotId) =>
      ipcRenderer.invoke('stock:deductByBOM', productId, qty, lotId),
    getStockByMaterial: (materialId) =>
      ipcRenderer.invoke('stock:getStockByMaterial', materialId),
    getStockSummary: () => ipcRenderer.invoke('stock:getStockSummary'),
    getLowStockItems: () => ipcRenderer.invoke('stock:getLowStockItems'),
    registerProcessStock: (input) =>
      ipcRenderer.invoke('stock:registerProcessStock', input),
    consumeProcessStock: (processCode, materialId, qty) =>
      ipcRenderer.invoke('stock:consumeProcessStock', processCode, materialId, qty),
  },

  // BOM 네임스페이스
  bom: {
    calculateRequirements: (productId, qty) =>
      ipcRenderer.invoke('bom:calculateRequirements', productId, qty),
    getBOMByProduct: (productId) =>
      ipcRenderer.invoke('bom:getBOMByProduct', productId),
    createBOM: (input) => ipcRenderer.invoke('bom:createBOM', input),
    updateBOM: (bomId, input) => ipcRenderer.invoke('bom:updateBOM', bomId, input),
  },

  // Material 네임스페이스
  material: {
    getAll: () => ipcRenderer.invoke('material:getAll'),
    getById: (id) => ipcRenderer.invoke('material:getById', id),
    create: (input) => ipcRenderer.invoke('material:create', input),
    update: (id, input) => ipcRenderer.invoke('material:update', id, input),
    delete: (id) => ipcRenderer.invoke('material:delete', id),
  },

  // LotTrace 네임스페이스
  lot: {
    getTrace: (lotNumber) => ipcRenderer.invoke('lot:getTrace', lotNumber),
    getForwardTrace: (lotNumber) => ipcRenderer.invoke('lot:getForwardTrace', lotNumber),
    getBackwardTrace: (lotNumber) => ipcRenderer.invoke('lot:getBackwardTrace', lotNumber),
  },

  // Inspection 네임스페이스
  inspection: {
    create: (input) => ipcRenderer.invoke('inspection:create', input),
    getByLot: (lotId) => ipcRenderer.invoke('inspection:getByLot', lotId),
  },

  // Line 네임스페이스
  line: {
    getAll: () => ipcRenderer.invoke('line:getAll'),
    getByProcess: (processCode) => ipcRenderer.invoke('line:getByProcess', processCode),
  },

  // Sequence 네임스페이스
  sequence: {
    getNext: (prefix) => ipcRenderer.invoke('sequence:getNext', prefix),
  },
})
```

---

### Phase 3: TypeScript 타입 정의 (우선순위: 2)

**파일**: `src/lib/electronBridge.ts`

#### 3.1 비즈니스 타입 Import

```typescript
// 서비스 타입 Import
import type {
  CreateLotInput,
  CompleteLotInput,
  AddMaterialInput,
  LotWithRelations,
  LotStatus
} from '../services/productionService'
import type {
  ReceiveStockInput,
  ConsumeStockInput,
  StockItem,
  StockSummary
} from '../services/stockService'
import type { CalculatedRequirement } from '../services/bomService'
```

#### 3.2 Window 타입 확장

```typescript
declare global {
  interface Window {
    electronAPI?: {
      // 기존 프린터/파일 API (유지)
      getPrinters: () => Promise<PrinterInfo[]>
      printPDF: (options: PrintOptions) => Promise<PrintResult>
      // ...

      // === 비즈니스 API ===

      production: {
        createLot: (input: CreateLotInput) => Promise<ApiResult<LotWithRelations>>
        startProduction: (lotId: number, lineCode: string, workerId?: number) => Promise<ApiResult<LotWithRelations>>
        completeProduction: (input: CompleteLotInput) => Promise<ApiResult<LotWithRelations>>
        addMaterial: (input: AddMaterialInput) => Promise<ApiResult<{ lot: LotWithRelations }>>
        removeMaterial: (lotMaterialId: number) => Promise<ApiResult<void>>
        getLotById: (id: number) => Promise<LotWithRelations | null>
        getLotByNumber: (lotNumber: string) => Promise<LotWithRelations | null>
        getLotsByProcess: (processCode: string, options?: { status?: LotStatus }) => Promise<LotWithRelations[]>
        getLotsByStatus: (status: LotStatus, options?: { processCode?: string }) => Promise<LotWithRelations[]>
        updateLotQuantity: (lotId: number, updates: { plannedQty?: number; completedQty?: number; defectQty?: number }) => Promise<ApiResult<LotWithRelations>>
      }

      stock: {
        receiveStock: (input: ReceiveStockInput) => Promise<ApiResult<StockItem>>
        consumeStock: (input: ConsumeStockInput) => Promise<ApiResult<void>>
        deductByBOM: (productId: number, qty: number, lotId?: number) => Promise<ApiResult<DeductResult>>
        getStockByMaterial: (materialId: number) => Promise<StockItem[]>
        getStockSummary: () => Promise<StockSummary[]>
        getLowStockItems: () => Promise<StockSummary[]>
        registerProcessStock: (input: ProcessStockInput) => Promise<ApiResult<ProcessStock>>
        consumeProcessStock: (processCode: string, materialId: number, qty: number) => Promise<ApiResult<void>>
      }

      bom: {
        calculateRequirements: (productId: number, qty: number) => Promise<CalculatedRequirement[]>
        getBOMByProduct: (productId: number) => Promise<BOMItem[]>
        createBOM: (input: CreateBOMInput) => Promise<ApiResult<BOMItem>>
        updateBOM: (bomId: number, input: UpdateBOMInput) => Promise<ApiResult<BOMItem>>
      }

      material: {
        getAll: () => Promise<Material[]>
        getById: (id: number) => Promise<Material | null>
        create: (input: CreateMaterialInput) => Promise<ApiResult<Material>>
        update: (id: number, input: UpdateMaterialInput) => Promise<ApiResult<Material>>
        delete: (id: number) => Promise<ApiResult<void>>
      }

      lot: {
        getTrace: (lotNumber: string) => Promise<LotTrace>
        getForwardTrace: (lotNumber: string) => Promise<LotTrace>
        getBackwardTrace: (lotNumber: string) => Promise<LotTrace>
      }

      inspection: {
        create: (input: CreateInspectionInput) => Promise<ApiResult<Inspection>>
        getByLot: (lotId: number) => Promise<Inspection[]>
      }

      line: {
        getAll: () => Promise<Line[]>
        getByProcess: (processCode: string) => Promise<Line[]>
      }

      sequence: {
        getNext: (prefix: string) => Promise<SequenceResult>
      }
    }
  }
}

// API 결과 래퍼 타입
interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

#### 3.3 헬퍼 함수 추가

```typescript
/**
 * Electron 비즈니스 API 사용 가능 여부
 */
export function hasBusinessAPI(): boolean {
  return isElectron() &&
    window.electronAPI?.production !== undefined &&
    window.electronAPI?.stock !== undefined
}

/**
 * 안전한 API 호출 래퍼
 */
export async function callAPI<T>(
  apiCall: () => Promise<ApiResult<T>>
): Promise<T> {
  const result = await apiCall()
  if (!result.success) {
    throw new Error(result.error || 'API call failed')
  }
  return result.data as T
}
```

---

### Phase 4: Context 수정 (우선순위: 3)

#### 4.1 ProductionContext.tsx

**변경 전**:
```typescript
import * as productionService from '../../services/mock/productionService.mock'
```

**변경 후**:
```typescript
import { isElectron, hasBusinessAPI, callAPI } from '../../lib/electronBridge'
import * as mockProductionService from '../../services/mock/productionService.mock'

// 서비스 선택 (Electron → 실제 API, 브라우저 → Mock)
const useRealAPI = hasBusinessAPI()

// LOT 생성 예시
const createLot = useCallback(async (input: CreateLotInput): Promise<LotWithRelations> => {
  setLoading(true)
  try {
    let lot: LotWithRelations

    if (useRealAPI && window.electronAPI?.production) {
      // Electron: 실제 API 호출
      lot = await callAPI(() => window.electronAPI!.production.createLot(input))
    } else {
      // 브라우저: Mock 서비스
      lot = await mockProductionService.createLot(input)
    }

    setState((prev) => ({
      ...prev,
      currentLot: lot,
      todayLots: [lot, ...prev.todayLots],
      isLoading: false,
    }))
    return lot
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LOT 생성 실패'
    setError(message)
    throw err
  }
}, [setLoading, setError])
```

#### 4.2 수정 대상 Context 파일

| 파일 | 주요 변경 |
|------|----------|
| `ProductionContext.tsx` | `production:*` API 연동 |
| `MaterialContext.tsx` | `material:*`, `stock:*` API 연동 |
| `BOMContext.tsx` | `bom:*` API 연동 |

#### 4.3 하이브리드 모드 지원

```typescript
// 환경 감지 훅
function useServiceMode() {
  const [mode, setMode] = useState<'electron' | 'browser'>('browser')

  useEffect(() => {
    if (hasBusinessAPI()) {
      setMode('electron')
      console.log('🔌 Electron API 연결됨')
    } else {
      setMode('browser')
      console.log('🌐 브라우저 모드 (Mock 서비스)')
    }
  }, [])

  return mode
}
```

---

## 3. 의존성 순서

```
Phase 1 (main.ts)
    ↓
Phase 2 (preload.ts)
    ↓
Phase 3 (electronBridge.ts)
    ↓
Phase 4 (Context/*.tsx)
```

**Phase 1, 2는 병렬 작업 가능** (동시에 작업해도 됨)
**Phase 3, 4는 순차적** (타입 정의 후 Context 수정)

---

## 4. 테스트 계획

### 4.1 단위 테스트 (IPC 연결 확인)

```typescript
// TEST/electron-ipc.test.ts

describe('Electron IPC Integration', () => {
  it('production:createLot should create LOT', async () => {
    const input = { processCode: 'CA', productCode: 'P001', plannedQty: 100 }
    const result = await window.electronAPI.production.createLot(input)
    expect(result.success).toBe(true)
    expect(result.data.lotNumber).toMatch(/^CA/)
  })

  it('stock:deductByBOM should deduct stock', async () => {
    const result = await window.electronAPI.stock.deductByBOM(1, 10, 1)
    expect(result.success).toBe(true)
  })
})
```

### 4.2 통합 테스트 시나리오

| 시나리오 | 검증 포인트 |
|----------|------------|
| LOT 생성 → 자재 투입 → 완료 | LOT 상태 변경, 자재 연결 |
| 생산 완료 → 재고 차감 | `deductByBOM` 호출, 재고 감소 |
| 입고 → 재고 조회 | 재고 증가 확인 |
| LOT 추적 | 정방향/역방향 추적 |

### 4.3 수동 테스트 체크리스트

- [ ] Electron 앱 실행 확인
- [ ] LOT 생성 → DB 저장 확인 (Prisma Studio)
- [ ] 자재 입고 → 재고 증가 확인
- [ ] 생산 완료 → 재고 차감 확인
- [ ] 브라우저 모드에서 Mock 정상 동작

---

## 5. 롤백 계획

### 5.1 Context 롤백 (즉시 가능)

```typescript
// 롤백: 단순히 import를 원래대로 변경
import * as productionService from '../../services/mock/productionService.mock'

// 하이브리드 코드 제거, 직접 호출로 복원
const lot = await productionService.createLot(input)
```

### 5.2 Electron 파일 롤백

```bash
# Git으로 원래 상태 복원
git checkout HEAD -- electron/main.ts
git checkout HEAD -- electron/preload.ts
```

### 5.3 브라우저 모드 유지

- Mock 서비스는 **삭제하지 않음**
- `run-browser.bat` 실행 시 Mock 모드로 동작
- 개발/테스트 시 Mock 모드 활용 가능

---

## 6. 예상 일정

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| Phase 1 | main.ts IPC 핸들러 | 2시간 |
| Phase 2 | preload.ts API 노출 | 1시간 |
| Phase 3 | electronBridge.ts 타입 | 1시간 |
| Phase 4 | Context 3개 수정 | 2시간 |
| 테스트 | 통합 테스트 | 1시간 |
| **총계** | | **7시간** |

---

## 7. 승인 후 실행 순서

1. `electron/main.ts` - IPC 핸들러 35개 추가
2. `electron/preload.ts` - 네임스페이스별 API 노출
3. `src/lib/electronBridge.ts` - 타입 정의 확장
4. `src/app/context/ProductionContext.tsx` - API 연동
5. `src/app/context/MaterialContext.tsx` - API 연동
6. `src/app/context/BOMContext.tsx` - API 연동
7. 통합 테스트 실행
8. CLAUDE.md 변경 이력 업데이트

---

## 8. 주의사항

### 8.1 Prisma 클라이언트 문제

Electron Main Process에서 Prisma 사용 시:
- `prisma generate` 후 Main Process 빌드 필요
- `dist-electron/main.js`에서 Prisma Client 접근 확인

### 8.2 ESM/CommonJS 호환성

```typescript
// electron/main.ts (ESM)
import { prisma } from '../src/lib/prisma'  // 경로 주의
```

빌드 시 경로 문제 발생 가능 → Vite 설정 확인 필요

### 8.3 에러 전파

```typescript
// Main Process 에러 → Renderer Process 전달
ipcMain.handle('production:createLot', async (_, input) => {
  try {
    return { success: true, data: await productionService.createLot(input) }
  } catch (error) {
    // 에러 객체는 직렬화 불가 → 문자열로 변환
    return { success: false, error: error.message || String(error) }
  }
})
```

---

**작성자**: Claude
**검토 필요**: Prisma 빌드 경로, ESM 호환성
