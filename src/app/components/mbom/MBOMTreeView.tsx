/**
 * MBOMTreeView - MBOM 트리 뷰 컴포넌트
 *
 * 공정 순서대로 MBOM 구조를 트리 형태로 표시
 * - 노드 펼침/접기
 * - 노드 선택 시 상세 정보 표시
 * - 편집 모드에서 자재/반제품 추가/삭제
 */
import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Package,
  Box,
  Wrench,
  Search,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Input } from '@/app/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'

// ============================================
// Types
// ============================================

export interface MBOMTreeNode {
  processCode: string
  processName: string
  seq: number
  hasMaterialInput: boolean
  isInspection: boolean
  materials: Array<{
    id: number
    code: string
    name: string
    quantity: number
    unit: string
  }>
  semiProducts: Array<{
    id: number
    code: string
    name: string
    quantity: number
    type: string
  }>
  children: MBOMTreeNode[]
}

export interface MBOMTreeViewProps {
  productId: number
  data?: MBOMTreeNode[]
  onNodeSelect?: (node: MBOMTreeNode) => void
  onMaterialClick?: (material: MBOMTreeNode['materials'][0], processCode: string) => void
  onSemiProductClick?: (semiProduct: MBOMTreeNode['semiProducts'][0], processCode: string) => void
  onAddMaterial?: (processCode: string) => void
  onDeleteMaterial?: (materialId: number, processCode: string) => void
  onRefresh?: () => void
  editable?: boolean
  loading?: boolean
  className?: string
}

// ============================================
// Sub Components
// ============================================

interface ProcessNodeProps {
  node: MBOMTreeNode
  level: number
  isSelected: boolean
  editable: boolean
  onSelect: () => void
  onMaterialClick?: (material: MBOMTreeNode['materials'][0]) => void
  onSemiProductClick?: (semiProduct: MBOMTreeNode['semiProducts'][0]) => void
  onAddMaterial?: () => void
  onDeleteMaterial?: (materialId: number) => void
}

