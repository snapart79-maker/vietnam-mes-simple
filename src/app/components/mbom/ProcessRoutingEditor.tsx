/**
 * ProcessRoutingEditor - 공정 라우팅 편집기
 *
 * 제품별 공정 순서 관리 컴포넌트
 * - 드래그 앤 드롭으로 공정 순서 변경
 * - 공정 추가/삭제
 * - 공정 패턴 템플릿 선택
 * - 필수/선택 공정 설정
 */
import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ChevronDown,
  Check,
  AlertCircle,
  Wrench,
  Package,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'

// ============================================
// Types
// ============================================

export interface Process {
  code: string
  name: string
  seq: number
  hasMaterialInput: boolean
  isInspection: boolean
  shortCode: string | null
}

export interface ProcessRoutingItem {
  id?: number
  processCode: string
  process: Process
  seq: number
  isRequired: boolean
}

export interface ProcessRoutingEditorProps {
  productId: number
  routing?: ProcessRoutingItem[]
  availableProcesses?: Process[]
  patterns?: Array<{
    name: string
    processes: readonly string[]
    description: string
  }>
  onSave?: (routing: ProcessRoutingItem[]) => Promise<void>
  onValidate?: (routing: ProcessRoutingItem[]) => Promise<{ valid: boolean; error?: string }>
  loading?: boolean
  className?: string
}

// ============================================
// Default Patterns
// ============================================

const DEFAULT_PATTERNS = [
  {
    name: 'simple',
    processes: ['CA', 'SP', 'PA', 'CI', 'VI'] as const,
    description: '단순 공정 (5공정)',
  },
  {
    name: 'medium',
    processes: ['CA', 'SB', 'MC', 'CQ', 'SP', 'PA', 'CI', 'VI'] as const,
    description: '중간 공정 (8공정)',
  },
  {
    name: 'complex',
    processes: ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI'] as const,
    description: '복잡 공정 (10공정)',
  },
]

// ============================================
// Sub Components
// ============================================

interface RoutingItemRowProps {
  item: ProcessRoutingItem
  index: number
  isFirst: boolean
  isLast: boolean
  onMove: (fromIndex: number, toIndex: number) => void
  onToggleRequired: (index: number) => void
  onRemove: (index: number) => void
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (targetIndex: number) => void
}

