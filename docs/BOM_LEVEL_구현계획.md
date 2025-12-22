# BOM Level 구현 계획서

> 작성일: 2025-12-22
> 상태: 계획 승인 대기

## 1. 개요

### 목표
공정 코드(processCode) 기반 BOM Level 자동 산출 및 계층형 트리 UI 구현

### 배경
- 현재: 모든 BOM 자재가 LV=1로 
표시 (flat 구조)
- 목표: 공정별 계층 구조 (LV0~LV4) 표현

---

## 2. BOM Level 구조

### 2.1 Level 정의

| Level | 공정코드 | 공정명 | 설명 |
|-------|----------|--------|------|
| LV0 | - | 완제품 | 최종 산출물 (품번 자체) |
| LV1 | PA | 제품조립 | 완제품 조립 투입 자재 |
| LV2 | MC | 수동압착 | 수동 압착 반제품 |
| LV3 | SB, MS | 서브조립, 중간탈피 | 중간 반제품 |
| LV4 | CA | 자동절단압착 | 절압 반제품 (기본 단위) |

### 2.2 Level 결정 로직

```typescript
function determineLevel(processCode: string): number {
  switch (processCode?.toUpperCase()) {
    case 'PA': return 1;
    case 'MC': return 2;
    case 'SB':
    case 'MS': return 3;
    case 'CA': return 4;
    default: return 1;  // 기본값: LV1 (PA)
  }
}
```

### 2.3 제외 공정

| 공정 | 제외 사유 |
|------|-----------|
| SP | 자재 수집 행위, 변환 없음 |
| HS | 형태 처리, 품번 미생성 |
| CQ, CI, VI | 검사 공정, 품번 미생성 |

---

## 3. 데이터 모델

### 3.1 BOMItem 인터페이스 (변경)

```typescript
// 파일: src/app/context/BOMContext.tsx

interface BOMItem {
  // 기존 필드
  id: number;
  productCode: string;      // 완제품 품번
  productName?: string;     // 완제품명
  materialCode: string;     // 자재 품번
  materialName: string;     // 자재명
  quantity: number;         // 수량
  unit: string;             // 단위

  // 추가 필드
  processCode: string;      // 공정 코드 (PA/MC/SB/MS/CA)
  crimpCode?: string;       // 절압착 품번 (CA 자재용)
  level: number;            // BOM Level (1-4, 자동 산출)
}
```

### 3.2 그룹핑 구조 (변경)

```typescript
// 현재: 품번별 flat 그룹핑
interface BOMGroup {
  productCode: string;
  productName?: string;
  items: BOMItem[];
}

// 변경: 품번 → Level → (crimpCode) 계층 구조
interface BOMGroup {
  productCode: string;
  productName?: string;
  levelGroups: LevelGroup[];
}

interface LevelGroup {
  level: number;            // 1-4
  processCode: string;      // PA, MC, SB/MS, CA
  processName: string;      // "제품조립", "수동압착" 등
  items: BOMItem[];
  crimpGroups?: CrimpGroup[];  // LV4 CA인 경우만
}

interface CrimpGroup {
  crimpCode: string;        // 절압착 품번 (00315452-001)
  items: BOMItem[];
}
```

---

## 4. Excel Import 매핑

### 4.1 Excel 컬럼 매핑

| Excel 컬럼 | BOMItem 필드 | 필수 |
|------------|--------------|------|
| productCode | productCode | O |
| itemCode | materialCode, materialName | O |
| processCode | processCode → level 산출 | O |
| crimpCode | crimpCode | △ (CA만) |
| quantity | quantity | △ (기본값 1) |
| unit | unit | △ (기본값 EA) |

### 4.2 Import 로직

```typescript
// 파일: src/app/pages/MasterData.tsx

const handleImportComplete = (result) => {
  if (result.data && result.data.length > 0 && type === 'bom') {
    const bomData = result.data.map((item) => {
      const bom = item as {
        productCode: string;
        itemCode: string;
        processCode?: string;
        crimpCode?: string;
        quantity?: number;
        unit?: string;
      };

      const processCode = bom.processCode?.toUpperCase() || '';

      return {
        productCode: bom.productCode,
        materialCode: bom.itemCode,
        materialName: bom.itemCode,
        processCode: processCode,
        crimpCode: bom.crimpCode || undefined,
        level: determineLevel(processCode),
        quantity: bom.quantity || 1,
        unit: bom.unit || 'EA',
      };
    });

    addBOMItems(bomData);
  }
};
```

