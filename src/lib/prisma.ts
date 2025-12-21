/**
 * Prisma Client Singleton
 *
 * Development에서 Hot Reload 시 여러 인스턴스 생성 방지
 * Prisma 6.x
 */
import { PrismaClient } from '@prisma/client'

// 전역 타입 확장
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 개발 환경에서는 query 로깅 활성화
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

// 개발 환경에서만 전역 변수에 저장 (Hot Reload 대응)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
