/**
 * Backup Dialog
 *
 * 데이터 백업 및 복원 UI
 */
import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import {
  createBackup,
  downloadBackup,
  uploadBackup,
  restoreBackup,
  getBackupInfo,
  type BackupData,
  type RestoreResult,
} from '@/services/backupService'

interface BackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBackupComplete?: () => void
  onRestoreComplete?: (result: RestoreResult) => void
}

type TabType = 'backup' | 'restore'

export function BackupDialog({
  open,
  onOpenChange,
  onBackupComplete,
  onRestoreComplete,
}: BackupDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('backup')
  const [isLoading, setIsLoading] = useState(false)

  // Backup state
  const [includeSystem, setIncludeSystem] = useState(false)
  const [backupResult, setBackupResult] = useState<BackupData | null>(null)

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreData, setRestoreData] = useState<BackupData | null>(null)
  const [clearBeforeRestore, setClearBeforeRestore] = useState(false)
  const [skipExisting, setSkipExisting] = useState(true)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  // 백업 생성
  const handleCreateBackup = useCallback(async () => {
    setIsLoading(true)
    try {
      const backup = await createBackup({
        includeSystemTables: includeSystem,
      })
      setBackupResult(backup)
    } catch (error) {
      alert(error instanceof Error ? error.message : '백업 생성 오류')
    } finally {
      setIsLoading(false)
    }
  }, [includeSystem])

  // 백업 다운로드
  const handleDownloadBackup = useCallback(() => {
    if (backupResult) {
      downloadBackup(backupResult)
      onBackupComplete?.()
    }
  }, [backupResult, onBackupComplete])

  // 복원 파일 선택
  const handleRestoreFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setIsLoading(true)
      try {
        const data = await uploadBackup(file)
        setRestoreFile(file)
        setRestoreData(data)
      } catch (error) {
        alert(error instanceof Error ? error.message : '파일 읽기 오류')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 복원 실행
  const handleRestore = useCallback(async () => {
    if (!restoreData) return

    const confirmMessage = clearBeforeRestore
      ? '경고: 기존 데이터가 모두 삭제됩니다. 계속하시겠습니까?'
      : '복원을 진행하시겠습니까?'

    if (!confirm(confirmMessage)) return

    setIsLoading(true)
    try {
      const result = await restoreBackup(restoreData, {
        clearBeforeRestore,
        skipExisting,
      })
      setRestoreResult(result)
      onRestoreComplete?.(result)
    } catch (error) {
      alert(error instanceof Error ? error.message : '복원 오류')
    } finally {
      setIsLoading(false)
    }
  }, [restoreData, clearBeforeRestore, skipExisting, onRestoreComplete])

  // 다이얼로그 닫기
  const handleClose = useCallback(() => {
    setBackupResult(null)
    setRestoreFile(null)
    setRestoreData(null)
    setRestoreResult(null)
    onOpenChange(false)
  }, [onOpenChange])

  const backupInfo = restoreData ? getBackupInfo(restoreData) : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>데이터 백업 / 복원</DialogTitle>
        </DialogHeader>

        {/* 탭 선택 */}
        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'backup'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('backup')}
          >
            백업
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'restore'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('restore')}
          >
            복원
          </button>
        </div>

        {/* 백업 탭 */}
        {activeTab === 'backup' && (
          <div className="space-y-4 py-4">
            {!backupResult ? (
              <>
                <p className="text-gray-600">
                  현재 데이터베이스의 모든 데이터를 JSON 파일로 백업합니다.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeSystem"
                    checked={includeSystem}
                    onChange={(e) => setIncludeSystem(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="includeSystem" className="text-sm">
                    시스템 테이블 포함 (사용자, 설정)
                  </label>
                </div>

                <Button
                  onClick={handleCreateBackup}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? '백업 생성 중...' : '백업 생성'}
                </Button>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <h4 className="font-medium text-green-800 mb-2">
                    백업 생성 완료!
                  </h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>버전: {backupResult.version}</p>
                    <p>생성일시: {new Date(backupResult.createdAt).toLocaleString()}</p>
                    <p>테이블 수: {backupResult.metadata.tableCount}개</p>
                    <p>총 레코드: {backupResult.metadata.totalRecords}건</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleDownloadBackup} className="flex-1">
                    파일 다운로드
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBackupResult(null)}
                    className="flex-1"
                  >
                    다시 백업
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 복원 탭 */}
        {activeTab === 'restore' && (
          <div className="space-y-4 py-4">
            {!restoreResult ? (
              <>
                {!restoreData ? (
                  <>
                    <p className="text-gray-600">
                      백업 파일을 선택하여 데이터를 복원합니다.
                    </p>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleRestoreFileSelect}
                        className="hidden"
                        id="restore-file-input"
                        disabled={isLoading}
                      />
                      <label
                        htmlFor="restore-file-input"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <svg
                          className="w-10 h-10 text-gray-400 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        <span className="text-gray-600">
                          클릭하여 백업 파일 선택 (.json)
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 파일 정보 */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-800">
                          {restoreFile?.name}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRestoreFile(null)
                            setRestoreData(null)
                          }}
                        >
                          다른 파일
                        </Button>
                      </div>
                      {backupInfo && (
                        <div className="text-sm text-blue-700 space-y-1">
                          <p>버전: {backupInfo.version}</p>
                          <p>
                            백업일시:{' '}
                            {new Date(backupInfo.createdAt).toLocaleString()}
                          </p>
                          <p>총 레코드: {backupInfo.totalRecords}건</p>
                        </div>
                      )}
                    </div>

                    {/* 테이블 목록 */}
                    {backupInfo && (
                      <div>
                        <h4 className="font-medium mb-2">복원할 테이블</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {backupInfo.tables.map((t) => (
                            <div
                              key={t.name}
                              className="flex justify-between bg-gray-50 px-3 py-1 rounded"
                            >
                              <span>{t.name}</span>
                              <span className="text-gray-500">{t.count}건</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 옵션 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="skipExisting"
                          checked={skipExisting}
                          onChange={(e) => setSkipExisting(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="skipExisting" className="text-sm">
                          중복 데이터 스킵
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="clearBefore"
                          checked={clearBeforeRestore}
                          onChange={(e) => setClearBeforeRestore(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="clearBefore" className="text-sm text-red-600">
                          복원 전 기존 데이터 삭제 (주의!)
                        </label>
                      </div>
                    </div>

                    <Button
                      onClick={handleRestore}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? '복원 중...' : '복원 실행'}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <div
                  className={`p-4 rounded ${
                    restoreResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <h4 className="font-medium mb-2">
                    {restoreResult.success
                      ? '복원 완료!'
                      : '복원 완료 (일부 오류)'}
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>복원된 테이블: {restoreResult.restoredTables.length}개</p>
                    <p>복원된 레코드: {restoreResult.totalRecords}건</p>
                  </div>
                </div>

                {restoreResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-600">오류</h4>
                    <ul className="text-sm text-red-600 list-disc pl-4">
                      {restoreResult.errors.map((e, i) => (
                        <li key={i}>
                          {e.table}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={() => {
                    setRestoreFile(null)
                    setRestoreData(null)
                    setRestoreResult(null)
                  }}
                  className="w-full"
                >
                  다른 파일 복원
                </Button>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BackupDialog
