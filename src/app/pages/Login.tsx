/**
 * Login Page
 *
 * 실제 인증 연동 (AuthContext + bcrypt)
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Eye, EyeOff, Loader2, Languages, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const Login = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState<'KO' | 'VI'>('KO')
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 이미 인증된 경우 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // 에러 메시지 초기화
  useEffect(() => {
    if (localError || authError) {
      const timer = setTimeout(() => {
        setLocalError(null)
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [localError, authError, clearError])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // 유효성 검사
    if (!formData.username.trim()) {
      setLocalError(language === 'KO' ? '사용자 ID를 입력하세요' : 'Vui lòng nhập ID')
      return
    }
    if (!formData.password) {
      setLocalError(language === 'KO' ? '비밀번호를 입력하세요' : 'Vui lòng nhập mật khẩu')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await login(formData.username.trim(), formData.password)

      if (result.success) {
        navigate('/dashboard')
      } else {
        setLocalError(
          result.error ||
            (language === 'KO' ? '로그인에 실패했습니다' : 'Đăng nhập thất bại')
        )
      }
    } catch (err) {
      setLocalError(
        language === 'KO' ? '서버 오류가 발생했습니다' : 'Lỗi máy chủ'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'KO' ? 'VI' : 'KO'))
  }

  const displayError = localError || authError

  // 로딩 중이면 스피너 표시
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-white/10"
          onClick={toggleLanguage}
        >
          <Languages size={16} className="mr-2" />
          {language === 'KO' ? '한국어' : 'Tiếng Việt'}
        </Button>
      </div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-slate-700 relative z-10">
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto flex items-center justify-center mb-2">
            <span className="text-white text-2xl font-bold">B</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Barcord System
          </CardTitle>
          <CardDescription>
            {language === 'KO'
              ? '생산 관리 시스템에 접속합니다'
              : 'Truy cập hệ thống quản lý sản xuất'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 에러 메시지 */}
            {displayError && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle size={16} />
                <span>{displayError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">
                {language === 'KO' ? '사용자 ID' : 'ID người dùng'}
              </Label>
              <Input
                id="username"
                placeholder={
                  language === 'KO' ? 'ID를 입력하세요' : 'Nhập ID của bạn'
                }
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {language === 'KO' ? '비밀번호' : 'Mật khẩu'}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={
                    language === 'KO'
                      ? '비밀번호를 입력하세요'
                      : 'Nhập mật khẩu'
                  }
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSubmitting
                ? language === 'KO'
                  ? '로그인 중...'
                  : 'Đang đăng nhập...'
                : language === 'KO'
                  ? '로그인'
                  : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-xs text-slate-500 text-center">
            {language === 'KO'
              ? '문의사항은 시스템 관리자에게 연락바랍니다.'
              : 'Liên hệ quản trị viên nếu cần hỗ trợ.'}
            <br />
            v1.0.0
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Login
