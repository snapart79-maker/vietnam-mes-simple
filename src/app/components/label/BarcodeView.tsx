/**
 * Barcode View Component
 *
 * 1D 바코드 표시 컴포넌트
 * - JsBarcode 사용
 * - Code128 포맷
 * - SVG/Canvas 렌더링
 */
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE128A'
  | 'CODE128B'
  | 'CODE128C'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'

export interface BarcodeViewProps {
  value: string
  format?: BarcodeFormat
  width?: number
  height?: number
  displayValue?: boolean
  fontSize?: number
  textMargin?: number
  margin?: number
  lineColor?: string
  background?: string
  flat?: boolean
  className?: string
}

export function BarcodeView({
  value,
  format = 'CODE128',
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 12,
  textMargin = 2,
  margin = 10,
  lineColor = '#000000',
  background = '#ffffff',
  flat = false,
  className = '',
}: BarcodeViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          textMargin,
          margin,
          lineColor,
          background,
          flat,
        })
      } catch (error) {
        console.error('바코드 생성 오류:', error)
      }
    }
  }, [
    value,
    format,
    width,
    height,
    displayValue,
    fontSize,
    textMargin,
    margin,
    lineColor,
    background,
    flat,
  ])

  if (!value) {
    return (
      <div className={`flex items-center justify-center p-4 text-gray-400 ${className}`}>
        바코드 값이 없습니다
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg ref={svgRef} />
    </div>
  )
}

/**
 * 바코드를 이미지 Data URL로 변환
 */
export function getBarcodeDataUrl(
  value: string,
  options?: Partial<BarcodeViewProps>
): string {
  const canvas = document.createElement('canvas')

  try {
    JsBarcode(canvas, value, {
      format: options?.format || 'CODE128',
      width: options?.width || 2,
      height: options?.height || 50,
      displayValue: options?.displayValue ?? true,
      fontSize: options?.fontSize || 12,
      margin: options?.margin || 10,
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('바코드 Data URL 생성 오류:', error)
    throw new Error('바코드 생성에 실패했습니다.')
  }
}

export default BarcodeView
