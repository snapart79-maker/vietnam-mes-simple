/**
 * Auth Context
 *
 * 사용자 인증 상태 관리 (Mock 버전 - 브라우저용)
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import * as authService from '../../services/mock/authService.mock'
import type { AuthUser, LoginResult, UserRole } from '../../services/mock/authService.mock'

// ============================================
// Types
// ============================================

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
