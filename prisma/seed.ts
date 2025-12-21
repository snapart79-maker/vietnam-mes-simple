/**
 * Prisma Seed Script
 *
 * 초기 데이터 생성
 * - 관리자 계정
 * - 기본 라인
 * - 샘플 자재/제품
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SALT_ROUNDS = 12

async function main() {
  console.log('🌱 Seeding database...')

  // 0. 공정 마스터 생성 (MBOM용)
  const processes = [
    { code: 'CA', name: '자동절단압착', seq: 10, hasMaterialInput: true, isInspection: false, shortCode: 'C', description: '전선 절단 및 자동 압착' },
    { code: 'MS', name: '중간스트립', seq: 20, hasMaterialInput: false, isInspection: false, shortCode: 'S', description: '중간 탈피 작업' },
    { code: 'MC', name: '수동압착', seq: 30, hasMaterialInput: true, isInspection: false, shortCode: 'M', description: '수동 압착 및 연결' },
    { code: 'SB', name: '서브조립', seq: 40, hasMaterialInput: true, isInspection: false, shortCode: 'B', description: '그로멧, 씰, 튜브류 조립' },
    { code: 'HS', name: '열수축', seq: 50, hasMaterialInput: false, isInspection: false, shortCode: 'H', description: '열수축 튜브 수축' },
    { code: 'CQ', name: '압착검사', seq: 60, hasMaterialInput: false, isInspection: true, shortCode: 'Q', description: '압착 품질 검사' },
    { code: 'SP', name: '제품조립제공부품', seq: 70, hasMaterialInput: true, isInspection: false, shortCode: 'P', description: '조립 자재 키팅' },
    { code: 'PA', name: '제품조립', seq: 80, hasMaterialInput: true, isInspection: false, shortCode: 'A', description: '커넥터, 하우징 조립' },
    { code: 'CI', name: '회로검사', seq: 90, hasMaterialInput: false, isInspection: true, shortCode: 'I', description: '회로 연결 검사' },
    { code: 'VI', name: '육안검사', seq: 100, hasMaterialInput: false, isInspection: true, shortCode: 'V', description: '외관 육안 검사' },
  ]

  for (const proc of processes) {
    await prisma.process.upsert({
      where: { code: proc.code },
      update: {},
      create: {
        code: proc.code,
        name: proc.name,
        seq: proc.seq,
        hasMaterialInput: proc.hasMaterialInput,
        isInspection: proc.isInspection,
        shortCode: proc.shortCode,
        description: proc.description,
        isActive: true,
      },
    })
  }
  console.log(`✅ ${processes.length} processes created`)

  // 1. 관리자 계정 생성
  const adminPassword = await bcrypt.hash('admin', SALT_ROUNDS)
  const operatorPassword = await bcrypt.hash('1234', SALT_ROUNDS)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '관리자',
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log(`✅ Admin user created: ${admin.username}`)

  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      username: 'operator',
      password: operatorPassword,
      name: '작업자1',
      role: 'OPERATOR',
      isActive: true,
    },
  })
  console.log(`✅ Operator user created: ${operator.username}`)

  // 2. 기본 라인 생성
  const lines = [
    { code: 'CA-01', name: 'CA 1호기', processCode: 'CA' },
    { code: 'CA-02', name: 'CA 2호기', processCode: 'CA' },
    { code: 'MC-01', name: 'MC 1호기', processCode: 'MC' },
    { code: 'PA-01', name: 'PA 1호기', processCode: 'PA' },
    { code: 'PA-02', name: 'PA 2호기', processCode: 'PA' },
  ]

  for (const line of lines) {
    await prisma.line.upsert({
      where: { code: line.code },
      update: {},
      create: {
        code: line.code,
        name: line.name,
        processCode: line.processCode,
        isActive: true,
      },
    })
  }
  console.log(`✅ ${lines.length} lines created`)

  // 3. 샘플 자재 생성
  const materials = [
    { code: 'MAT-001', name: '전선 (2.5mm)', spec: '2.5mm / Red', category: '원자재', unit: 'M', safeStock: 100 },
    { code: 'MAT-002', name: '터미널 (Ring)', spec: 'R-Type / Ø4', category: '부자재', unit: 'EA', safeStock: 500 },
    { code: 'MAT-003', name: '수축 튜브', spec: 'Ø3 / Black', category: '부자재', unit: 'M', safeStock: 50 },
    { code: 'MAT-004', name: '커넥터 (2P)', spec: 'Housing 2P', category: '부자재', unit: 'EA', safeStock: 300 },
    { code: 'MAT-005', name: '라벨 용지', spec: '40x20mm', category: '소모품', unit: 'Roll', safeStock: 500 },
  ]

  for (const mat of materials) {
    await prisma.material.upsert({
      where: { code: mat.code },
      update: {},
      create: {
        code: mat.code,
        name: mat.name,
        spec: mat.spec,
        category: mat.category,
        unit: mat.unit,
        safeStock: mat.safeStock,
        isActive: true,
      },
    })
  }
  console.log(`✅ ${materials.length} materials created`)

  // 4. 샘플 제품 생성
  const products = [
    { code: 'P001', name: '와이어하네스 A', spec: 'WH-A Type', type: 'FINISHED', processCode: 'PA' },
    { code: 'P002', name: '와이어하네스 B', spec: 'WH-B Type', type: 'FINISHED', processCode: 'PA' },
    { code: 'CA-P001', name: 'CA 서브 A', spec: 'CA Sub-A', type: 'SEMI_CA', processCode: 'CA' },
    { code: 'MC-P001', name: 'MC 서브 A', spec: 'MC Sub-A', type: 'SEMI_MC', processCode: 'MC' },
  ]

  for (const prod of products) {
    await prisma.product.upsert({
      where: { code: prod.code },
      update: {},
      create: {
        code: prod.code,
        name: prod.name,
        spec: prod.spec,
        type: prod.type as 'FINISHED' | 'SEMI_CA' | 'SEMI_MC',
        processCode: prod.processCode,
        isActive: true,
      },
    })
  }
  console.log(`✅ ${products.length} products created`)

  // 5. 앱 설정 초기화
  const settings = [
    { key: 'daily_production_target', value: '2000', description: '일일 생산 목표' },
    { key: 'barcode_version', value: '2', description: '바코드 버전 (1 또는 2)' },
    { key: 'enable_safety_stock_warning', value: 'true', description: '안전재고 경고 활성화' },
  ]

  for (const setting of settings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    })
  }
  console.log(`✅ ${settings.length} app settings created`)

  console.log('\n🎉 Seeding completed!')
  console.log('\n📋 Login credentials:')
  console.log('   - Admin: admin / admin')
  console.log('   - Operator: operator / 1234')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
