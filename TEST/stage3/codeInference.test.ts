/**
 * Stage 3 - Code Inference Tests
 *
 * 품번 타입 추론 및 코드 추출 테스트
 */
import { describe, it, expect } from 'vitest'
import {
  inferProductType,
  extractFinishedCode,
  extractCircuitNo,
  isValidProductCode,
  isValidCircuitRange,
} from '../../src/services/semiProductService'

describe('Code Inference', () => {
  describe('inferProductType', () => {
    it('should infer FINISHED for plain codes', () => {
      expect(inferProductType('00315452')).toBe('FINISHED')
      expect(inferProductType('P001')).toBe('FINISHED')
      expect(inferProductType('PRODUCT123')).toBe('FINISHED')
    })

    it('should infer SEMI_CA for codes with hyphen and 3 digits', () => {
      expect(inferProductType('00315452-001')).toBe('SEMI_CA')
      expect(inferProductType('P001-010')).toBe('SEMI_CA')
      expect(inferProductType('ABC-999')).toBe('SEMI_CA')
    })

    it('should infer SEMI_MS for MS prefixed codes', () => {
      expect(inferProductType('MS00315452-001')).toBe('SEMI_MS')
      expect(inferProductType('MSP001-001')).toBe('SEMI_MS')
    })

    it('should infer SEMI_MC for MC prefixed codes', () => {
      expect(inferProductType('MC00315452')).toBe('SEMI_MC')
      expect(inferProductType('MCP001')).toBe('SEMI_MC')
    })

    it('should infer SEMI_SB for SB prefixed codes', () => {
      expect(inferProductType('SB00315452')).toBe('SEMI_SB')
      expect(inferProductType('SBP001')).toBe('SEMI_SB')
    })

    it('should infer SEMI_HS for HS prefixed codes', () => {
      expect(inferProductType('HS00315452')).toBe('SEMI_HS')
      expect(inferProductType('HSP001')).toBe('SEMI_HS')
    })
  })

  describe('extractFinishedCode', () => {
    const finishedCode = '00315452'

    it('should return same code for finished product', () => {
      expect(extractFinishedCode('00315452')).toBe('00315452')
      expect(extractFinishedCode('P001')).toBe('P001')
    })

    it('should extract from crimp code', () => {
      expect(extractFinishedCode('00315452-001')).toBe(finishedCode)
      expect(extractFinishedCode('00315452-010')).toBe(finishedCode)
    })

    it('should extract from MS code', () => {
      expect(extractFinishedCode('MS00315452-001')).toBe(finishedCode)
      expect(extractFinishedCode('MS00315452-010')).toBe(finishedCode)
    })

    it('should extract from MC code', () => {
      expect(extractFinishedCode('MC00315452')).toBe(finishedCode)
    })

    it('should extract from SB code', () => {
      expect(extractFinishedCode('SB00315452')).toBe(finishedCode)
    })

    it('should extract from HS code', () => {
      expect(extractFinishedCode('HS00315452')).toBe(finishedCode)
    })
  })

  describe('extractCircuitNo', () => {
    it('should extract circuit number from crimp code', () => {
      expect(extractCircuitNo('00315452-001')).toBe(1)
      expect(extractCircuitNo('00315452-010')).toBe(10)
      expect(extractCircuitNo('00315452-100')).toBe(100)
    })

    it('should extract circuit number from MS code', () => {
      expect(extractCircuitNo('MS00315452-001')).toBe(1)
      expect(extractCircuitNo('MS00315452-005')).toBe(5)
    })

    it('should return null for codes without circuit number', () => {
      expect(extractCircuitNo('00315452')).toBeNull()
      expect(extractCircuitNo('MC00315452')).toBeNull()
      expect(extractCircuitNo('SB00315452')).toBeNull()
    })

    it('should return null for invalid format', () => {
      expect(extractCircuitNo('00315452-abc')).toBeNull()
      expect(extractCircuitNo('')).toBeNull()
    })
  })

  describe('isValidProductCode', () => {
    it('should validate finished product codes', () => {
      expect(isValidProductCode('00315452')).toBe(true)
      expect(isValidProductCode('P001')).toBe(true)
    })

    it('should validate crimp product codes', () => {
      expect(isValidProductCode('00315452-001')).toBe(true)
      expect(isValidProductCode('P001-010')).toBe(true)
    })

    it('should validate MS codes', () => {
      expect(isValidProductCode('MS00315452-001')).toBe(true)
      expect(isValidProductCode('MSP001-010')).toBe(true)
    })

    it('should validate MC/SB/HS codes', () => {
      expect(isValidProductCode('MC00315452')).toBe(true)
      expect(isValidProductCode('SB00315452')).toBe(true)
      expect(isValidProductCode('HS00315452')).toBe(true)
    })

    it('should reject empty codes', () => {
      expect(isValidProductCode('')).toBe(false)
      expect(isValidProductCode('   ')).toBe(false)
    })
  })

  describe('isValidCircuitRange', () => {
    it('should accept valid range (1-999)', () => {
      expect(isValidCircuitRange(1)).toBe(true)
      expect(isValidCircuitRange(500)).toBe(true)
      expect(isValidCircuitRange(999)).toBe(true)
    })

    it('should reject invalid range', () => {
      expect(isValidCircuitRange(0)).toBe(false)
      expect(isValidCircuitRange(-1)).toBe(false)
      expect(isValidCircuitRange(1000)).toBe(false)
    })
  })
})
