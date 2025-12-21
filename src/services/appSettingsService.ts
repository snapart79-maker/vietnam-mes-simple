/**
 * App Settings Service
 *
 * 애플리케이션 설정 관리 서비스
 * - 키-값 기반 설정 관리
 * - 비즈니스 규칙 설정
 * - 프린터/장치 설정
 */
import { prisma } from '../lib/prisma'

// ============================================
// Types
// ============================================

export interface AppSetting {
  id: number
  key: string
  value: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SettingKeyValue {
  key: string
  value: string
  description?: string
}

// ============================================
// Predefined Setting Keys
// ============================================

export const SETTING_KEYS = {
  // 재고 규칙
  ALLOW_NEGATIVE_STOCK: 'allow_negative_stock',
  ENABLE_SAFETY_STOCK_WARNING: 'enable_safety_stock_warning',

  // BOM 규칙
  BOM_STRICT_MODE: 'bom_strict_mode',
  ENFORCE_FIFO: 'enforce_fifo',

  // 프린터 설정
  LABEL_PRINTER: 'label_printer',
  REPORT_PRINTER: 'report_printer',

  // 라벨 옵션
  LABEL_AUTO_PRINT: 'label_auto_print',
  LABEL_COPIES: 'label_copies',
  LABEL_X_OFFSET: 'label_x_offset',
  LABEL_Y_OFFSET: 'label_y_offset',

  // 시스템 설정
  DAILY_PRODUCTION_TARGET: 'daily_production_target',
  LANGUAGE: 'language',
  TIMEZONE: 'timezone',
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 설정 값 조회
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.appSettings.findUnique({
    where: { key },
  })
  return setting?.value ?? null
}

/**
 * 설정 값 조회 (기본값 포함)
 */
export async function getSettingWithDefault(
  key: string,
  defaultValue: string
): Promise<string> {
  const value = await getSetting(key)
  return value ?? defaultValue
}

/**
 * 설정 값 저장/업데이트
 */
export async function setSetting(
  key: string,
  value: string,
  description?: string
): Promise<AppSetting> {
  return prisma.appSettings.upsert({
    where: { key },
    update: {
      value,
      description: description,
    },
    create: {
      key,
      value,
      description,
    },
  })
}

/**
 * 여러 설정 일괄 저장
 */
export async function setSettings(
  settings: SettingKeyValue[]
): Promise<number> {
  let count = 0

  for (const setting of settings) {
    await setSetting(setting.key, setting.value, setting.description)
    count++
  }

  return count
}

/**
 * 설정 삭제
 */
export async function deleteSetting(key: string): Promise<void> {
  await prisma.appSettings.delete({
    where: { key },
  })
}

/**
 * 전체 설정 조회
 */
export async function getAllSettings(): Promise<AppSetting[]> {
  return prisma.appSettings.findMany({
    orderBy: { key: 'asc' },
  })
}

/**
 * 설정 맵으로 조회
 */
export async function getSettingsMap(): Promise<Record<string, string>> {
  const settings = await getAllSettings()
  const map: Record<string, string> = {}

  for (const setting of settings) {
    map[setting.key] = setting.value
  }

  return map
}

// ============================================
// Boolean Settings Helpers
// ============================================

/**
 * Boolean 설정 조회
 */
export async function getBooleanSetting(
  key: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const value = await getSetting(key)
  if (value === null) return defaultValue
  return value === 'true' || value === '1'
}

/**
 * Boolean 설정 저장
 */
export async function setBooleanSetting(
  key: string,
  value: boolean,
  description?: string
): Promise<AppSetting> {
  return setSetting(key, value ? 'true' : 'false', description)
}

// ============================================
// Number Settings Helpers
// ============================================

/**
 * Number 설정 조회
 */
export async function getNumberSetting(
  key: string,
  defaultValue: number = 0
): Promise<number> {
  const value = await getSetting(key)
  if (value === null) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Number 설정 저장
 */
export async function setNumberSetting(
  key: string,
  value: number,
  description?: string
): Promise<AppSetting> {
  return setSetting(key, value.toString(), description)
}

// ============================================
// Business Rule Settings
// ============================================

/**
 * 비즈니스 규칙 설정 조회
 */
export async function getBusinessRules() {
  const [
    allowNegativeStock,
    enableSafetyStockWarning,
    bomStrictMode,
    enforceFifo,
  ] = await Promise.all([
    getBooleanSetting(SETTING_KEYS.ALLOW_NEGATIVE_STOCK, false),
    getBooleanSetting(SETTING_KEYS.ENABLE_SAFETY_STOCK_WARNING, true),
    getBooleanSetting(SETTING_KEYS.BOM_STRICT_MODE, true),
    getBooleanSetting(SETTING_KEYS.ENFORCE_FIFO, false),
  ])

  return {
    allowNegativeStock,
    enableSafetyStockWarning,
    bomStrictMode,
    enforceFifo,
  }
}

/**
 * 비즈니스 규칙 설정 저장
 */
export async function saveBusinessRules(rules: {
  allowNegativeStock?: boolean
  enableSafetyStockWarning?: boolean
  bomStrictMode?: boolean
  enforceFifo?: boolean
}): Promise<void> {
  const promises: Promise<AppSetting>[] = []

  if (rules.allowNegativeStock !== undefined) {
    promises.push(
      setBooleanSetting(
        SETTING_KEYS.ALLOW_NEGATIVE_STOCK,
        rules.allowNegativeStock,
        '마이너스 재고 허용'
      )
    )
  }

  if (rules.enableSafetyStockWarning !== undefined) {
    promises.push(
      setBooleanSetting(
        SETTING_KEYS.ENABLE_SAFETY_STOCK_WARNING,
        rules.enableSafetyStockWarning,
        '안전 재고 경고 활성화'
      )
    )
  }

  if (rules.bomStrictMode !== undefined) {
    promises.push(
      setBooleanSetting(
        SETTING_KEYS.BOM_STRICT_MODE,
        rules.bomStrictMode,
        'BOM 엄격 모드'
      )
    )
  }

  if (rules.enforceFifo !== undefined) {
    promises.push(
      setBooleanSetting(
        SETTING_KEYS.ENFORCE_FIFO,
        rules.enforceFifo,
        'FIFO 강제 적용'
      )
    )
  }

  await Promise.all(promises)
}

// ============================================
// Printer Settings
// ============================================

/**
 * 프린터 설정 조회
 */
export async function getPrinterSettings() {
  const [labelPrinter, reportPrinter] = await Promise.all([
    getSettingWithDefault(SETTING_KEYS.LABEL_PRINTER, ''),
    getSettingWithDefault(SETTING_KEYS.REPORT_PRINTER, ''),
  ])

  return {
    labelPrinter,
    reportPrinter,
  }
}

/**
 * 프린터 설정 저장
 */
export async function savePrinterSettings(settings: {
  labelPrinter?: string
  reportPrinter?: string
}): Promise<void> {
  const promises: Promise<AppSetting>[] = []

  if (settings.labelPrinter !== undefined) {
    promises.push(
      setSetting(SETTING_KEYS.LABEL_PRINTER, settings.labelPrinter, '라벨 프린터')
    )
  }

  if (settings.reportPrinter !== undefined) {
    promises.push(
      setSetting(SETTING_KEYS.REPORT_PRINTER, settings.reportPrinter, '보고서 프린터')
    )
  }

  await Promise.all(promises)
}

// ============================================
// Label Settings
// ============================================

/**
 * 라벨 설정 조회
 */
export async function getLabelSettings() {
  const [autoPrint, copies, xOffset, yOffset] = await Promise.all([
    getBooleanSetting(SETTING_KEYS.LABEL_AUTO_PRINT, true),
    getNumberSetting(SETTING_KEYS.LABEL_COPIES, 1),
    getNumberSetting(SETTING_KEYS.LABEL_X_OFFSET, 0),
    getNumberSetting(SETTING_KEYS.LABEL_Y_OFFSET, 0),
  ])

  return {
    autoPrint,
    copies,
    xOffset,
    yOffset,
  }
}

/**
 * 라벨 설정 저장
 */
export async function saveLabelSettings(settings: {
  autoPrint?: boolean
  copies?: number
  xOffset?: number
  yOffset?: number
}): Promise<void> {
  const promises: Promise<AppSetting>[] = []

  if (settings.autoPrint !== undefined) {
    promises.push(
      setBooleanSetting(SETTING_KEYS.LABEL_AUTO_PRINT, settings.autoPrint, '자동 라벨 출력')
    )
  }

  if (settings.copies !== undefined) {
    promises.push(
      setNumberSetting(SETTING_KEYS.LABEL_COPIES, settings.copies, '기본 출력 매수')
    )
  }

  if (settings.xOffset !== undefined) {
    promises.push(
      setNumberSetting(SETTING_KEYS.LABEL_X_OFFSET, settings.xOffset, 'X축 오프셋')
    )
  }

  if (settings.yOffset !== undefined) {
    promises.push(
      setNumberSetting(SETTING_KEYS.LABEL_Y_OFFSET, settings.yOffset, 'Y축 오프셋')
    )
  }

  await Promise.all(promises)
}