---

## 5. UI 트리 구조

### 5.1 화면 구성

```
📦 00315452 (완제품) ─────────────────────── LV0
│
├─ 🔧 LV1: PA 제품조립 (3개 자재)
│  └─ [테이블: materialCode, materialName, quantity, unit]
│
├─ 🔧 LV2: MC 수동압착 (5개 자재)
│  └─ [테이블: materialCode, materialName, quantity, unit]
│
├─ 🔧 LV3: SB/MS 서브조립 (4개 자재)
│  └─ [테이블: materialCode, materialName, quantity, unit]
│
└─ 🔧 LV4: CA 자동절단압착 (10개 자재)
   ├─ 📋 00315452-001 (3개)
   │  └─ [테이블]
   ├─ 📋 00315452-002 (4개)
   │  └─ [테이블]
   └─ 📋 00315452-003 (3개)
      └─ [테이블]
```

### 5.2 펼침/접기 상태

| 레벨 | 토글 대상 | 상태 관리 |
|------|-----------|-----------|
| LV0 | 품번 (전체 트리) | `expandedProducts: Set<string>` |
| LV1-4 | 각 Level 그룹 | `expandedLevels: Map<string, Set<number>>` |
| 절압품번 | LV4 하위 crimpCode | `expandedCrimps: Map<string, Set<string>>` |

---

## 6. 구현 단계

### Phase 1: BOMContext.tsx 수정
- [ ] BOMItem 인터페이스 확장 (processCode, crimpCode, level)
- [ ] LevelGroup, CrimpGroup 인터페이스 추가
- [ ] determineLevel() 함수 구현
- [ ] bomGroups 그룹핑 로직 변경 (품번 → Level → crimpCode)
- [ ] addBOMItems() 함수 수정

### Phase 2: MasterData.tsx Import 수정
- [ ] handleImportComplete() BOM 매핑 로직 수정
- [ ] processCode → level 자동 산출 적용
- [ ] crimpCode 매핑 추가

### Phase 3: MasterData.tsx 트리 UI 구현
- [ ] 3-Level 펼침/접기 상태 관리
- [ ] LV0 (품번) 토글 UI
- [ ] LV1-4 (공정별) 토글 UI
- [ ] LV4 하위 crimpCode 토글 UI (CA 자재)
- [ ] 각 레벨별 자재 테이블

### Phase 4: 테스트
- [ ] Excel Import 테스트
- [ ] Level 자동 산출 확인
- [ ] 트리 펼침/접기 동작 확인
- [ ] crimpCode 그룹핑 확인 (LV4)

---

## 7. 수정 파일 목록

| 파일 | 수정 내용 |
|------|-----------|
| `src/app/context/BOMContext.tsx` | 타입 확장, 그룹핑 로직, determineLevel() |
| `src/app/pages/MasterData.tsx` | Import 매핑, 트리 UI |

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 계획서 초안 작성 |
| 2025-12-22 | **Phase 1 완료**: BOMContext.tsx 수정 (determineLevel, getProcessName, BOMItem 확장, LevelGroup/CrimpGroup, bomGroups 그룹핑) |
| 2025-12-22 | **Phase 2 완료**: MasterData.tsx Import 매핑 수정 (processCode→level 자동 산출, crimpCode CA만 적용), excelImportService.ts BOMImportRow 확장 |
| 2025-12-22 | **Phase 3 완료**: MasterData.tsx 트리 UI 구현 (3-Level 펼침/접기: 품번→공정→crimpCode, 레벨별 배지 색상, 전체 펼침/접기 버튼) |
| 2025-12-22 | **Phase 4 완료**: 전체 테스트 통과 (BOM Level 66개 + Phase 207개 = 273개 테스트 통과) |
