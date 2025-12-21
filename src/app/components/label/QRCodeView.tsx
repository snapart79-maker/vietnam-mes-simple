/**
 * QR Code View Component
 *
 * QR 코드 표시 컴포넌트
 * - qrcode.react 사용
 * - LOT 정보 JSON 인코딩
 * - 다양한 크기 지원
 */
import { QRCodeSVG } from 'qrcode.react'

export interface QRCodeData {
  lotNumber: string
  processCode: string
  productCode?: string
  quantity?: number
  date?: string
}

export interface QRCodeViewProps {
  data: QRCodeData | string
  size?: number
  level?: 'L' | 'M' | 'Q' | 'H'
  includeMargin?: boolean
  fgColor?: string
  bgColor?: string
  showValue?: boolean
  className?: string
}

export function QRCodeView({
  data,
  size = 128,
  level = 'M',
  includeMargin = true,
  fgColor = '#000000',
  bgColor = '#ffffff',
  showValue = false,
  className = '',
}: QRCodeViewProps) {
  // 데이터를 문자열로 변환
  const qrValue =
    typeof data === 'string' ? data : JSON.stringify(data)

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <QRCodeSVG
        value={qrValue}
        size={size}
        level={level}
        includeMargin={includeMargin}
        fgColor={fgColor}
        bgColor={bgColor}
      />
      {showValue && typeof data !== 'string' && (
        <div className="mt-2 text-center text-xs text-gray-600">
          <p className="font-medium">{data.lotNumber}</p>
          {data.processCode && (
            <p className="text-gray-500">{data.processCode}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * LOT 정보를 QR 코드 데이터로 변환
 */
export function createQRData(
  lotNumber: string,
  processCode: string,
  options?: {
    productCode?: string
    quantity?: number
    date?: string
  }
): QRCodeData {
  return {
    lotNumber,
    processCode,
    productCode: options?.productCode,
    quantity: options?.quantity,
    date: options?.date || new Date().toISOString().split('T')[0],
  }
}

export default QRCodeView
