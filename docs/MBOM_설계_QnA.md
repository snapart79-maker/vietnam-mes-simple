# MBOM 설계 Q&A 정리

> 작성일: 2025-12-21
> 목적: 와이어 하네스 제조 MBOM 구조 설계를 위한 요구사항 분석

---

## 1. 공정 흐름

### Q1. 공정 순서는?

**답변:**
```
자재입고 → CA(자동절단압착) → [선취작업] → CQ(압착검사) → SP(키팅) → PA(제품조립) → CI(회로검사) → VI(육안검사)
```

### Q2. 선취 작업이란?

**답변:**
CA 이후 선택적으로 진행되는 작업들:
- **MS (중간스트립)**: 기계작업, CA 절압물 중간 탈피
- **MC (수동압착)**: 수작업, MS + 다른 CA 절압물 연결
- **SB (서브조립)**: 수작업, CA완료품 + 자재 투입
- **HS (열수축)**: 기계작업, 연결부 열수축튜브 수축 (SB에서 튜브 이미 장착)

### Q3. 모든 완제품이 모든 공정을 거치나요?

**답변:**
아니요, 제품에 따라 일부 공정 생략 가능.

**공정 조합 패턴 예시:**
| 패턴 | 공정 흐름 |
|------|----------|
| 단순 | CA → SP → PA |
| 중간 | CA → SB → MC → SP → PA |
| 복잡 | CA → MS → MC → SB → HS → SP → PA |

### Q4. CQ(압착검사) 위치는?

**답변:**
- CA 직후 또는 HS 직후
- 압착이 포함된 작업 완료 후 진행

### Q5. SP(제품조립제공부품) 역할은?

**답변:**
조립 작업이 아닌 **키팅(Kitting)** 공정:
- 전공정 출력물 + 조립 투입 자재를 작업량에 맞춰 준비
- 하나의 바코드 전표로 출력 → PA로 전달

---

## 2. 공정별 자재 투입

| 공정 | 투입 자재 | 비고 |
|------|----------|------|
| **CA** | 전선, 단자, 씰 | |
| **MS** | 전공정품만 | 자재 투입 없음, 중간탈피만 수행 |
| **MC** | 전공정품 + 조인단자, 단자 | MS→MC 연결 시 조인단자 필요 |
| **SB** | CA완료품 + 그로멧, 씰, 열수축튜브, 레진튜브, 튜브 등 | |
| **HS** | 전공정품만 | SB에서 튜브 이미 장착 |
| **SP/PA** | 전공정품 + 커넥터, 하우징, 밴드케이블, 케이블타이 등 | |

---

## 3. 반제품 품번 체계

| 유형 | 품번 형식 | 예시 | 비고 |
|------|----------|------|------|
| 완제품 | `[품번]` | `00315452` | 기초자료 등록 |
| 절압품(CA) | `[품번]-[회로번호]` | `00315452-001` ~ `-010` | 기초자료 등록, 회로수만큼 |
| MS 반제품 | `MS[절압품번]` | `MS00315452-001` | 절압품번 기준 (공정+절압품번) |
| MC 반제품 | `MC[품번]` | `MC00315452` | |
| SB 반제품 | `SB[품번]` | `SB00315452` | |
| HS 반제품 | `HS[품번]` | `HS00315452` | |

### 절압품번 = 가닥수(회로수)
- 완제품 회로수가 10회로 → 001~010 (10개의 절압품)
- 각 절압품번별로 자재를 따로 등록
- **MS 반제품은 절압품번 기준**으로 생성됨 (예: `MS00315452-001`, `MS00315452-002`)

---

## 4. 생산 작업 단위

### 절압물
- **박스/묶음 단위**로 작업
- 바코드 출력 시 수량 기입 → 한 묶음
- 여러 묶음 → 1 Box로 취합 시 **취합 바코드** 생성

### 완제품
- **Box 당량 단위**로 작업
- 생산 시:
  1. 완제품 수량 입력 (예: 1000)
  2. 해당 절압품번 선택
  3. 절압 작업수량(묶음단위) 선택

### 완제품-절압물 수량 관계
- **독립적**: 완제품 1000개 생산해도 절압물 2000개 불출 가능
- 재고 차감으로 추적 (1000개 소진, 1000개 잔여)

### 묶음 단위
- 사양별 기본값 설정 (예: 200)
- 현장에서 수정 가능

---

## 5. 바코드 체계

### 5.1 같은 품번 묶음
```
[절압물 - 동일 품번]
  묶음 바코드 ─┬─► 00315452-001 × 200개 (묶음1)
              ├─► 00315452-001 × 200개 (묶음2)
              └─► 00315452-001 × 200개 (묶음3)
                          │
                          ▼
              취합 바코드 ─► 00315452-001 × 600개 (1 Box)
```

### 5.2 다른 품번 묶음 (SET)
```
[절압물 - 다른 품번 SET]
  취합 바코드 ─┬─► 00315452-001 × 100개
              ├─► 00315452-002 × 100개
              ├─► 00315452-003 × 100개
              └─► 00315452-004 × 100개
                          │
                          ▼
              표시 방식:  SET × 100 (4품번)
                         또는
                         개별 바코드 정보 목록
```

### 5.3 묶음 규칙
- **같은 품번**: 수량 합계로 표시 (예: 600개)
- **다른 품번**: SET 수량으로 표시 또는 개별 바코드 정보 포함

---

