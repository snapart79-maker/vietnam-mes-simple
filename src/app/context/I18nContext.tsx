/**
 * I18n Context Provider
 *
 * 다국어 지원을 위한 Context Provider
 */
import { useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  I18nContext,
  type Locale,
  type I18nContextType,
  translate,
  getStoredLocale,
  storeLocale,
} from '@/lib/i18n'

interface I18nProviderProps {
  children: ReactNode
  defaultLocale?: Locale
}

export function I18nProvider({
  children,
  defaultLocale,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    defaultLocale || getStoredLocale()
  )

  // 언어 변경
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    storeLocale(newLocale)
  }, [])

  // 번역 함수
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(locale, key, params)
    },
    [locale]
  )

  // Context 값
  const contextValue = useMemo<I18nContextType>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  )

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  )
}

export default I18nProvider