function RoutingItemRow({
  item,
  index,
  isFirst,
  isLast,
  onMove,
  onToggleRequired,
  onRemove,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: RoutingItemRowProps) {
  const getProcessIcon = () => {
    if (item.process.isInspection) {
      return <Search className="size-4 text-blue-500" />
    }
    if (item.process.hasMaterialInput) {
      return <Package className="size-4 text-green-500" />
    }
    return <Wrench className="size-4 text-gray-500" />
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md border bg-card transition-all',
        isDragging && 'opacity-50 border-dashed',
        'hover:bg-accent/30'
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
    >
      {/* Drag Handle */}
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="size-4" />
      </div>

      {/* Sequence Number */}
      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-sm font-medium">
        {index + 1}
      </div>

      {/* Process Icon */}
      {getProcessIcon()}

      {/* Process Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.processCode}</span>
          <span className="text-muted-foreground text-sm">{item.process.name}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1">
        {item.process.hasMaterialInput && (
          <Badge variant="outline" className="text-xs">
            자재투입
          </Badge>
        )}
        {item.process.isInspection && (
          <Badge variant="secondary" className="text-xs">
            검사
          </Badge>
        )}
      </div>

      {/* Required Toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`required-${index}`}
          checked={item.isRequired}
          onCheckedChange={() => onToggleRequired(index)}
        />
        <Label htmlFor={`required-${index}`} className="text-sm cursor-pointer">
          필수
        </Label>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function ProcessRoutingEditor({
  productId,
  routing = [],
  availableProcesses = [],
  patterns = DEFAULT_PATTERNS,
  onSave,
  onValidate,
  loading = false,
  className,
}: ProcessRoutingEditorProps) {
  const [items, setItems] = useState<ProcessRoutingItem[]>(routing)
  const [selectedPattern, setSelectedPattern] = useState<string>('')
  const [selectedProcess, setSelectedProcess] = useState<string>('')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync with external routing
  useEffect(() => {
    setItems(routing)
    setHasChanges(false)
  }, [routing])

  // Validate on changes
  useEffect(() => {
    if (onValidate && items.length > 0) {
      onValidate(items).then((result) => {
        setValidationError(result.valid ? null : result.error || null)
      })
    } else {
      setValidationError(null)
    }
  }, [items, onValidate])

  // Get available processes not in current routing
  const unusedProcesses = availableProcesses.filter(
    (p) => !items.some((item) => item.processCode === p.code)
  )

  // Apply pattern
  const handleApplyPattern = useCallback(
    (patternName: string) => {
      const pattern = patterns.find((p) => p.name === patternName)
      if (!pattern) return

      const newItems: ProcessRoutingItem[] = pattern.processes.map((code, index) => {
        const process = availableProcesses.find((p) => p.code === code)
        if (!process) {
          // Create a placeholder if process not found
          return {
            processCode: code,
            process: {
              code,
              name: code,
              seq: index * 10,
              hasMaterialInput: false,
              isInspection: false,
              shortCode: null,
            },
            seq: (index + 1) * 10,
            isRequired: true,
          }
        }
        return {
          processCode: code,
          process,
          seq: (index + 1) * 10,
          isRequired: true,
        }
      })

      setItems(newItems)
      setSelectedPattern(patternName)
      setHasChanges(true)
    },
    [patterns, availableProcesses]
  )

  // Add process
  const handleAddProcess = useCallback(() => {
    if (!selectedProcess) return

    const process = availableProcesses.find((p) => p.code === selectedProcess)
    if (!process) return

    const newItem: ProcessRoutingItem = {
      processCode: selectedProcess,
      process,
      seq: (items.length + 1) * 10,
      isRequired: true,
    }

    setItems([...items, newItem])
    setSelectedProcess('')
    setHasChanges(true)
  }, [selectedProcess, availableProcesses, items])

  // Remove process
  const handleRemove = useCallback((index: number) => {
    setItems((prev) => {
      const newItems = [...prev]
      newItems.splice(index, 1)
      // Recalculate seq
      return newItems.map((item, i) => ({
        ...item,
        seq: (i + 1) * 10,
      }))
    })
    setHasChanges(true)
  }, [])

  // Toggle required
  const handleToggleRequired = useCallback((index: number) => {
    setItems((prev) => {
      const newItems = [...prev]
      newItems[index] = {
        ...newItems[index],
        isRequired: !newItems[index].isRequired,
      }
      return newItems
    })
    setHasChanges(true)
  }, [])

  // Drag and drop
  const handleDragStart = useCallback((index: number) => {
    setDraggingIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (draggingIndex === null || draggingIndex === targetIndex) return

      setItems((prev) => {
        const newItems = [...prev]
        const [removed] = newItems.splice(draggingIndex, 1)
        newItems.splice(targetIndex, 0, removed)
        // Recalculate seq
        return newItems.map((item, i) => ({
          ...item,
          seq: (i + 1) * 10,
        }))
      })
      setDraggingIndex(null)
      setHasChanges(true)
    },
    [draggingIndex]
  )

  // Move item
  const handleMove = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0) return

    setItems((prev) => {
      const newItems = [...prev]
      const [removed] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, removed)
      return newItems.map((item, i) => ({
        ...item,
        seq: (i + 1) * 10,
      }))
    })
    setHasChanges(true)
  }, [])

  // Reset
  const handleReset = useCallback(() => {
    setItems(routing)
    setHasChanges(false)
    setSelectedPattern('')
    setShowResetDialog(false)
  }, [routing])

  // Save
  const handleSave = useCallback(async () => {
    if (!onSave) return

    setSaving(true)
    try {
      await onSave(items)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save routing:', error)
    } finally {
      setSaving(false)
    }
  }, [onSave, items])

  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="size-5" />
              공정 라우팅 편집
            </CardTitle>
            <Badge variant={hasChanges ? 'default' : 'secondary'}>
              {hasChanges ? '변경됨' : '저장됨'}
            </Badge>
          </div>

          {/* Pattern Selection */}
          <div className="flex items-center gap-2 mt-3">
            <Label className="text-sm text-muted-foreground">패턴 적용:</Label>
            <Select value={selectedPattern} onValueChange={handleApplyPattern}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="패턴 선택..." />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((pattern) => (
                  <SelectItem key={pattern.name} value={pattern.name}>
                    {pattern.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="size-4" />
              <span className="text-sm">{validationError}</span>
            </div>
          )}

          {/* Routing Items */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
              <Wrench className="size-8 mb-2" />
              <p>등록된 공정이 없습니다</p>
              <p className="text-sm mt-1">패턴을 선택하거나 공정을 추가해주세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <RoutingItemRow
                  key={`${item.processCode}-${index}`}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMove={handleMove}
                  onToggleRequired={handleToggleRequired}
                  onRemove={handleRemove}
                  isDragging={draggingIndex === index}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}

          {/* Add Process */}
          {unusedProcesses.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="공정 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {unusedProcesses.map((process) => (
                    <SelectItem key={process.code} value={process.code}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{process.code}</span>
                        <span className="text-muted-foreground">{process.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleAddProcess}
                disabled={!selectedProcess}
              >
                <Plus className="size-4 mr-1" />
                추가
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="size-4 mr-1" />
            초기화
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || !!validationError || saving || loading}
          >
            {saving ? (
              <>
                <span className="animate-spin mr-1">
                  <RotateCcw className="size-4" />
                </span>
                저장 중...
              </>
            ) : (
              <>
                <Save className="size-4 mr-1" />
                저장
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>변경 사항 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              모든 변경 사항이 취소됩니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>초기화</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ProcessRoutingEditor
