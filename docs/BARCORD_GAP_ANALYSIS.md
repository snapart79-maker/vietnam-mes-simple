# BARCORD 구현 Gap 분석 (상세)

> **분석일**: 2025-12-23
> **분석자**: Claude Code
> **목적**: BARCORD 가이드 대비 현재 프로젝트 실제 구현 상태 상세 분석

---

## 1. 핵심 발견 사항

### 1.1 치명적 구조 문제

**모든 페이지와 컨텍스트가 Mock 서비스를 사용 중**

실제 Prisma 서비스(src/services/*.ts)가 완벽하게 구현되어 있지만, **UI 컴포넌트에서는 전혀 사용되지 않습니다**.

```
현재 구조:
UI Components → Mock Services → 메모리/localStorage
                 ↓
            Prisma Services → PostgreSQL (미연동)
```

### 1.2 Mock 서비스 사용 현황

| 페이지/컴포넌트 | Mock 서비스 | 문제점 |
|----------------|-------------|--------|
| Dashboard.tsx | dashboardService.mock | 새로고침 시 데이터 초기화 |
| ProcessView.tsx | productionService.mock, stockService.mock, lineService.mock | 생산 LOT 새로고침 시 초기화 |
| InspectionView.tsx | inspectionService.mock, productionService.mock | 검사 기록 초기화 |
| MaterialReceiving.tsx | stockService.mock | ✅ localStorage 영속화 |
| MaterialStock.tsx | stockService.mock | ✅ localStorage 영속화 |
| ReportView.tsx | productionService.mock, lotTraceService.mock | 데이터 없음 |
| Settings.tsx | lineService.mock, appSettingsService.mock, backupService.mock, authService.mock | 설정 변경 불가 |
| AuthContext.tsx | authService.mock | 인증 데이터 초기화 |
| ProductionContext.tsx | productionService.mock | 생산 데이터 초기화 |

---

## 2. 데이터 영속성 현황

### 2.1 영속성 있는 데이터 (localStorage)

| 데이터 | 저장소 | localStorage 키 |
|--------|--------|-----------------|
| 자재 마스터 | MaterialContext | `vietnam_mes_materials` |
| 제품 마스터 | ProductContext | `vietnam_mes_products` |
| BOM 마스터 | BOMContext | `vietnam_mes_bom` |
| 자재 입고 기록 | stockService.mock | `vietnam_mes_receivings` |
| LOT별 재고 | stockService.mock | `vietnam_mes_stocks` |
| LOT 자재 사용 기록 | stockService.mock | `vietnam_mes_lot_materials` |

### 2.2 영속성 없는 데이터 (새로고침 시 초기화)

| 데이터 | 서비스 | 영향 |
|--------|--------|------|
| **생산 LOT (ProductionLot)** | productionService.mock | 생산 이력 전체 유실 |
| **검사 기록 (Inspection)** | inspectionService.mock | 검사 이력 전체 유실 |
| **이월 수량 (CarryOver)** | productionService.mock | 이월 데이터 유실 |
| 라인 마스터 | lineService.mock | 하드코딩, 수정 불가 |
| 사용자 인증 | authService.mock | 세션 유실 |
| 앱 설정 | appSettingsService.mock | 설정 유실 |

---

## 3. BARCORD 기능별 구현 상태

### 3.1 완전 구현 (100%)

| 기능 | 서비스/파일 | 비고 |
|------|------------|------|
| V1 바코드 생성/파싱 | barcodeService.ts | `XX-YYMMDD-XXXX` |
| V2 바코드 생성/파싱 | barcodeService.ts | `{품번}Q{수량}-{공정}{YYMMDD}-{시퀀스}` |
| Bundle 바코드 생성/파싱 | barcodeService.ts | SET 번들 |
| CI 바코드 파싱 | barcodeService.ts | `CI-{마킹LOT}-{시퀀스}` |
| 본사 바코드 파싱 | barcodeService.ts | 품번/수량/LOT 추출 |
| 자재 입고 처리 | stockService.mock | localStorage 영속화 |
| LOT별 재고 조회 | stockService.mock | localStorage 영속화 |
| FIFO 재고 차감 | stockService.mock | 음수 허용 |
| BOM 기반 자재 차감 | stockService.mock | bomService.mock 연동 |
| 차감 롤백 | stockService.mock | productionLotId 기반 |
| 라벨 PDF 생성 | labelService.ts | QR + 1D 바코드 |
| 전표 PDF 생성 | documentService.ts | A4 전표 |
| 공정별 입력 검증 | processValidation.ts | 10개 공정 규칙 |

### 3.2 부분 구현 (50-80%)

| 기능 | 현재 상태 | 누락 부분 |
|------|----------|----------|
| 2단계 워크플로우 | Mock에서 동작 | 새로고침 시 초기화 |
| LOT 추적 | 알고리즘 구현됨 | DB 연동 없음 (데이터가 없어서 동작 불가) |
| 이월 수량 관리 | Mock에서 동작 | 새로고침 시 초기화 |
| Bundle LOT 관리 | 서비스 구현됨 | UI 미연동, 영속성 없음 |
| 압착검사 (CR) | 기록 생성만 | 영속성 없음 |

### 3.3 미구현 (0%)

| 기능 | BARCORD 요구사항 | 현재 상태 |
|------|-----------------|----------|
| **CI 바코드 생성** | 회로검사 합격 시 `CI-{마킹LOT}-{시퀀스}` 바코드 + ProductionLot 생성 | 미구현 |
| **VI 바코드 생성** | 육안검사 합격 시 `VI-{마킹LOT}-{시퀀스}` 바코드 + ProductionLot 생성 | 미구현 |
| **SP 압착검사 확인** | SP 공정에서 CA/MC 투입 시 압착검사 통과 확인 | 미구현 |
| **MO 공정 전용 처리** | 여러 자재 → 하나의 MO 바코드로 묶기 | 미구현 |
| **생산 데이터 영속화** | ProductionLot DB 저장 | Mock 메모리만 |
| **검사 데이터 영속화** | Inspection DB 저장 | Mock 메모리만 |
| **라인 마스터 관리** | 동적 라인 추가/수정/삭제 | 하드코딩 |
| **사용자 인증 영속화** | 로그인/로그아웃 DB 저장 | Mock 메모리만 |

---

## 4. UI 페이지별 동작 분석

### 4.1 공정 모니터링 (ProcessView.tsx)

**현재 상태**:
- 공정 선택, 완제품 선택, 라인 선택 가능
- LOT 생성/완료 가능 (Mock)
- 자재 스캔/투입 가능 (Mock)

**문제점**:
- 새로고침하면 생성한 모든 LOT 사라짐
- 이월 수량 연동 안 됨
- 라인 목록이 하드코딩

### 4.2 품질 검사 (InspectionView.tsx)

**현재 상태**:
- 압착검사/회로검사/육안검사 탭 있음
- 바코드 스캔 후 검사 기록 생성 가능

**문제점**:
- CI/VI 바코드 생성 안 됨
- 검사 기록 새로고침하면 사라짐
- 검사 통계 항상 0

### 4.3 대시보드 (Dashboard.tsx)

**현재 상태**:
- 통계 카드 표시
- 차트 표시

**문제점**:
- 모든 데이터가 새로고침하면 0
- 실시간 데이터 연동 안 됨

### 4.4 자재 입고 (MaterialReceiving.tsx)

**현재 상태**: 정상 동작
- 바코드 스캔 입고
- 입고 이력 조회
- localStorage 영속화

### 4.5 재고 현황 (MaterialStock.tsx)

**현재 상태**: 정상 동작
- LOT별 재고 조회
- 검색/필터
- 삭제 기능

### 4.6 기초 자료 (MasterData.tsx)

**현재 상태**: 정상 동작
- 제품/자재/BOM Excel Import
- localStorage 영속화

### 4.7 리포트 (ReportView.tsx)

**현재 상태**:
- 생산현황/투입이력/LOT추적 탭 있음

**문제점**:
- 생산 데이터가 없어서 항상 빈 화면
- LOT 추적 데이터 없음

### 4.8 설정 (Settings.tsx)

**현재 상태**:
- 라인 관리, 백업/복원, 비밀번호 변경 탭 있음

**문제점**:
- 라인 추가/수정 Mock (영속성 없음)
- 백업/복원 Mock

---

## 5. 구현 우선순위 계획

### Phase 1: 생산 데이터 영속화 (Critical) - 5시간

**목표**: 새로고침해도 생산 데이터 유지

| 작업 | 방법 | 예상 시간 |
|------|------|----------|
| 1.1 productionService.mock에 localStorage 추가 | stockService.mock 패턴 적용 | 2시간 |
| 1.2 ProductionContext 영속화 연동 | 초기화 시 localStorage 로드 | 1시간 |
| 1.3 inspectionService.mock에 localStorage 추가 | 검사 기록 영속화 | 1시간 |
| 1.4 carryOverService.mock 영속화 | 이월 데이터 영속화 | 1시간 |

### Phase 2: CI/VI 바코드 생성 (High) - 4시간

**목표**: 검사 합격 시 바코드 자동 생성

| 작업 | 방법 | 예상 시간 |
|------|------|----------|
| 2.1 recordCircuitInspectionWithBarcode 구현 | inspectionService.mock에 추가 | 2시간 |
| 2.2 recordVisualInspectionWithBarcode 구현 | inspectionService.mock에 추가 | 1시간 |
| 2.3 InspectionView.tsx UI 연동 | 바코드 생성 후 표시/출력 | 1시간 |

### Phase 3: SP 압착검사 확인 (Medium) - 2시간

**목표**: SP 공정에서 CA/MC 투입 시 검사 확인

| 작업 | 방법 | 예상 시간 |
|------|------|----------|
| 3.1 checkCrimpInspectionPassed 구현 | inspectionService.mock에 추가 | 1시간 |
| 3.2 ProcessView.tsx에 검증 로직 추가 | SP 공정 투입 시 호출 | 1시간 |

### Phase 4: 대시보드/리포트 연동 (Medium) - 4시간

**목표**: 실시간 통계 및 이력 조회

| 작업 | 방법 | 예상 시간 |
|------|------|----------|
| 4.1 dashboardService.mock 실제 데이터 연동 | productionService.mock 참조 | 2시간 |
| 4.2 ReportView 데이터 연동 | 영속화된 데이터 조회 | 2시간 |

### Phase 5: 설정/라인 관리 (Low) - 2시간

**목표**: 라인 마스터 동적 관리

| 작업 | 방법 | 예상 시간 |
|------|------|----------|
| 5.1 lineService.mock localStorage 추가 | 라인 데이터 영속화 | 1시간 |
| 5.2 Settings 페이지 연동 | 추가/수정/삭제 동작 | 1시간 |

---

## 6. 총 예상 소요 시간

| Phase | 작업 | 시간 |
|-------|------|------|
| Phase 1 | 생산 데이터 영속화 | 5시간 |
| Phase 2 | CI/VI 바코드 생성 | 4시간 |
| Phase 3 | SP 압착검사 확인 | 2시간 |
| Phase 4 | 대시보드/리포트 연동 | 4시간 |
| Phase 5 | 설정/라인 관리 | 2시간 |
| **합계** | | **17시간** |

---

## 7. 권장 구현 순서

```
1. Phase 1 (Critical) - 생산 데이터 영속화
   └── 이것 없이는 다른 기능이 무의미

2. Phase 2 (High) - CI/VI 바코드 생성
   └── 검사 공정 완성

3. Phase 3 (Medium) - SP 압착검사 확인
   └── 품질 게이트 강화

4. Phase 4 (Medium) - 대시보드/리포트
   └── 데이터 시각화

5. Phase 5 (Low) - 설정/라인 관리
   └── 관리 기능 완성
```

---

## 8. 기술적 결정 사항

### 8.1 Mock vs Prisma 선택

**현재 추천**: Mock 서비스에 localStorage 추가

**이유**:
1. Prisma는 Node.js 환경 필요 (브라우저에서 직접 사용 불가)
2. Electron 환경에서만 Prisma 사용 가능
3. 브라우저 개발/테스트를 위해 Mock + localStorage 유지 필요
4. 향후 Electron 전용으로 전환 시 Prisma 연동

### 8.2 데이터 구조 통일

Mock 서비스의 데이터 구조를 Prisma 스키마와 동일하게 유지하여, 향후 Prisma 전환 시 코드 변경 최소화.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-23 | 초기 분석 문서 작성 |
| 2025-12-23 | 실제 서비스/페이지 분석 추가, 상세 Gap 목록 작성 |
| 2025-12-23 | **Phase 1 완료**: productionService.mock, inspectionService.mock localStorage 영속화 (15개 테스트 통과) |
| 2025-12-23 | **Phase 2 완료**: CI/VI 바코드 생성 (generateBarcordCIBarcode, generateBarcordVIBarcode, recordCircuitInspectionWithBarcode, recordVisualInspectionWithBarcode) - 32개 테스트 통과 |
| 2025-12-23 | **Phase 3 완료**: SP 공정 압착검사 확인 (checkCrimpInspectionPassed, getCrimpInspectionHistory, recordCrimpInspection, validateSPProcessInput, validateSPProcessInputs) - 36개 테스트 통과 |
| 2025-12-23 | **Phase 5 완료**: 라인 관리 (lineService.mock 완전 재작성 - CRUD, 공정별 배정, localStorage 영속화, 통계/검색/내보내기) - 33개 테스트 통과 |
