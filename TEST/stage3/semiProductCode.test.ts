/**
 * Stage 3 - Semi-Product Code Generation Tests
 *
 * 반제품 품번 생성 규칙 테스트
 */
import { describe, it, expect } from 'vitest'
import {
  generateCrimpCode,
  generateMSCode,
  generateSemiCode,
} from '../../src/services/semiProductService'

describe('Semi-Product Code Generation', () => {
  describe('generateCrimpCode', () => {
    it('should generate crimp code with 3-digit circuit number', () => {
      expect(generateCrimpCode('00315452', 1)).toBe('00315452-001')
      expect(generateCrimpCode('00315452', 10)).toBe('00315452-010')
      expect(generateCrimpCode('00315452', 100)).toBe('00315452-100')
    })

    it('should pad circuit number with zeros', () => {
      expect(generateCrimpCode('P001', 1)).toBe('P001-001')
      expect(generateCrimpCode('P001', 5)).toBe('P001-005')
      expect(generateCrimpCode('P001', 99)).toBe('P001-099')
    })

    it('should handle various product codes', () => {
      expect(generateCrimpCode('ABC123', 1)).toBe('ABC123-001')
      expect(generateCrimpCode('PRODUCT-A', 2)).toBe('PRODUCT-A-002')
    })
  })

  describe('generateMSCode', () => {
    it('should prefix crimp code with MS', () => {
      expect(generateMSCode('00315452-001')).toBe('MS00315452-001')
      expect(generateMSCode('00315452-010')).toBe('MS00315452-010')
    })

    it('should handle various crimp codes', () => {
      expect(generateMSCode('P001-001')).toBe('MSP001-001')
      expect(generateMSCode('ABC-123')).toBe('MSABC-123')
    })
  })

  describe('generateSemiCode', () => {
    it('should generate MC code', () => {
      expect(generateSemiCode('MC', '00315452')).toBe('MC00315452')
      expect(generateSemiCode('MC', 'P001')).toBe('MCP001')
    })

    it('should generate SB code', () => {
      expect(generateSemiCode('SB', '00315452')).toBe('SB00315452')
      expect(generateSemiCode('SB', 'P001')).toBe('SBP001')
    })

    it('should generate HS code', () => {
      expect(generateSemiCode('HS', '00315452')).toBe('HS00315452')
      expect(generateSemiCode('HS', 'P001')).toBe('HSP001')
    })
  })

  describe('Code Format Consistency', () => {
    const finishedCode = '00315452'
    const circuitNo = 1

    it('should maintain consistent format across all types', () => {
      const crimpCode = generateCrimpCode(finishedCode, circuitNo)
      const msCode = generateMSCode(crimpCode)
      const mcCode = generateSemiCode('MC', finishedCode)
      const sbCode = generateSemiCode('SB', finishedCode)
      const hsCode = generateSemiCode('HS', finishedCode)

      // 절압품: 00315452-001
      expect(crimpCode).toBe('00315452-001')

      // MS: MS00315452-001 (절압품 기준)
      expect(msCode).toBe('MS00315452-001')

      // MC/SB/HS: 완제품 기준
      expect(mcCode).toBe('MC00315452')
      expect(sbCode).toBe('SB00315452')
      expect(hsCode).toBe('HS00315452')
    })
  })
})
