/**
 * Stage 1 - Schema Validation Tests
 *
 * 스키마 유효성 검증 테스트
 * - ProductType enum 확장 검증
 * - Product 모델 필드 검증
 * - Process 모델 검증
 * - ProcessRouting 모델 검증
 */
import { describe, it, expect } from 'vitest'
import { Prisma, ProductType } from '@prisma/client'

describe('Schema Validation', () => {
  describe('ProductType Enum', () => {
    it('should have all required product types', () => {
      const requiredTypes = [
        'FINISHED',
        'SEMI_CA',
        'SEMI_MS',
        'SEMI_MC',
        'SEMI_SB',
        'SEMI_HS',
      ]

      const enumValues = Object.values(ProductType)

      requiredTypes.forEach((type) => {
        expect(enumValues).toContain(type)
      })
    })

    it('should have exactly 6 product types', () => {
      expect(Object.keys(ProductType)).toHaveLength(6)
    })
  })

  describe('Prisma Model Fields', () => {
    it('Product model should have MBOM extension fields', () => {
      // Prisma.ProductScalarFieldEnum을 통해 필드 존재 확인
      const productFields = Object.values(Prisma.ProductScalarFieldEnum)

      expect(productFields).toContain('parentCode')
      expect(productFields).toContain('circuitNo')
      expect(productFields).toContain('bundleQty')
    })

    it('Process model should have all required fields', () => {
      const processFields = Object.values(Prisma.ProcessScalarFieldEnum)

      expect(processFields).toContain('code')
      expect(processFields).toContain('name')
      expect(processFields).toContain('seq')
      expect(processFields).toContain('hasMaterialInput')
      expect(processFields).toContain('isInspection')
      expect(processFields).toContain('shortCode')
      expect(processFields).toContain('isActive')
    })

    it('ProcessRouting model should have all required fields', () => {
      const routingFields = Object.values(Prisma.ProcessRoutingScalarFieldEnum)

      expect(routingFields).toContain('productId')
      expect(routingFields).toContain('processCode')
      expect(routingFields).toContain('seq')
      expect(routingFields).toContain('isRequired')
    })
  })
})
