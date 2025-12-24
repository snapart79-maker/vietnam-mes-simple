/**
 * Auth Context
 *
 * 사용자 인증 상태 관리 (localStorage 기반)
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

// ============================================
// Types
// ============================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'INSPECTOR' | 'VIEWER'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: UserRole
  department?: string
  createdAt: Date
  lastLoginAt?: Date
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  error?: string
}

// ============================================
// Local Auth Service (localStorage 기반)
// ============================================

const AUTH_STORAGE_KEY = 'vietnam_mes_auth_user'
const AUTH_SESSION_KEY = 'vietnam_mes_auth_session'

// 기본 사용자 (admin)
const DEFAULT_USERS: Record<string, { password: string; user: AuthUser }> = {
  admin: {
    password: 'admin',
    user: {
      id: 'admin',
      username: 'admin',
      name: '관리자',
      role: 'ADMIN',
      department: 'IT',
      createdAt: new Date('2024-01-01'),
    },
  },
  operator: {
    password: '1234',
    user: {
      id: 'operator',
      username: 'operator',
      name: '작업자',
      role: 'OPERATOR',
      department: '생산',
      createdAt: new Date('2024-01-01'),
    },
  },
}

const authService = {
  async login(username: string, password: string): Promise<LoginResult> {
    const userData = DEFAULT_USERS[username]
    if (!userData) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' }
    }
    if (userData.password !== password) {
      return { success: false, error: '비밀번호가 일치하지 않습니다.' }
    }
    const user = { ...userData.user, lastLoginAt: new Date() }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    localStorage.setItem(AUTH_SESSION_KEY, Date.now().toString())
    return { success: true, user }
  },

  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_SESSION_KEY)
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) return null
      const user = JSON.parse(stored) as AuthUser
      user.createdAt = new Date(user.createdAt)
      if (user.lastLoginAt) user.lastLoginAt = new Date(user.lastLoginAt)
      return user
    } catch {
      return null
    }
  },

  async refreshSession(): Promise<boolean> {
    const session = localStorage.getItem(AUTH_SESSION_KEY)
    if (!session) return false
    const sessionTime = parseInt(session, 10)
    const now = Date.now()
    // 세션 유효시간: 8시간
    if (now - sessionTime > 8 * 60 * 60 * 1000) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(AUTH_SESSION_KEY)
      return false
    }
    localStorage.setItem(AUTH_SESSION_KEY, now.toString())
    return true
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const userData = Object.values(DEFAULT_USERS).find(u => u.user.id === userId)
    if (!userData) return { success: false, error: '사용자를 찾을 수 없습니다.' }
    if (userData.password !== currentPassword) return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' }
    // 실제로는 서버에 저장해야 하지만 로컬에서는 불가
    console.warn('[AuthContext] changePassword: 로컬에서는 비밀번호 변경이 저장되지 않습니다.')
    return { success: true }
  },

  hasRole(user: AuthUser | null, role: UserRole): boolean {
    return user?.role === role
  },

  hasMinimumRole(user: AuthUser | null, role: UserRole): boolean {
    if (!user) return false
    const hierarchy: UserRole[] = ['VIEWER', 'INSPECTOR', 'OPERATOR', 'MANAGER', 'ADMIN']
    const userLevel = hierarchy.indexOf(user.role)
    const requiredLevel = hierarchy.indexOf(role)
    return userLevel >= requiredLevel
  },
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  // 인증
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  // 비밀번호
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  // 권한 체크
  hasRole: (role: UserRole) => boolean
  hasMinimumRole: (role: UserRole) => boolean
  isAdmin: () => boolean
  isOperator: () => boolean
  // 유틸
  refreshSession: () => Promise<void>
  clearError: () => void
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ============================================
// Provider
// ============================================

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  // 초기 로드 - 저장된 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await authService.getCurrentUser()
        setState({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          error: null,
        })
      } catch {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      }
    }

    checkSession()
  }, [])

  // 세션 자동 갱신 (5분마다)
  useEffect(() => {
    if (!state.isAuthenticated) return

    const interval = setInterval(async () => {
      const refreshed = await authService.refreshSession()
      if (!refreshed) {
        // 세션 만료
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: '세션이 만료되었습니다. 다시 로그인해주세요.',
        })
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [state.isAuthenticated])

  // 로그인
  const login = useCallback(async (
    username: string,
    password: string
  ): Promise<LoginResult> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await authService.login(username, password)

      if (result.success && result.user) {
        setState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || '로그인 실패',
        }))
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : '로그인 오류'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }))
      return { success: false, error }
    }
  }, [])

  // 로그아웃
  const logout = useCallback(async (): Promise<void> => {
    await authService.logout()
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  }, [])

  // 비밀번호 변경
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!state.user) {
      return { success: false, error: '로그인이 필요합니다.' }
    }

    return authService.changePassword(state.user.id, currentPassword, newPassword)
  }, [state.user])

  // 세션 갱신
  const refreshSession = useCallback(async (): Promise<void> => {
    const refreshed = await authService.refreshSession()
    if (!refreshed && state.isAuthenticated) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: '세션이 만료되었습니다.',
      })
    }
  }, [state.isAuthenticated])

  // 권한 체크
  const hasRole = useCallback((role: UserRole): boolean => {
    return authService.hasRole(state.user, role)
  }, [state.user])

  const hasMinimumRole = useCallback((role: UserRole): boolean => {
    return authService.hasMinimumRole(state.user, role)
  }, [state.user])

  const isAdmin = useCallback((): boolean => {
    return state.user?.role === 'ADMIN'
  }, [state.user])

  const isOperator = useCallback((): boolean => {
    return state.user?.role === 'OPERATOR' || state.user?.role === 'ADMIN'
  }, [state.user])

  // 에러 초기화
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    changePassword,
    hasRole,
    hasMinimumRole,
    isAdmin,
    isOperator,
    refreshSession,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================
// Hook
// ============================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// ============================================
// HOC for Protected Routes
// ============================================

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasMinimumRole } = useAuth()

  if (isLoading) {
    return fallback || <div>로딩 중...</div>
  }

  if (!isAuthenticated) {
    return fallback || <div>로그인이 필요합니다.</div>
  }

  if (requiredRole && !hasMinimumRole(requiredRole)) {
    return fallback || <div>권한이 없습니다. ({requiredRole} 이상 필요)</div>
  }

  return <>{children}</>
}

// ============================================
// Utility Components
// ============================================

interface ShowForRoleProps {
  role: UserRole
  children: ReactNode
}

export function ShowForRole({ role, children }: ShowForRoleProps) {
  const { hasMinimumRole } = useAuth()

  if (!hasMinimumRole(role)) {
    return null
  }

  return <>{children}</>
}

interface ShowForAdminProps {
  children: ReactNode
}

export function ShowForAdmin({ children }: ShowForAdminProps) {
  const { isAdmin } = useAuth()

  if (!isAdmin()) {
    return null
  }

  return <>{children}</>
}

export default AuthContext
