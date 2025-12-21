/**
 * Phase 4: BOM 기반 자재 차감 테스트
 *
 * 테스트 범위:
 * 1. BOM 소요량 조회
 * 2. 필요 자재 수량 계산
 * 3. FIFO 자재 차감
 * 4. 음수 재고 허용 차감
 * 5. BOM 기반 자재 차감
 * 6. 차감 롤백
 * 7. 가용 재고 확인
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getBOMRequirements,
  calculateRequiredMaterials,
  hasBOM,
  getBOMCountByProcess,
  addMockBOM,
  addMockMaterial,
  resetBOMData,
  type BOMItem,
} from '../src/services/mock/bomService.mock'
import {
  deductByBOM,
  rollbackBOMDeduction,
  checkBOMAvailability,
  consumeStockFIFOWithNegative,
  getAvailableQty,
  addMockStock,
  resetStockData,
  type StockItem,
} from '../src/services/mock/stockService.mock'

describe('Phase 4: BOM 기반 자재 차감', () => {
  // 테스트 전 데이터 초기화
  beforeEach(() => {
    resetBOMData()
    resetStockData()
  })

  // ============================================
  // 1. BOM 소요량 조회
  // ============================================
  describe('BOM 소요량 조회', () => {
    beforeEach(() => {
      // 테스트용 자재 추가
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockMaterial({ id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' })

      // 테스트용 BOM 추가
      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 2.5,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })
      addMockBOM({
        id: 2,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 2,
        quantity: 2,
        unit: 'EA',
        processCode: 'CA',
        material: { id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' },
      })
    })

    it('제품별 BOM 소요량 조회', async () => {
      const requirements = await getBOMRequirements(100)

      expect(requirements).toHaveLength(2)
      expect(requirements[0].materialCode).toBe('WIRE-001')
      expect(requirements[0].quantityPerUnit).toBe(2.5)
      expect(requirements[1].materialCode).toBe('TERMINAL-001')
      expect(requirements[1].quantityPerUnit).toBe(2)
    })

    it('공정별 BOM 소요량 조회', async () => {
      // 다른 공정 BOM 추가
      addMockBOM({
        id: 3,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 1,
        unit: 'M',
        processCode: 'MC',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })

      const caRequirements = await getBOMRequirements(100, 'CA')
      expect(caRequirements).toHaveLength(2)

      const mcRequirements = await getBOMRequirements(100, 'MC')
      expect(mcRequirements).toHaveLength(1)
    })

    it('BOM 존재 여부 확인', async () => {
      expect(await hasBOM(100)).toBe(true)
      expect(await hasBOM(100, 'CA')).toBe(true)
      expect(await hasBOM(100, 'XX')).toBe(false)
      expect(await hasBOM(999)).toBe(false)
    })

    it('공정별 BOM 항목 수 조회', async () => {
      const counts = await getBOMCountByProcess(100)
      expect(counts['CA']).toBe(2)
    })
  })

  // ============================================
  // 2. 필요 자재 수량 계산
  // ============================================
  describe('필요 자재 수량 계산', () => {
    beforeEach(() => {
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 2,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })
    })

    it('생산 수량에 따른 필요량 계산', async () => {
      const requirements = await calculateRequiredMaterials(100, 'CA', 10)

      expect(requirements).toHaveLength(1)
      expect(requirements[0].materialCode).toBe('WIRE-001')
      expect(requirements[0].quantityPerUnit).toBe(2)
      expect(requirements[0].requiredQty).toBe(20) // 2 * 10
    })

    it('다양한 생산 수량 테스트', async () => {
      const req1 = await calculateRequiredMaterials(100, 'CA', 1)
      expect(req1[0].requiredQty).toBe(2)

      const req50 = await calculateRequiredMaterials(100, 'CA', 50)
      expect(req50[0].requiredQty).toBe(100)

      const req100 = await calculateRequiredMaterials(100, 'CA', 100)
      expect(req100[0].requiredQty).toBe(200)
    })
  })

  // ============================================
  // 3. FIFO 자재 차감
  // ============================================
  describe('FIFO 자재 차감', () => {
    beforeEach(() => {
      // LOT별 재고 추가 (오래된 순)
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'LOT-001',
        quantity: 50,
        usedQty: 0,
        availableQty: 50,
        receivedAt: new Date('2024-01-01'),
      })
      addMockStock({
        id: 2,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'LOT-002',
        quantity: 30,
        usedQty: 0,
        availableQty: 30,
        receivedAt: new Date('2024-01-02'),
      })
    })

    it('FIFO 순서로 차감 (첫 번째 LOT에서 충분)', async () => {
      const result = await consumeStockFIFOWithNegative(1, 30)

      expect(result.deductedQty).toBe(30)
      expect(result.remainingQty).toBe(0)
      expect(result.lots).toHaveLength(1)
      expect(result.lots[0].lotNumber).toBe('LOT-001')
      expect(result.lots[0].usedQty).toBe(30)
    })

    it('FIFO 순서로 차감 (여러 LOT 사용)', async () => {
      const result = await consumeStockFIFOWithNegative(1, 60)

      expect(result.deductedQty).toBe(60)
      expect(result.remainingQty).toBe(0)
      expect(result.lots).toHaveLength(2)
      expect(result.lots[0].lotNumber).toBe('LOT-001')
      expect(result.lots[0].usedQty).toBe(50)
      expect(result.lots[1].lotNumber).toBe('LOT-002')
      expect(result.lots[1].usedQty).toBe(10)
    })

    it('가용 재고 확인', async () => {
      const available = await getAvailableQty(1)
      expect(available).toBe(80) // 50 + 30
    })
  })

  // ============================================
  // 4. 음수 재고 허용 차감
  // ============================================
  describe('음수 재고 허용', () => {
    beforeEach(() => {
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'LOT-001',
        quantity: 50,
        usedQty: 0,
        availableQty: 50,
        receivedAt: new Date('2024-01-01'),
      })
    })

    it('음수 허용 시 가용 재고 초과 차감', async () => {
      const result = await consumeStockFIFOWithNegative(1, 100, undefined, true)

      expect(result.deductedQty).toBe(100)
      expect(result.remainingQty).toBe(0)
      expect(result.lots[0].usedQty).toBe(100) // 가용 50 + 음수 50

      const available = await getAvailableQty(1)
      expect(available).toBe(-50) // 음수 재고
    })

    it('음수 불허용 시 가용 재고만 차감', async () => {
      const result = await consumeStockFIFOWithNegative(1, 100, undefined, false)

      expect(result.deductedQty).toBe(50) // 가용 재고만
      expect(result.remainingQty).toBe(50) // 미차감

      const available = await getAvailableQty(1)
      expect(available).toBe(0) // 재고 소진
    })
  })

  // ============================================
  // 5. BOM 기반 자재 차감
  // ============================================
  describe('BOM 기반 자재 차감', () => {
    beforeEach(() => {
      // BOM 설정
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockMaterial({ id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' })

      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 2,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })
      addMockBOM({
        id: 2,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 2,
        quantity: 2,
        unit: 'EA',
        processCode: 'CA',
        material: { id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' },
      })

      // 재고 설정
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'WIRE-LOT-001',
        quantity: 100,
        usedQty: 0,
        availableQty: 100,
        receivedAt: new Date(),
      })
      addMockStock({
        id: 2,
        materialId: 2,
        materialCode: 'TERMINAL-001',
        materialName: '터미널',
        lotNumber: 'TERM-LOT-001',
        quantity: 100,
        usedQty: 0,
        availableQty: 100,
        receivedAt: new Date(),
      })
    })

    it('BOM 기반 자재 차감 성공', async () => {
      const result = await deductByBOM(100, 'CA', 10)

      expect(result.success).toBe(true)
      expect(result.productId).toBe(100)
      expect(result.processCode).toBe('CA')
      expect(result.productionQty).toBe(10)
      expect(result.totalRequired).toBe(40) // (2*10) + (2*10)
      expect(result.totalDeducted).toBe(40)
      expect(result.items).toHaveLength(2)
      expect(result.errors).toHaveLength(0)

      // 재고 확인
      expect(await getAvailableQty(1)).toBe(80) // 100 - 20
      expect(await getAvailableQty(2)).toBe(80) // 100 - 20
    })

    it('BOM이 없는 경우 빈 결과 반환', async () => {
      const result = await deductByBOM(999, 'CA', 10)

      expect(result.success).toBe(true)
      expect(result.items).toHaveLength(0)
      expect(result.totalRequired).toBe(0)
    })

    it('음수 재고 허용으로 부족분 처리', async () => {
      // 대량 생산으로 재고 부족 상황
      const result = await deductByBOM(100, 'CA', 100, [], true)

      expect(result.success).toBe(true)
      expect(result.totalRequired).toBe(400) // (2*100) + (2*100)

      // 음수 재고 확인
      const wireAvailable = await getAvailableQty(1)
      const termAvailable = await getAvailableQty(2)

      expect(wireAvailable).toBe(-100) // 100 - 200
      expect(termAvailable).toBe(-100) // 100 - 200
    })
  })

  // ============================================
  // 6. 차감 롤백
  // ============================================
  describe('차감 롤백', () => {
    beforeEach(() => {
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 2,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'LOT-001',
        quantity: 100,
        usedQty: 0,
        availableQty: 100,
        receivedAt: new Date(),
      })
    })

    it('차감 후 롤백으로 재고 복원', async () => {
      // 차감
      const productionLotId = 1
      await deductByBOM(100, 'CA', 10, [], true, productionLotId)

      expect(await getAvailableQty(1)).toBe(80)

      // 롤백
      const restoredCount = await rollbackBOMDeduction(productionLotId)
      expect(restoredCount).toBe(1)

      // 재고 복원 확인
      expect(await getAvailableQty(1)).toBe(100)
    })
  })

  // ============================================
  // 7. 가용 재고 확인
  // ============================================
  describe('가용 재고 확인', () => {
    beforeEach(() => {
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockMaterial({ id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' })

      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 10,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })
      addMockBOM({
        id: 2,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 2,
        quantity: 5,
        unit: 'EA',
        processCode: 'CA',
        material: { id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' },
      })

      // 전선: 충분, 터미널: 부족
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'WIRE-LOT-001',
        quantity: 1000,
        usedQty: 0,
        availableQty: 1000,
        receivedAt: new Date(),
      })
      addMockStock({
        id: 2,
        materialId: 2,
        materialCode: 'TERMINAL-001',
        materialName: '터미널',
        lotNumber: 'TERM-LOT-001',
        quantity: 30, // 10개 생산 시 50개 필요, 30개만 보유
        usedQty: 0,
        availableQty: 30,
        receivedAt: new Date(),
      })
    })

    it('충분한 재고 확인', async () => {
      const result = await checkBOMAvailability(100, 'CA', 5)

      expect(result.available).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(result.items.every((i) => i.shortage === 0)).toBe(true)
    })

    it('부족한 재고 확인', async () => {
      const result = await checkBOMAvailability(100, 'CA', 10)

      expect(result.available).toBe(false)

      const wireItem = result.items.find((i) => i.materialCode === 'WIRE-001')
      const termItem = result.items.find((i) => i.materialCode === 'TERMINAL-001')

      expect(wireItem?.shortage).toBe(0) // 전선: 충분
      expect(termItem?.shortage).toBe(20) // 터미널: 50 필요, 30 보유 → 20 부족
    })
  })

  // ============================================
  // 8. 복합 시나리오
  // ============================================
  describe('복합 시나리오', () => {
    it('전체 생산 워크플로우', async () => {
      // 1. BOM 설정
      addMockMaterial({ id: 1, code: 'WIRE-001', name: '전선', unit: 'M' })
      addMockBOM({
        id: 1,
        productId: 100,
        itemType: 'MATERIAL',
        materialId: 1,
        quantity: 5,
        unit: 'M',
        processCode: 'CA',
        material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
      })

      // 2. 재고 입고
      addMockStock({
        id: 1,
        materialId: 1,
        materialCode: 'WIRE-001',
        materialName: '전선',
        lotNumber: 'LOT-001',
        quantity: 100,
        usedQty: 0,
        availableQty: 100,
        receivedAt: new Date(),
      })

      // 3. 가용 재고 확인
      const availability = await checkBOMAvailability(100, 'CA', 10)
      expect(availability.available).toBe(true)

      // 4. 자재 차감
      const deduction = await deductByBOM(100, 'CA', 10, [], true, 1)
      expect(deduction.success).toBe(true)
      expect(deduction.totalDeducted).toBe(50) // 5 * 10

      // 5. 재고 확인
      expect(await getAvailableQty(1)).toBe(50)

      // 6. 추가 생산 (음수 허용)
      const deduction2 = await deductByBOM(100, 'CA', 20, [], true, 2)
      expect(deduction2.success).toBe(true)
      expect(deduction2.totalDeducted).toBe(100)

      // 7. 음수 재고 확인
      expect(await getAvailableQty(1)).toBe(-50)

      // 8. 두 번째 생산 롤백
      await rollbackBOMDeduction(2)
      expect(await getAvailableQty(1)).toBe(50)
    })
  })
})
