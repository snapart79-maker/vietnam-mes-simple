/**
 * Auth Service (Mock)
 *
 * 브라우저 개발용 Mock 인증 서비스
 */

export type UserRole = 'ADMIN' | 'OPERATOR'

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

// Admin 암호 (데이터 초기화 시 사용)
const ADMIN_PASSWORD = 'admin'

// Mock 사용자 데이터 (admin만 유지 - 공장초기화 상태)
const MOCK_USERS: Array<{ username: string; password: string; user: AuthUser }> = [
  {
    username: 'admin',
    password: ADMIN_PASSWORD,
    user: {
      id: 1,
      username: 'admin',
      name: '관리자',
      role: 'ADMIN',
      isActive: true,
    },
  },
]

// 현재 세션
let currentSession: AuthUser | null = null

/**
 * 로그인
 */
export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 500))

  const found = MOCK_USERS.find(
    (u) => u.username === username && u.password === password
  )

  if (!found) {
    return {
      success: false,
      error: '아이디 또는 비밀번호가 일치하지 않습니다.',
    }
  }

  currentSession = found.user

  // localStorage에 저장
  if (typeof window !== 'undefined') {
    localStorage.setItem('mockUser', JSON.stringify(found.user))
  }

  return {
    success: true,
    user: found.user,
  }
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  currentSession = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mockUser')
  }
}

/**
 * 현재 사용자 조회
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (currentSession) {
    return currentSession
  }

  // localStorage에서 복원
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('mockUser')
    if (stored) {
      currentSession = JSON.parse(stored)
      return currentSession
    }
  }

  return null
}

/**
 * 세션 갱신
 */
export async function refreshSession(): Promise<boolean> {
  return currentSession !== null
}

/**
 * 비밀번호 변경 (Mock)
 */
export async function changePassword(
  _userId: number,
  _currentPassword: string,
  _newPassword: string
): Promise<{ success: boolean; error?: string }> {
  await new Promise((r) => setTimeout(r, 300))
  return { success: true }
}

/**
 * 권한 확인
 */
export function hasRole(
  user: AuthUser | null,
  requiredRole: UserRole
): boolean {
  if (!user) return false
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

/**
 * 관리자 암호 검증 (데이터 초기화용)
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 200))
  return password === ADMIN_PASSWORD
}

/**
 * 사용자 데이터 초기화 (admin 제외한 모든 사용자 삭제)
 */
export function resetUserData(): number {
  // admin을 제외한 사용자 수
  const deletedCount = MOCK_USERS.length - 1

  // admin만 남기고 나머지 삭제
  const adminUser = MOCK_USERS.find((u) => u.username === 'admin')
  MOCK_USERS.length = 0
  if (adminUser) {
    MOCK_USERS.push(adminUser)
  }

  return deletedCount
}
