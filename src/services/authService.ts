/**
 * Auth Service
 *
 * 사용자 인증 서비스
 * - bcrypt 기반 비밀번호 해싱
 * - 로그인/로그아웃
 * - 세션 관리
 */
import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import type { User, UserRole } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface AuthUser {
  id: number
  username: string
  name: string
  role: UserRole
  isActive: boolean
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  error?: string
}

export interface SessionData {
  user: AuthUser
  loginAt: Date
  expiresAt: Date
}

// 세션 저장소 (실제 환경에서는 Redis 등 사용)
const sessions = new Map<string, SessionData>()

// 상수
const SALT_ROUNDS = 12
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8시간

// ============================================
// Password Utilities
// ============================================

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================
// Authentication
// ============================================

/**
 * 로그인
 */
export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      return {
        success: false,
        error: '사용자를 찾을 수 없습니다.',
      }
    }

    // 계정 활성화 상태 확인
    if (!user.isActive) {
      return {
        success: false,
        error: '비활성화된 계정입니다. 관리자에게 문의하세요.',
      }
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return {
        success: false,
        error: '비밀번호가 일치하지 않습니다.',
      }
    }

    // 인증 사용자 정보
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    }

    // 세션 생성
    const sessionId = generateSessionId()
    const now = new Date()

    sessions.set(sessionId, {
      user: authUser,
      loginAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    })

    // 세션 ID 저장 (브라우저 환경에서는 localStorage 사용)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionId', sessionId)
    }

    return {
      success: true,
      user: authUser,
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId) {
      sessions.delete(sessionId)
      localStorage.removeItem('sessionId')
    }
  }
}

/**
 * 현재 사용자 조회
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const sessionId = localStorage.getItem('sessionId')
  if (!sessionId) {
    return null
  }

  const session = sessions.get(sessionId)
  if (!session) {
    localStorage.removeItem('sessionId')
    return null
  }

  // 세션 만료 확인
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId)
    localStorage.removeItem('sessionId')
    return null
  }

  return session.user
}

/**
 * 세션 갱신
 */
export async function refreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  const sessionId = localStorage.getItem('sessionId')
  if (!sessionId) {
    return false
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return false
  }

  // 세션 연장
  session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  return true
}

// ============================================
// User Management
// ============================================

/**
 * 사용자 생성
 */
export async function createUser(data: {
  username: string
  password: string
  name: string
  role?: UserRole
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password)

  return prisma.user.create({
    data: {
      username: data.username,
      password: hashedPassword,
      name: data.name,
      role: data.role || 'OPERATOR',
      isActive: true,
    },
  })
}

/**
 * 비밀번호 변경
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })

  if (!user) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' }
  }

  // 현재 비밀번호 확인
  const isValid = await verifyPassword(currentPassword, user.password)
  if (!isValid) {
    return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' }
  }

  // 새 비밀번호 해싱 및 저장
  const hashedPassword = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  return { success: true }
}

/**
 * 관리자 비밀번호 리셋
 */
export async function resetPassword(
  userId: number,
  newPassword: string
): Promise<void> {
  const hashedPassword = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })
}

/**
 * 사용자 목록 조회
 */
export async function getUsers(options?: {
  role?: UserRole
  isActive?: boolean
}): Promise<AuthUser[]> {
  const { role, isActive } = options || {}

  const users = await prisma.user.findMany({
    where: {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  })

  return users
}

/**
 * 사용자 활성화/비활성화
 */
export async function setUserActive(
  userId: number,
  isActive: boolean
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })

  // 비활성화 시 해당 사용자의 모든 세션 제거
  if (!isActive) {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.user.id === userId) {
        sessions.delete(sessionId)
      }
    }
  }
}

/**
 * 사용자 역할 변경
 */
export async function updateUserRole(
  userId: number,
  role: UserRole
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  })

  // 세션의 역할 정보도 업데이트
  for (const session of sessions.values()) {
    if (session.user.id === userId) {
      session.user.role = role
    }
  }
}

// ============================================
// Authorization
// ============================================

/**
 * 권한 확인
 */
export function hasRole(
  user: AuthUser | null,
  requiredRole: UserRole
): boolean {
  if (!user) return false

  // ADMIN은 모든 권한 보유
  if (user.role === 'ADMIN') return true

  return user.role === requiredRole
}

/**
 * 최소 권한 확인
 */
export function hasMinimumRole(
  user: AuthUser | null,
  minimumRole: UserRole
): boolean {
  if (!user) return false

  const roleOrder: UserRole[] = ['OPERATOR', 'ADMIN']
  const userRoleIndex = roleOrder.indexOf(user.role)
  const minimumRoleIndex = roleOrder.indexOf(minimumRole)

  return userRoleIndex >= minimumRoleIndex
}

// ============================================
// Helpers
// ============================================

/**
 * 세션 ID 생성
 */
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 초기 관리자 계정 생성 (설치 시 한 번만 실행)
 */
export async function createInitialAdmin(): Promise<void> {
  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (!adminExists) {
    await createUser({
      username: 'admin',
      password: 'admin123', // 초기 비밀번호 (변경 필요)
      name: '관리자',
      role: 'ADMIN',
    })
    console.log('초기 관리자 계정 생성됨: admin / admin123')
  }
}
