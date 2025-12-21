/**
 * Excel Import Dialog
 *
 * Excel 파일 Import UI
 * - 파일 선택 → 시트 선택 → 미리보기 → Import
 */
import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import {
  parseExcelFile,
  getSheetInfo,
  previewData,
  importProducts,
  importMaterials,
  importBOM,
  importStock,
  downloadImportTemplate,
  type SheetInfo,
  type ImportResult,
  type ImportOptions,
} from '@/services/excelImportService'

export type ImportType = 'product' | 'material' | 'bom' | 'stock'

interface ExcelImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importType: ImportType
  onImportComplete?: (result: ImportResult) => void
}

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  product: '제품',
  material: '자재',
  bom: 'BOM',
  stock: '재고',
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  importType,
  onImportComplete,
}: ExcelImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setIsLoading(true)
    try {
      const wb = await parseExcelFile(selectedFile)
      const sheetInfos = getSheetInfo(wb)

      setFile(selectedFile)
      setWorkbook(wb)
      setSheets(sheetInfos)
      setSelectedSheet(sheetInfos[0]?.name || '')

      // 미리보기 데이터 로드
      if (sheetInfos.length > 0) {
        const preview = previewData<Record<string, unknown>>(wb, {
          sheetName: sheetInfos[0].name,
        })
        setPreviewRows(preview)
      }

      setStep('preview')
    } catch (error) {
      alert(error instanceof Error ? error.message : '파일 처리 오류')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 시트 변경 핸들러
  const handleSheetChange = useCallback((sheetName: string) => {
    setSelectedSheet(sheetName)

    if (workbook) {
      const preview = previewData<Record<string, unknown>>(workbook, {
        sheetName,
      })
      setPreviewRows(preview)
    }
  }, [workbook])

  // Import 실행
  const handleImport = useCallback(async () => {
    if (!file) return

    setIsLoading(true)
    try {
      const options: ImportOptions = {
        sheetName: selectedSheet,
        skipDuplicates,
      }

      let importResult: ImportResult

      switch (importType) {
        case 'product':
          importResult = await importProducts(file, options)
          break
        case 'material':
          importResult = await importMaterials(file, options)
          break
        case 'bom':
          importResult = await importBOM(file, options)
          break
        case 'stock':
          importResult = await importStock(file, options)
          break
        default:
          throw new Error('지원하지 않는 Import 유형입니다.')
      }

      setResult(importResult)
      setStep('result')
      onImportComplete?.(importResult)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Import 오류')
    } finally {
      setIsLoading(false)
    }
  }, [file, selectedSheet, skipDuplicates, importType, onImportComplete])

  // 다이얼로그 닫기 및 초기화
  const handleClose = useCallback(() => {
    setStep('upload')
    setFile(null)
    setWorkbook(null)
    setSheets([])
    setSelectedSheet('')
    setPreviewRows([])
    setResult(null)
    onOpenChange(false)
  }, [onOpenChange])

  // 템플릿 다운로드
  const handleDownloadTemplate = useCallback(() => {
    downloadImportTemplate(importType)
  }, [importType])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {IMPORT_TYPE_LABELS[importType]} Excel Import
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: 파일 업로드 */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-file-input"
                disabled={isLoading}
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg
                  className="w-12 h-12 text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-gray-600">
                  클릭하여 Excel 파일 선택 (.xlsx, .xls)
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
              >
                템플릿 다운로드
              </Button>
              <p className="text-sm text-gray-500">
                템플릿 파일을 다운로드하여 양식에 맞게 데이터를 입력하세요.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 미리보기 */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* 파일 정보 */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
              <div>
                <span className="font-medium">{file?.name}</span>
                <span className="text-gray-500 ml-2">
                  ({(file?.size || 0 / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('upload')}
              >
                다른 파일 선택
              </Button>
            </div>

            {/* 시트 선택 */}
            {sheets.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">시트 선택:</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="border rounded px-3 py-1"
                >
                  {sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name} ({sheet.rowCount}행)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 옵션 */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">중복 데이터 스킵 (체크 해제 시 덮어쓰기)</span>
              </label>
            </div>

            {/* 데이터 미리보기 */}
            <div>
              <h4 className="font-medium mb-2">미리보기 (처음 5행)</h4>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      {previewRows[0] &&
                        Object.keys(previewRows[0]).map((key) => (
                          <th key={key} className="px-3 py-2 text-left border-b">
                            {key}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="px-3 py-2 border-b">
                            {value === null ? '-' : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 결과 */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded ${
                result.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <h4 className="font-medium mb-2">
                {result.success ? 'Import 완료!' : 'Import 완료 (일부 오류 발생)'}
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {result.totalRows}
                  </div>
                  <div className="text-sm text-gray-600">전체</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {result.importedRows}
                  </div>
                  <div className="text-sm text-gray-600">성공</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {result.skippedRows}
                  </div>
                  <div className="text-sm text-gray-600">스킵/오류</div>
                </div>
              </div>
            </div>

            {/* 오류 목록 */}
            {result.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">오류 목록</h4>
                <div className="max-h-48 overflow-y-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">행</th>
                        <th className="px-3 py-2 text-left">오류 메시지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((error, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-b">{error.row}</td>
                          <td className="px-3 py-2 border-b text-red-600">
                            {error.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                이전
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? 'Import 중...' : 'Import 실행'}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>닫기</Button>
          )}
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              취소
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExcelImportDialog
