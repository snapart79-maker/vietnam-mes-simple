/**
 * Korean Font Utility for jsPDF
 *
 * jsPDF에서 한글 폰트를 사용하기 위한 유틸리티
 * 로컬 폰트를 우선 사용하고, 실패 시 CDN 폴백
 */
import { jsPDF } from 'jspdf'

// 폰트 캐시 (메모리)
let fontLoaded = false
let fontData: string | null = null

// localStorage 키
const FONT_CACHE_KEY = 'vietnam_mes_korean_font_v3'

// 로컬 폰트 경로 (public 폴더에 번들링됨)
// Vite에서 public 폴더의 파일은 / 루트에서 접근 가능
const LOCAL_FONT_PATHS = [
  '/fonts/D2Coding.ttf',        // 기본 한글 폰트 (4MB)
  './fonts/D2Coding.ttf',       // 상대 경로
  'fonts/D2Coding.ttf',         // 상대 경로 대체
]

// CDN 폴백 소스 (로컬 실패 시)
const CDN_FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/nicapos/korean-fonts@1.0/NanumGothic.ttf',
  'https://unpkg.com/@aspect-ratio/korean-fonts@1.0.0/fonts/NanumGothic-Regular.ttf',
]

// 타임아웃 설정 (ms)
const FETCH_TIMEOUT = 15000

/**
 * localStorage에서 캐시된 폰트 로드
 */
function loadFromCache(): string | null {
  try {
    const cached = localStorage.getItem(FONT_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed.data && parsed.data.length > 100000) {
        console.log('한글 폰트: localStorage 캐시에서 로드됨')
        return parsed.data
      }
    }
  } catch (error) {
    console.warn('폰트 캐시 로드 실패:', error)
  }
  return null
}

/**
 * localStorage에 폰트 캐시 저장
 */
function saveToCache(data: string): void {
  try {
    // 폰트 데이터가 충분히 큰지 확인 (최소 100KB)
    if (data.length < 100000) {
      console.warn('폰트 데이터가 너무 작아 캐시하지 않음:', data.length)
      return
    }

    const cacheData = {
      data,
      timestamp: Date.now(),
    }
    localStorage.setItem(FONT_CACHE_KEY, JSON.stringify(cacheData))
    console.log('한글 폰트: localStorage 캐시에 저장됨')
  } catch (error) {
    // localStorage 용량 초과 등의 오류
    console.warn('폰트 캐시 저장 실패 (용량 초과일 수 있음):', error)
  }
}

/**
 * 타임아웃이 있는 fetch
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * ArrayBuffer를 Base64 문자열로 변환
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192

  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }

  return btoa(binary)
}

/**
 * 단일 URL에서 폰트 로드 시도
 */
async function tryLoadFromUrl(url: string): Promise<string | null> {
  try {
    console.log('한글 폰트 로드 시도:', url)
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT)

    if (!response.ok) {
      console.warn(`폰트 로드 실패 (${response.status}):`, url)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()

    // 폰트 파일 최소 크기 확인 (100KB 이상이어야 전체 한글 폰트)
    if (arrayBuffer.byteLength < 100000) {
      console.warn('폰트 파일이 너무 작음 (서브셋 폰트일 수 있음):', arrayBuffer.byteLength)
      return null
    }

    const base64 = arrayBufferToBase64(arrayBuffer)
    console.log('한글 폰트 로드 성공:', url, '크기:', Math.round(arrayBuffer.byteLength / 1024), 'KB')
    return base64
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('폰트 로드 타임아웃:', url)
    } else {
      console.warn('폰트 로드 오류:', url, error)
    }
    return null
  }
}

/**
 * 한글 폰트 로드 (로컬 우선, CDN 폴백)
 */
export async function loadKoreanFont(): Promise<string | null> {
  // 1. 메모리 캐시 확인
  if (fontLoaded && fontData) {
    console.log('한글 폰트: 메모리 캐시 사용')
    return fontData
  }

  // 2. localStorage 캐시 확인
  const cached = loadFromCache()
  if (cached) {
    fontData = cached
    fontLoaded = true
    return fontData
  }

  // 3. 로컬 폰트 파일 시도 (public 폴더)
  console.log('로컬 폰트 파일 로드 시도...')
  for (const path of LOCAL_FONT_PATHS) {
    const data = await tryLoadFromUrl(path)
    if (data) {
      fontData = data
      fontLoaded = true
      saveToCache(data)
      return fontData
    }
  }

  // 4. CDN 폴백
  console.log('CDN에서 폰트 로드 시도...')
  for (const url of CDN_FONT_URLS) {
    const data = await tryLoadFromUrl(url)
    if (data) {
      fontData = data
      fontLoaded = true
      saveToCache(data)
      return fontData
    }
  }

  console.error('모든 소스에서 한글 폰트 로드 실패!')
  return null
}

/**
 * jsPDF에 한글 폰트 등록
 */
export async function registerKoreanFont(pdf: jsPDF): Promise<boolean> {
  try {
    const font = await loadKoreanFont()
    if (!font) {
      console.error('한글 폰트를 로드할 수 없습니다. PDF에서 한글이 깨질 수 있습니다.')
      return false
    }

    // VFS에 폰트 파일 추가
    pdf.addFileToVFS('KoreanFont.ttf', font)

    // 폰트 등록
    pdf.addFont('KoreanFont.ttf', 'KoreanFont', 'normal')

    // 기본 폰트로 설정
    pdf.setFont('KoreanFont')

    console.log('한글 폰트 등록 완료')
    return true
  } catch (error) {
    console.error('한글 폰트 등록 실패:', error)
    return false
  }
}

/**
 * 한글 폰트 설정 (이미 등록된 경우)
 */
export function setKoreanFont(pdf: jsPDF): void {
  try {
    pdf.setFont('KoreanFont')
  } catch {
    // 폰트가 없으면 기본 폰트 사용
    pdf.setFont('helvetica')
  }
}

/**
 * 폰트 캐시 초기화
 */
export function clearFontCache(): void {
  fontLoaded = false
  fontData = null
  try {
    localStorage.removeItem(FONT_CACHE_KEY)
    console.log('폰트 캐시가 초기화되었습니다')
  } catch (error) {
    console.warn('폰트 캐시 초기화 실패:', error)
  }
}

/**
 * 폰트 로드 상태 확인
 */
export function isFontLoaded(): boolean {
  return fontLoaded && fontData !== null
}

/**
 * 폰트 사전 로드 (앱 시작 시 호출 권장)
 */
export async function preloadKoreanFont(): Promise<boolean> {
  const font = await loadKoreanFont()
  return font !== null
}