function ProcessNode({
  node,
  level,
  isSelected,
  editable,
  onSelect,
  onMaterialClick,
  onSemiProductClick,
  onAddMaterial,
  onDeleteMaterial,
}: ProcessNodeProps) {
  const [isOpen, setIsOpen] = useState(true)
  const hasItems = node.materials.length > 0 || node.semiProducts.length > 0

  const getProcessIcon = () => {
    if (node.isInspection) {
      return <Search className="size-4 text-blue-500" />
    }
    if (node.hasMaterialInput) {
      return <Package className="size-4 text-green-500" />
    }
    return <Wrench className="size-4 text-gray-500" />
  }

  return (
    <div className="mb-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
            'hover:bg-accent/50',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={onSelect}
        >
          {hasItems ? (
            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 rounded hover:bg-accent">
                {isOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="w-5" />
          )}

          {getProcessIcon()}

          <span className="font-medium">{node.processCode}</span>
          <span className="text-muted-foreground text-sm">{node.processName}</span>

          <div className="flex-1" />

          {node.materials.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              자재 {node.materials.length}
            </Badge>
          )}
          {node.semiProducts.length > 0 && (
            <Badge variant="outline" className="text-xs">
              반제품 {node.semiProducts.length}
            </Badge>
          )}

          {editable && node.hasMaterialInput && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={(e) => {
                e.stopPropagation()
                onAddMaterial?.()
              }}
            >
              <Plus className="size-3" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          {/* Materials */}
          {node.materials.length > 0 && (
            <div className="ml-6 pl-4 border-l border-border">
              {node.materials.map((material) => (
                <div
                  key={material.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md text-sm',
                    'hover:bg-accent/30 cursor-pointer'
                  )}
                  style={{ paddingLeft: `${level * 16 + 32}px` }}
                  onClick={() => onMaterialClick?.(material)}
                >
                  <Box className="size-3.5 text-amber-500" />
                  <span className="text-muted-foreground">{material.code}</span>
                  <span>{material.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {material.quantity} {material.unit}
                  </span>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteMaterial?.(material.id)
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Semi Products */}
          {node.semiProducts.length > 0 && (
            <div className="ml-6 pl-4 border-l border-border">
              {node.semiProducts.map((semi) => (
                <div
                  key={semi.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md text-sm',
                    'hover:bg-accent/30 cursor-pointer'
                  )}
                  style={{ paddingLeft: `${level * 16 + 32}px` }}
                  onClick={() => onSemiProductClick?.(semi)}
                >
                  <Package className="size-3.5 text-purple-500" />
                  <span className="text-muted-foreground">{semi.code}</span>
                  <span>{semi.name}</span>
                  <Badge variant="outline" className="text-xs ml-2">
                    {semi.type}
                  </Badge>
                  <span className="text-muted-foreground ml-auto">
                    x{semi.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Children (nested processes) */}
          {node.children?.map((child) => (
            <ProcessNode
              key={child.processCode}
              node={child}
              level={level + 1}
              isSelected={false}
              editable={editable}
              onSelect={() => {}}
              onMaterialClick={onMaterialClick}
              onSemiProductClick={onSemiProductClick}
              onAddMaterial={onAddMaterial}
              onDeleteMaterial={onDeleteMaterial}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function MBOMTreeView({
  productId,
  data = [],
  onNodeSelect,
  onMaterialClick,
  onSemiProductClick,
  onAddMaterial,
  onDeleteMaterial,
  onRefresh,
  editable = false,
  loading = false,
  className,
}: MBOMTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredData, setFilteredData] = useState<MBOMTreeNode[]>(data)

  // Update filtered data when data or search changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = data.filter((node) => {
      // Check process name/code
      if (
        node.processCode.toLowerCase().includes(query) ||
        node.processName.toLowerCase().includes(query)
      ) {
        return true
      }

      // Check materials
      if (
        node.materials.some(
          (m) =>
            m.code.toLowerCase().includes(query) ||
            m.name.toLowerCase().includes(query)
        )
      ) {
        return true
      }

      // Check semi products
      if (
        node.semiProducts.some(
          (s) =>
            s.code.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query)
        )
      ) {
        return true
      }

      return false
    })

    setFilteredData(filtered)
  }, [data, searchQuery])

  const handleNodeSelect = useCallback(
    (node: MBOMTreeNode) => {
      setSelectedNode(node.processCode)
      onNodeSelect?.(node)
    },
    [onNodeSelect]
  )

  // Calculate totals
  const totalMaterials = data.reduce((sum, node) => sum + node.materials.length, 0)
  const totalSemiProducts = data.reduce(
    (sum, node) => sum + node.semiProducts.length,
    0
  )

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">MBOM 로딩 중...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="size-5" />
            MBOM 구조
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">공정 {data.length}개</Badge>
            <Badge variant="outline">자재 {totalMaterials}개</Badge>
            <Badge variant="outline">반제품 {totalSemiProducts}개</Badge>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onRefresh}
              >
                <RefreshCw className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="공정, 자재, 반제품 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            {searchQuery ? (
              <>
                <Search className="size-8 mb-2" />
                <p>검색 결과가 없습니다</p>
              </>
            ) : (
              <>
                <Package className="size-8 mb-2" />
                <p>등록된 MBOM이 없습니다</p>
                {editable && (
                  <p className="text-sm mt-1">공정별 자재를 추가해주세요</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredData.map((node) => (
              <ProcessNode
                key={node.processCode}
                node={node}
                level={0}
                isSelected={selectedNode === node.processCode}
                editable={editable}
                onSelect={() => handleNodeSelect(node)}
                onMaterialClick={(m) => onMaterialClick?.(m, node.processCode)}
                onSemiProductClick={(s) => onSemiProductClick?.(s, node.processCode)}
                onAddMaterial={() => onAddMaterial?.(node.processCode)}
                onDeleteMaterial={(id) => onDeleteMaterial?.(id, node.processCode)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MBOMTreeView
