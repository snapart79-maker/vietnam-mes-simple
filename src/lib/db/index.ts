/**
 * Database Connection Utilities
 *
 * PostgreSQL 연결 테스트 및 유틸리티 함수
 */
import { prisma } from '../prisma'

/**
 * 데이터베이스 연결 테스트
 * @returns 연결 성공 여부
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ PostgreSQL 연결 성공')
    return true
  } catch (error) {
    console.error('❌ PostgreSQL 연결 실패:', error)
    return false
  }
}

/**
 * 데이터베이스 연결 종료
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
  console.log('🔌 PostgreSQL 연결 종료')
}

/**
 * 데이터베이스 연결 상태 확인
 */
export async function getConnectionInfo(): Promise<{
  connected: boolean
  database?: string
  version?: string
}> {
  try {
    const result = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`
    return {
      connected: true,
      database: 'vietnam_mes',
      version: result[0]?.version
    }
  } catch {
    return { connected: false }
  }
}

/**
 * 트랜잭션 래퍼
 * 여러 작업을 하나의 트랜잭션으로 실행
 */
export async function withTransaction<T>(
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx as typeof prisma)
  })
}

// Export prisma instance
export { prisma }