## 6. 공정 코드 정리

| 코드 | 공정명 | 순서 | 자재투입 | 검사여부 | 비고 |
|------|--------|------|---------|---------|------|
| CA | 자동절단압착 | 10 | O | X | 전선, 단자, 씰 |
| MS | 중간스트립 | 20 | X | X | 중간탈피만 (자재 없음) |
| MC | 수동압착 | 30 | O | X | 조인단자, 단자 |
| SB | 서브조립 | 40 | O | X | 그로멧, 씰, 튜브류 |
| HS | 열수축 | 50 | X | X | SB에서 튜브 장착됨 |
| CQ | 압착검사 | 60 | X | O | |
| SP | 제품조립제공부품 | 70 | O | X | 조립자재 키팅 |
| PA | 제품조립 | 80 | O | X | 커넥터, 하우징 등 |
| CI | 회로검사 | 90 | X | O | |
| VI | 육안검사 | 100 | X | O | |

---

## 7. MBOM 데이터베이스 설계안

### 7.1 테이블 구조

#### processes (공정 마스터)
```sql
CREATE TABLE processes (
  id                 SERIAL PRIMARY KEY,
  code               VARCHAR(10) UNIQUE NOT NULL,
  name               VARCHAR(50) NOT NULL,
  seq                INT NOT NULL,
  has_material_input BOOLEAN DEFAULT false,
  is_inspection      BOOLEAN DEFAULT false,
  description        TEXT
);
```

#### products (제품 마스터 - 완제품 + 반제품)
```sql
CREATE TABLE products (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  product_type VARCHAR(20) NOT NULL,    -- FINISHED, SEMI_CA, SEMI_MS, SEMI_MC, SEMI_SB, SEMI_HS
  parent_code  VARCHAR(50),             -- 완제품 품번 (반제품인 경우)
  process_code VARCHAR(10),             -- 해당 공정 (반제품인 경우)
  circuit_no   INT,                     -- 회로번호 (절압품인 경우)
  bundle_qty   INT DEFAULT 100,         -- 기본 묶음 수량
  description  TEXT
);
```

#### mbom (공정별 자재 투입)
```sql
CREATE TABLE mbom (
  id              SERIAL PRIMARY KEY,
  product_id      INT NOT NULL,          -- 완제품 ID
  semi_product_id INT,                   -- 반제품 ID (절압품번 등)
  process_code    VARCHAR(10) NOT NULL,  -- 투입 공정
  item_type       VARCHAR(20) NOT NULL,  -- MATERIAL, SEMI_PRODUCT
  material_id     INT,                   -- 자재 ID
  input_semi_id   INT,                   -- 투입 반제품 ID
  quantity        DECIMAL(10,4) NOT NULL,
  unit            VARCHAR(20),
  description     TEXT
);
```

#### process_routing (제품별 공정 순서)
```sql
CREATE TABLE process_routing (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL,
  process_code VARCHAR(10) NOT NULL,
  seq          INT NOT NULL,
  is_required  BOOLEAN DEFAULT true
);
```

#### production_lots (생산 LOT - 묶음/취합 바코드)
```sql
CREATE TABLE production_lots (
  id            SERIAL PRIMARY KEY,
  lot_number    VARCHAR(50) UNIQUE NOT NULL,
  lot_type      VARCHAR(20) NOT NULL,     -- BUNDLE, BOX, PRODUCT
  product_id    INT NOT NULL,
  process_code  VARCHAR(10) NOT NULL,
  quantity      INT NOT NULL,
  parent_lot_id INT,                      -- 취합 시 상위 LOT
  status        VARCHAR(20) DEFAULT 'CREATED',
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### 7.2 ERD

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│  processes  │       │    products     │       │  materials  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ code (PK)   │       │ id (PK)         │       │ id (PK)     │
│ name        │       │ code            │       │ code        │
│ seq         │       │ product_type    │       │ name        │
│ has_material│       │ parent_code     │       │ category    │
└─────────────┘       │ process_code    │       └──────┬──────┘
      │               │ circuit_no      │              │
      │               │ bundle_qty      │              │
      │               └────────┬────────┘              │
      │                        │                       │
      ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                          mbom                                │
├─────────────────────────────────────────────────────────────┤
│ product_id      ─────────► 완제품                            │
│ semi_product_id ─────────► 반제품 (절압품번)                  │
│ process_code    ─────────► 투입 공정                         │
│ item_type       ─────────► MATERIAL / SEMI_PRODUCT           │
│ material_id     ─────────► 자재                              │
│ input_semi_id   ─────────► 전공정 반제품                      │
│ quantity                                                     │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     production_lots                          │
├─────────────────────────────────────────────────────────────┤
│ lot_number      ─────────► 바코드 번호                       │
│ lot_type        ─────────► BUNDLE / BOX / PRODUCT           │
│ product_id                                                   │
│ parent_lot_id   ─────────► 취합 시 상위 LOT                  │
│ quantity                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 다음 단계

1. 설계안 분석 및 검토
2. 구현 방향 설정
3. Prisma 스키마 업데이트
4. UI 구현 (BOM 트리 뷰, 공정 라우팅 편집 등)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-21 | 초안 작성 (Q&A 정리 및 설계안) |
| 2025-12-21 | 수정: MS 반제품 품번 체계 (절압품번 포함), 공정별 자재 투입 (MS→X, MC→O), 바코드 묶음 규칙 (다른 품번 SET) |
