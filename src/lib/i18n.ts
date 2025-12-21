/**
 * Internationalization (i18n) System
 *
 * 다국어 지원 시스템
 * - 한국어 (ko) - 기본
 * - 베트남어 (vi)
 */
import { createContext, useContext } from 'react'
import koLocale from '@/locales/ko.json'
import viLocale from '@/locales/vi.json'

// ============================================
// Types
// ============================================

export type Locale = 'ko' | 'vi'

export type TranslationKey = keyof typeof koLocale

export interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

// ============================================
// Locale Data
// ============================================

type LocaleData = Record<string, string | Record<string, string>>

const locales: Record<Locale, LocaleData> = {
  ko: koLocale as LocaleData,
  vi: viLocale as LocaleData,
}

// ============================================
// Translation Function
// ============================================

/**
 * 번역 함수
 * @param locale 현재 언어
 * @param key 번역 키 (점 표기법 지원: "menu.dashboard")
 * @param params 파라미터 ({count}, {name} 등)
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const translations = locales[locale]

  // 점 표기법으로 중첩 키 접근
  let value = getNestedValue(translations, key)

  // 키를 찾지 못한 경우 기본 언어(한국어)에서 찾기
  if (value === undefined && locale !== 'ko') {
    value = getNestedValue(locales.ko, key)
  }

  // 그래도 없으면 키 자체 반환
  if (value === undefined) {
    console.warn(`Translation key not found: ${key}`)
    return key
  }

  // 파라미터 치환
  if (params) {
    return replaceParams(value, params)
  }

  return value
}

/**
 * 중첩된 객체에서 값 가져오기
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' ? current : undefined
}

/**
 * 파라미터 치환
 */
function replaceParams(
  text: string,
  params: Record<string, string | number>
): string {
  let result = text

  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }

  return result
}

// ============================================
// React Context
// ============================================

export const I18nContext = createContext<I18nContextType | null>(null)

/**
 * i18n Hook
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }

  return context
}

/**
 * 번역 Hook (간편 버전)
 */
export function useTranslation() {
  const { t, locale } = useI18n()
  return { t, locale }
}

// ============================================
// Locale Storage
// ============================================

const LOCALE_STORAGE_KEY = 'vietnam_mes_locale'

/**
 * 저장된 언어 설정 불러오기
 */
export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'ko' || stored === 'vi') {
      return stored
    }
  } catch {
    // localStorage 접근 불가 시 무시
  }

  // 브라우저 언어 감지
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('vi')) {
    return 'vi'
  }

  return 'ko' // 기본값
}

/**
 * 언어 설정 저장
 */
export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage 접근 불가 시 무시
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 지원 언어 목록
 */
export function getSupportedLocales(): { code: Locale; name: string; nativeName: string }[] {
  return [
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  ]
}

/**
 * 언어 이름 가져오기
 */
export function getLocaleName(locale: Locale): string {
  const localeInfo = getSupportedLocales().find((l) => l.code === locale)
  return localeInfo?.nativeName || locale
}

/**
 * 숫자 포맷팅
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'ko-KR').format(value)
}

/**
 * 날짜 포맷팅
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const localeCode = locale === 'vi' ? 'vi-VN' : 'ko-KR'

  return new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(d)
}

/**
 * 상대 시간 포맷팅
 */
export function formatRelativeTime(
  date: Date | string,
  locale: Locale
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  const localeCode = locale === 'vi' ? 'vi-VN' : 'ko-KR'
  const rtf = new Intl.RelativeTimeFormat(localeCode, { numeric: 'auto' })

  if (diffSec < 60) {
    return rtf.format(-diffSec, 'second')
  } else if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute')
  } else if (diffHour < 24) {
    return rtf.format(-diffHour, 'hour')
  } else {
    return rtf.format(-diffDay, 'day')
  }
}
