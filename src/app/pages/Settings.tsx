/**
 * Settings Page
 *
 * 시스템 설정 (DB 연동)
 * - 라인 관리: lineService
 * - 비즈니스 규칙: appSettingsService
 * - 장치/라벨: appSettingsService
 * - 백업/복원: backupService
 * - 계정 보안: authService
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import { Badge } from '../components/ui/badge'
import {
  Printer,
  Save,
  RefreshCw,
  KeyRound,
  Database,
  Sliders,
  Factory,
  Scale,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useMaterial, type WireColorMapping } from '../context/MaterialContext'
import { useProduction } from '../context/ProductionContext'
// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import {
  getLines as getAllLines,
  createLine,
  updateLine,
  setLineActive,
  deleteLine,
} from '@/services/mock/lineService.mock'
import {
  getBusinessRules,
  saveBusinessRules,
  getPrinterSettings,
  savePrinterSettings,
  getLabelSettings,
  saveLabelSettings,
} from '@/services/mock/appSettingsService.mock'
import { createBackup, downloadBackup, resetDatabase } from '@/services/mock/backupService.mock'
import { changePassword, verifyAdminPassword } from '@/services/mock/authService.mock'

interface Line {
  id: number
  code: string
  name: string
  processCode: string
  isActive: boolean
}

interface BusinessRules {
  allowNegativeStock: boolean
  enableSafetyStockWarning: boolean
  bomStrictMode: boolean
  enforceFifo: boolean
}

interface PrinterSettings {
  labelPrinter: string
  reportPrinter: string
}

interface LabelSettings {
  autoPrint: boolean
  copies: number
  xOffset: number
  yOffset: number
}

export const Settings = () => {
  const { user } = useAuth()
  const { resetMaterials, loadWireColorMappings, getWireMappingCount } = useMaterial()
  const { resetProduction } = useProduction()
  const [activeTab, setActiveTab] = useState('lines')
  const [wireMappingCount, setWireMappingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 라인 관리
  const [lines, setLines] = useState<Line[]>([])
  const [lineModalOpen, setLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [lineFormData, setLineFormData] = useState({
    code: '',
    name: '',
    processCode: 'CA',
    isActive: true,
  })

  // 비즈니스 규칙
  const [businessRules, setBusinessRules] = useState<BusinessRules>({
    allowNegativeStock: false,
    enableSafetyStockWarning: true,
    bomStrictMode: true,
    enforceFifo: false,
  })

  // 프린터 설정
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    labelPrinter: '',
    reportPrinter: '',
  })

  // 라벨 설정
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({
    autoPrint: true,
    copies: 1,
    xOffset: 0,
    yOffset: 0,
  })

  // 비밀번호 변경
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // 데이터 초기화
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // 라인 목록 로드
  const loadLines = useCallback(async () => {
    try {
      const data = await getAllLines()
      setLines(
        data.map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          processCode: l.processCode,
          isActive: l.isActive,
        }))
      )
    } catch (error) {
      console.error('Failed to load lines:', error)
    }
  }, [])

  // 비즈니스 규칙 로드
  const loadBusinessRules = useCallback(async () => {
    try {
      const rules = await getBusinessRules()
      setBusinessRules(rules)
    } catch (error) {
      console.error('Failed to load business rules:', error)
    }
  }, [])

  // 프린터/라벨 설정 로드
  const loadDeviceSettings = useCallback(async () => {
    try {
      const [printer, label] = await Promise.all([
        getPrinterSettings(),
        getLabelSettings(),
      ])
      setPrinterSettings(printer)
      setLabelSettings(label)
    } catch (error) {
      console.error('Failed to load device settings:', error)
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadLines(), loadBusinessRules(), loadDeviceSettings()]).finally(
      () => setIsLoading(false)
    )
    // 전선 색상코드 매핑 개수 로드
    setWireMappingCount(getWireMappingCount())
  }, [loadLines, loadBusinessRules, loadDeviceSettings, getWireMappingCount])

  // 전선 색상코드 매핑 로드 (기본 파일)
  const handleLoadDefaultWireMapping = async () => {
    try {
      const response = await fetch('/data/wire-color-mapping.json')
      if (!response.ok) throw new Error('파일을 찾을 수 없습니다.')
      const mappings: WireColorMapping[] = await response.json()
      const count = loadWireColorMappings(mappings)
      setWireMappingCount(count)
      toast.success(`전선 색상코드 매핑 ${count}개가 로드되었습니다.`)
    } catch (error) {
      console.error('Load wire mapping error:', error)
      toast.error('매핑 파일 로드 실패')
    }
  }

  // 전선 색상코드 매핑 로드 (파일 선택)
  const handleLoadWireMappingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const mappings: WireColorMapping[] = JSON.parse(text)
      const count = loadWireColorMappings(mappings)
      setWireMappingCount(count)
      toast.success(`전선 색상코드 매핑 ${count}개가 로드되었습니다.`)
    } catch (error) {
      console.error('Load wire mapping error:', error)
      toast.error('JSON 파일 파싱 실패')
    }
  }

  // 라인 저장
  const handleSaveLine = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (editingLine) {
        await updateLine(editingLine.id, {
          name: lineFormData.name,
          processCode: lineFormData.processCode,
          isActive: lineFormData.isActive,
        })
        toast.success('라인 정보가 수정되었습니다.')
      } else {
        await createLine({
          code: lineFormData.code,
          name: lineFormData.name,
          processCode: lineFormData.processCode,
        })
        toast.success('새 라인이 추가되었습니다.')
      }
      setLineModalOpen(false)
      loadLines()
    } catch (error) {
      console.error('Save line error:', error)
      toast.error('라인 저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 라인 삭제
  const handleDeleteLine = async (line: Line) => {
    if (!confirm(`${line.name} 라인을 삭제하시겠습니까?`)) return

    try {
      await deleteLine(line.id)
      toast.success('라인이 삭제되었습니다.')
      loadLines()
    } catch (error) {
      console.error('Delete line error:', error)
      toast.error('라인 삭제 실패')
    }
  }

  // 라인 편집 모달 열기
  const handleEditLine = (line: Line) => {
    setEditingLine(line)
    setLineFormData({
      code: line.code,
      name: line.name,
      processCode: line.processCode,
      isActive: line.isActive,
    })
    setLineModalOpen(true)
  }

  // 라인 추가 모달 열기
  const handleAddLine = () => {
    setEditingLine(null)
    setLineFormData({
      code: '',
      name: '',
      processCode: 'CA',
      isActive: true,
    })
    setLineModalOpen(true)
  }

  // 비즈니스 규칙 저장
  const handleSaveBusinessRules = async () => {
    setIsSaving(true)
    try {
      await saveBusinessRules(businessRules)
      toast.success('비즈니스 규칙이 저장되었습니다.')
    } catch (error) {
      console.error('Save business rules error:', error)
      toast.error('규칙 저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 프린터/라벨 설정 저장
  const handleSaveDeviceSettings = async () => {
    setIsSaving(true)
    try {
      await Promise.all([
        savePrinterSettings(printerSettings),
        saveLabelSettings(labelSettings),
      ])
      toast.success('장치 설정이 저장되었습니다.')
    } catch (error) {
      console.error('Save device settings error:', error)
      toast.error('설정 저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 백업 실행
  const handleBackup = async () => {
    setIsSaving(true)
    toast.info('시스템 백업을 시작합니다...')

    try {
      const backup = await createBackup({ includeSystemTables: true })
      downloadBackup(backup)
      toast.success('백업이 완료되었습니다.')
    } catch (error) {
      console.error('Backup error:', error)
      toast.error('백업 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 비밀번호 변경
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (passwordData.newPassword.length < 4) {
      toast.error('비밀번호는 최소 4자 이상이어야 합니다.')
      return
    }

    if (!user) {
      toast.error('로그인이 필요합니다.')
      return
    }

    setIsSaving(true)
    try {
      const result = await changePassword(
        user.id,
        passwordData.currentPassword,
        passwordData.newPassword
      )

      if (result.success) {
        toast.success('비밀번호가 변경되었습니다.')
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        toast.error(result.error || '비밀번호 변경 실패')
      }
    } catch (error) {
      console.error('Change password error:', error)
      toast.error('비밀번호 변경 실패')
    } finally {
      setIsSaving(false)
    }
  }

  // 데이터 초기화
  const handleResetDatabase = async () => {
    if (!resetPassword) {
      toast.error('관리자 비밀번호를 입력해주세요.')
      return
    }

    setIsResetting(true)
    try {
      // 1. 관리자 암호 검증
      const isValid = await verifyAdminPassword(resetPassword)
      if (!isValid) {
        toast.error('비밀번호가 일치하지 않습니다.')
        setIsResetting(false)
        return
      }

      // 2. 데이터 초기화 실행
      const result = await resetDatabase()

      // 3. React Context 상태 초기화
      const materialCount = resetMaterials()
      const productionCount = resetProduction()
      console.log('Context 초기화 - 자재:', materialCount, '건, 생산:', productionCount, '건')

      if (result.success) {
        toast.success('데이터베이스가 초기화되었습니다.')
        if (result.deletedCounts) {
          const counts = result.deletedCounts
          console.log('삭제된 데이터:', counts)
        }
        setResetModalOpen(false)
        setResetPassword('')

        // 페이지 새로고침으로 모든 상태 초기화
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        toast.error(result.message || '초기화 실패')
      }
    } catch (error) {
      console.error('Reset database error:', error)
      toast.error('데이터베이스 초기화 중 오류가 발생했습니다.')
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500">설정 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">시스템 설정</h2>
        <p className="text-slate-500">
          애플리케이션 환경, 규칙 및 인프라 설정을 관리합니다.
        </p>
      </div>

      <Tabs
        defaultValue="lines"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="lines">라인 관리</TabsTrigger>
          <TabsTrigger value="rules">비즈니스 규칙</TabsTrigger>
          <TabsTrigger value="device">장치 및 라벨</TabsTrigger>
          <TabsTrigger value="data">데이터 및 백업</TabsTrigger>
          <TabsTrigger value="account">계정 보안</TabsTrigger>
        </TabsList>

        {/* Line Management */}
        <TabsContent value="lines" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">생산 라인 목록</h3>
            <Button
              onClick={handleAddLine}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" /> 라인 추가
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>라인 코드</TableHead>
                    <TableHead>라인명</TableHead>
                    <TableHead>담당 공정</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono font-medium">
                        {line.code}
                      </TableCell>
                      <TableCell>{line.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{line.processCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={line.isActive ? 'default' : 'secondary'}
                          className={line.isActive ? 'bg-green-600' : ''}
                        >
                          {line.isActive ? '사용 중' : '중지됨'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditLine(line)}>
                              <Edit2 className="mr-2 h-4 w-4" /> 수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteLine(line)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> 삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-slate-400"
                      >
                        등록된 라인이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Rules */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory size={20} /> 재고 통제 규칙
                </CardTitle>
                <CardDescription>
                  재고 부족 시 시스템 동작을 제어합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">마이너스 재고 허용</Label>
                    <p className="text-sm text-slate-500">
                      재고가 부족해도 출고 처리를 진행합니다.
                    </p>
                  </div>
                  <Switch
                    checked={businessRules.allowNegativeStock}
                    onCheckedChange={(checked) =>
                      setBusinessRules((prev) => ({
                        ...prev,
                        allowNegativeStock: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">안전 재고 경고</Label>
                    <p className="text-sm text-slate-500">
                      재고가 안전 재고 미만일 때 알림을 띄웁니다.
                    </p>
                  </div>
                  <Switch
                    checked={businessRules.enableSafetyStockWarning}
                    onCheckedChange={(checked) =>
                      setBusinessRules((prev) => ({
                        ...prev,
                        enableSafetyStockWarning: checked,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale size={20} /> BOM 검증 규칙
                </CardTitle>
                <CardDescription>
                  생산 투입 시 BOM 유효성 검사 수준을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">BOM 엄격 모드</Label>
                    <p className="text-sm text-slate-500">
                      등록된 대체 자재 외에는 투입을 차단합니다.
                    </p>
                  </div>
                  <Switch
                    checked={businessRules.bomStrictMode}
                    onCheckedChange={(checked) =>
                      setBusinessRules((prev) => ({
                        ...prev,
                        bomStrictMode: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">LOT 선입선출 강제</Label>
                    <p className="text-sm text-slate-500">
                      오래된 자재부터 사용하도록 강제합니다.
                    </p>
                  </div>
                  <Switch
                    checked={businessRules.enforceFifo}
                    onCheckedChange={(checked) =>
                      setBusinessRules((prev) => ({
                        ...prev,
                        enforceFifo: checked,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveBusinessRules}
              className="ml-auto"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              규칙 저장
            </Button>
          </div>
        </TabsContent>

        {/* Device Settings */}
        <TabsContent value="device" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer size={20} /> 프린터 설정
              </CardTitle>
              <CardDescription>
                라벨 프린터 및 문서 프린터를 선택합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>라벨 프린터 (Label Printer)</Label>
                <Input
                  placeholder="프린터 이름 입력"
                  value={printerSettings.labelPrinter}
                  onChange={(e) =>
                    setPrinterSettings((prev) => ({
                      ...prev,
                      labelPrinter: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>보고서 프린터 (A4)</Label>
                <Input
                  placeholder="프린터 이름 입력"
                  value={printerSettings.reportPrinter}
                  onChange={(e) =>
                    setPrinterSettings((prev) => ({
                      ...prev,
                      reportPrinter: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders size={20} /> 라벨 출력 옵션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>자동 발행</Label>
                  <p className="text-xs text-slate-500">
                    작업 완료 시 자동으로 라벨을 출력합니다.
                  </p>
                </div>
                <Switch
                  checked={labelSettings.autoPrint}
                  onCheckedChange={(checked) =>
                    setLabelSettings((prev) => ({ ...prev, autoPrint: checked }))
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>기본 출력 매수</Label>
                  <Input
                    type="number"
                    value={labelSettings.copies}
                    onChange={(e) =>
                      setLabelSettings((prev) => ({
                        ...prev,
                        copies: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>X축 오프셋 (mm)</Label>
                  <Input
                    type="number"
                    value={labelSettings.xOffset}
                    onChange={(e) =>
                      setLabelSettings((prev) => ({
                        ...prev,
                        xOffset: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Y축 오프셋 (mm)</Label>
                  <Input
                    type="number"
                    value={labelSettings.yOffset}
                    onChange={(e) =>
                      setLabelSettings((prev) => ({
                        ...prev,
                        yOffset: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSaveDeviceSettings}
                className="ml-auto"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Data & Backup Settings */}
        <TabsContent value="data" className="space-y-4 mt-4">
          {/* 전선 색상코드 매핑 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders size={20} /> 전선 색상코드 매핑
              </CardTitle>
              <CardDescription>
                경신전선, 케이알로지스 등 전선 공급사의 바코드 색상코드를 MES 품번과 연결합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                <div className="space-y-1">
                  <p className="font-medium">현재 매핑 개수</p>
                  <p className="text-2xl font-bold text-blue-600">{wireMappingCount}개</p>
                  <p className="text-xs text-slate-500">
                    색상코드 → MES 품번 매핑 (경신전선, 케이알로지스, 히로세코리아)
                  </p>
                </div>
                <Button onClick={handleLoadDefaultWireMapping}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  기본 매핑 로드
                </Button>
              </div>
              <div className="space-y-2">
                <Label>매핑 파일 업로드 (JSON)</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleLoadWireMappingFile}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  * wire-color-mapping.json 형식의 파일을 업로드하세요.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} /> 백업 및 복원
              </CardTitle>
              <CardDescription>
                시스템 데이터를 안전하게 백업하거나 복원합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                <div className="space-y-1">
                  <p className="font-medium">수동 백업</p>
                  <p className="text-sm text-slate-500">
                    현재 시점의 모든 데이터를 로컬에 저장합니다.
                  </p>
                </div>
                <Button onClick={handleBackup} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  지금 백업
                </Button>
              </div>

              <div className="space-y-2">
                <Label>데이터 복원</Label>
                <div className="flex gap-2">
                  <Input type="file" accept=".json" />
                  <Button variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" /> 복원
                  </Button>
                </div>
                <p className="text-xs text-red-500">
                  * 복원 시 현재 데이터가 덮어씌워질 수 있습니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 데이터 초기화 */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} /> 공장 초기화 (Factory Reset)
              </CardTitle>
              <CardDescription>
                admin 계정을 제외한 모든 데이터를 삭제합니다. (완전 초기화)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-700">⚠️ 경고: 완전 초기화</p>
                    <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                      <li><strong>생산 LOT, 재고, 검사 기록</strong>이 모두 삭제됩니다</li>
                      <li><strong>자재, 제품, 라인, 사용자</strong> 마스터 데이터도 삭제됩니다</li>
                      <li><strong>admin 계정만 유지</strong>됩니다</li>
                      <li>삭제된 데이터는 복구할 수 없습니다</li>
                      <li>초기화 전 반드시 백업을 수행해주세요</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setResetModalOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  데이터 초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Security */}
        <TabsContent value="account" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound size={20} /> 비밀번호 변경
              </CardTitle>
              {user && (
                <CardDescription>
                  현재 사용자: {user.name} ({user.username})
                </CardDescription>
              )}
            </CardHeader>
            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>현재 비밀번호</Label>
                  <Input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>새 비밀번호</Label>
                  <Input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>새 비밀번호 확인</Label>
                  <Input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="ml-auto" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  비밀번호 변경
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Line Management Modal */}
      <Dialog open={lineModalOpen} onOpenChange={setLineModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLine ? '라인 수정' : '새 라인 추가'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLine}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="lineCode">라인 코드</Label>
                <Input
                  id="lineCode"
                  value={lineFormData.code}
                  onChange={(e) =>
                    setLineFormData((prev) => ({ ...prev, code: e.target.value }))
                  }
                  placeholder="예: PA-L03"
                  required
                  disabled={!!editingLine}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lineName">라인명</Label>
                <Input
                  id="lineName"
                  value={lineFormData.name}
                  onChange={(e) =>
                    setLineFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="예: 제품조립 3라인"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="processCode">담당 공정</Label>
                <Select
                  value={lineFormData.processCode}
                  onValueChange={(value) =>
                    setLineFormData((prev) => ({ ...prev, processCode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="공정 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA">자동절단압착 (CA)</SelectItem>
                    <SelectItem value="MC">수동압착 (MC)</SelectItem>
                    <SelectItem value="MS">중간스트립 (MS)</SelectItem>
                    <SelectItem value="SB">Sub (SB)</SelectItem>
                    <SelectItem value="PA">제품조립 (PA)</SelectItem>
                    <SelectItem value="HS">열수축 (HS)</SelectItem>
                    <SelectItem value="VI">육안검사 (VI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  id="isActive"
                  checked={lineFormData.isActive}
                  onCheckedChange={(checked) =>
                    setLineFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <Label htmlFor="isActive">사용 여부</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setLineModalOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Database Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              공장 초기화 (Factory Reset)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ 정말로 모든 데이터를 초기화하시겠습니까?
              </p>
              <p className="text-xs text-red-600 mt-2">
                이 작업은 되돌릴 수 없습니다. admin 계정을 제외한 모든 데이터(생산, 재고, 검사, 자재, 라인, 사용자)가 삭제됩니다.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resetPassword">관리자 비밀번호 확인</Label>
              <Input
                id="resetPassword"
                type="password"
                placeholder="관리자 비밀번호를 입력하세요"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                초기화를 진행하려면 관리자 비밀번호를 입력하세요.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetModalOpen(false)
                setResetPassword('')
              }}
              disabled={isResetting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetDatabase}
              disabled={isResetting || !resetPassword}
            >
              {isResetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              초기화 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Settings
