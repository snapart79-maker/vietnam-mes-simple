import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Plus, Search, Edit2, Trash2, FileDown, Upload, FolderTree, Package, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useMaterial, Material } from '../context/MaterialContext';
import { useProduct, Product } from '../context/ProductContext';
import { useBOM } from '../context/BOMContext';
import { downloadImportTemplate } from '@/services/excelImportService';
import { ExcelImportDialog, type ImportType } from '@/app/components/dialogs/ExcelImportDialog';

export const MasterData = () => {
  const { type } = useParams<{ type: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null);
  
  // Use Global Context
  const { materials, addMaterial, addMaterials, updateMaterial, deleteMaterial } = useMaterial();
  const { products, addProduct, addProducts, updateProduct, deleteProduct } = useProduct();
  const { bomItems, bomGroups, addBOMItems, deleteBOMItem, deleteBOMByProduct } = useBOM();

  // Product state
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // BOM state - 3-Level 펼침/접기 상태
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());  // LV0: 품번
  const [expandedLevels, setExpandedLevels] = useState<Map<string, Set<number>>>(new Map());  // LV1-4: 품번별 레벨
  const [expandedCrimps, setExpandedCrimps] = useState<Map<string, Set<string>>>(new Map());  // CA crimpCode

  const getTitle = () => {
    switch (type) {
      case 'product': return '완제품 관리 (Product Master)';
      case 'material': return '자재 관리 (Material Master)';
      case 'bom': return 'BOM 관리 (Bill of Materials)';
      case 'user': return '사용자 관리 (User Management)';
      default: return '기준 정보 관리';
    }
  };

  const handleEdit = (item: Material) => {
    setCurrentMaterial({ ...item });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setCurrentMaterial({
      id: 0, // ID will be assigned by context
      code: '',
      name: '',
      spec: '',
      unit: 'EA',
      category: '원자재', // Default category
      safeStock: 0,
      stock: 0,
      desc: '',
      regDate: ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMaterial) return;

    if (currentMaterial.id > 0) {
      // Edit existing
      updateMaterial(currentMaterial);
      toast.success(`${currentMaterial.name} 정보가 수정되었습니다.`);
    } else {
      // Add new
      addMaterial({
        code: currentMaterial.code,
        name: currentMaterial.name,
        spec: currentMaterial.spec,
        category: currentMaterial.category || '원자재', // Map type to category
        unit: currentMaterial.unit,
        safeStock: currentMaterial.safeStock,
        desc: currentMaterial.desc
      });
      toast.success('새로운 자재가 등록되었습니다.');
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    console.log('[MasterData] handleDelete called with id:', id, 'type:', typeof id);
    deleteMaterial(id);
    toast.success('자재가 삭제되었습니다.');
  };

  // 직접 삭제 버튼용 (드롭다운 우회)
  const handleDirectDelete = (id: number, name: string) => {
    if (window.confirm(`"${name}" 자재를 정말 삭제하시겠습니까?`)) {
      console.log('[MasterData] handleDirectDelete confirmed for id:', id);
      deleteMaterial(id);
      toast.success('자재가 삭제되었습니다.');
    }
  };

  const handleDirectDeleteProduct = (id: number, name: string) => {
    if (window.confirm(`"${name}" 완제품을 정말 삭제하시겠습니까?`)) {
      deleteProduct(id);
      toast.success('완제품이 삭제되었습니다.');
    }
  };

  const handleDirectDeleteBOM = (productCode: string) => {
    if (window.confirm(`"${productCode}" BOM 전체를 정말 삭제하시겠습니까?`)) {
      const count = deleteBOMByProduct(productCode);
      toast.success(`${count}건의 BOM이 삭제되었습니다.`);
    }
  };

  const handleDownloadTemplate = () => {
    const templateType = type as 'product' | 'material' | 'bom'
    if (templateType === 'product' || templateType === 'material' || templateType === 'bom') {
      downloadImportTemplate(templateType)
      toast.success('양식 파일이 다운로드되었습니다.')
    } else {
      toast.info('이 유형은 템플릿이 없습니다.')
    }
  };

  const handleUploadClick = () => {
    const validTypes = ['product', 'material', 'bom'];
    if (validTypes.includes(type || '')) {
      setIsUploadDialogOpen(true);
    } else {
      toast.info('이 유형은 업로드가 지원되지 않습니다.');
    }
  };

  const handleImportComplete = (result: { success: boolean; importedRows: number; errors: unknown[]; data?: unknown[] }) => {
    // Import된 데이터를 Context에 추가
    if (result.data && result.data.length > 0) {
      if (type === 'product') {
        const productData = result.data as Omit<Product, 'id' | 'regDate'>[];
        const addedCount = addProducts(productData);
        toast.success(`${addedCount}건이 등록되었습니다.`);
      } else if (type === 'material') {
        // 자재 일괄 등록 (품목마스터 양식 - 전체 필드 매핑)
        const materialData = result.data.map((item: unknown) => {
          const mat = item as {
            code: string; name: string;
            supplierCode?: string; pdaCode?: string; hqCode?: string;
            supplier?: string; customerCode?: string;
            spec?: string; spec2?: string; spec3?: string;
            wireMaterial?: string; wireGauge?: string; color?: string;
            projectCode?: string; category?: string;
            unit?: string; unitWeight?: number; weightUnit?: string;
            safeStock?: number; description?: string;
          };
          return {
            code: mat.code,
            name: mat.name,
            // 바코드 매칭용
            supplierCode: mat.supplierCode,
            pdaCode: mat.pdaCode,
            hqCode: mat.hqCode,
            // 공급처
            supplier: mat.supplier,
            customerCode: mat.customerCode,
            // 규격
            spec: mat.spec || '',
            spec2: mat.spec2,
            spec3: mat.spec3,
            // 전선 정보
            wireMaterial: mat.wireMaterial,
            wireGauge: mat.wireGauge,
            color: mat.color,
            // 분류
            projectCode: mat.projectCode,
            category: mat.category || '원재료',
            // 단위
            unit: mat.unit || 'EA',
            unitWeight: mat.unitWeight,
            weightUnit: mat.weightUnit,
            // 기타
            safeStock: mat.safeStock || 0,
            desc: mat.description || ''
          };
        });
        const addedCount = addMaterials(materialData);
        toast.success(`${addedCount}건이 등록되었습니다.`);
      } else if (type === 'bom') {
        // BOM 일괄 등록 (Excel 필드명: productCode, itemCode, quantity, unit, processCode, crimpCode)
        // level은 processCode에서 자동 산출됨 (BOMContext.addBOMItems → determineLevel)
        const bomData = result.data.map((item: unknown) => {
          const bom = item as {
            productCode: string;
            itemCode: string;
            quantity?: number;
            unit?: string;
            processCode?: string;  // 공정 코드 (PA/MC/SB/MS/CA)
            crimpCode?: string;    // 절압착 품번 (CA 자재용)
          };

          // 공정 코드 정규화 (대문자 변환)
          const processCode = (bom.processCode || '').toUpperCase();

          return {
            productCode: bom.productCode,
            productName: undefined, // Excel에서 품명은 가져오지 않음
            materialCode: bom.itemCode, // itemCode → materialCode 매핑
            materialName: bom.itemCode, // 자재명은 품번으로 대체 (실제 서비스에서 조회 필요)
            quantity: bom.quantity || 1,
            unit: bom.unit || 'EA',
            processCode: processCode,  // 공정 코드 (level 자동 산출용)
            crimpCode: processCode === 'CA' ? bom.crimpCode : undefined,  // CA 자재만 crimpCode 적용
            // level은 addBOMItems에서 determineLevel(processCode)로 자동 산출
          };
        });
        const addedCount = addBOMItems(bomData);
        toast.success(`${addedCount}건이 등록되었습니다.`);
      } else {
        toast.success(`${result.importedRows}건이 파싱되었습니다. (저장 기능 미구현)`);
      }
    } else if (result.success) {
      toast.success(`${result.importedRows}건이 등록되었습니다.`);
    } else {
      toast.warning(`${result.importedRows}건 파싱, ${result.errors.length}건 오류 발생`);
    }
  };

  // ============================================================
  // BOM 3-Level 펼치기/접기 토글 함수
  // ============================================================

  // LV0: 품번 토글
  const toggleProductExpand = (productCode: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productCode)) {
        newSet.delete(productCode);
      } else {
        newSet.add(productCode);
      }
      return newSet;
    });
  };

  // LV1-4: 레벨 토글 (품번별)
  const toggleLevelExpand = (productCode: string, level: number) => {
    setExpandedLevels(prev => {
      const newMap = new Map(prev);
      const levels = newMap.get(productCode) || new Set<number>();
      const newLevels = new Set(levels);
      if (newLevels.has(level)) {
        newLevels.delete(level);
      } else {
        newLevels.add(level);
      }
      newMap.set(productCode, newLevels);
      return newMap;
    });
  };

  // CA crimpCode 토글 (품번별)
  const toggleCrimpExpand = (productCode: string, crimpCode: string) => {
    setExpandedCrimps(prev => {
      const newMap = new Map(prev);
      const crimps = newMap.get(productCode) || new Set<string>();
      const newCrimps = new Set(crimps);
      if (newCrimps.has(crimpCode)) {
        newCrimps.delete(crimpCode);
      } else {
        newCrimps.add(crimpCode);
      }
      newMap.set(productCode, newCrimps);
      return newMap;
    });
  };

  // 레벨 펼침 상태 확인
  const isLevelExpanded = (productCode: string, level: number): boolean => {
    return expandedLevels.get(productCode)?.has(level) || false;
  };

  // crimpCode 펼침 상태 확인
  const isCrimpExpanded = (productCode: string, crimpCode: string): boolean => {
    return expandedCrimps.get(productCode)?.has(crimpCode) || false;
  };

  // 전체 펼치기 (모든 레벨)
  const expandAll = () => {
    // 모든 품번 펼치기
    setExpandedProducts(new Set(bomGroups.map(g => g.productCode)));

    // 모든 레벨 펼치기
    const newLevels = new Map<string, Set<number>>();
    bomGroups.forEach(group => {
      newLevels.set(group.productCode, new Set(group.levelGroups.map(lg => lg.level)));
    });
    setExpandedLevels(newLevels);

    // 모든 crimpCode 펼치기
    const newCrimps = new Map<string, Set<string>>();
    bomGroups.forEach(group => {
      const level4 = group.levelGroups.find(lg => lg.level === 4);
      if (level4?.crimpGroups) {
        newCrimps.set(group.productCode, new Set(level4.crimpGroups.map(cg => cg.crimpCode)));
      }
    });
    setExpandedCrimps(newCrimps);
  };

  // 전체 접기
  const collapseAll = () => {
    setExpandedProducts(new Set());
    setExpandedLevels(new Map());
    setExpandedCrimps(new Map());
  };

  // 레벨별 배지 색상
  const getLevelBadgeColor = (level: number): string => {
    switch (level) {
      case 1: return 'bg-blue-100 text-blue-700 border-blue-200';
      case 2: return 'bg-green-100 text-green-700 border-green-200';
      case 3: return 'bg-amber-100 text-amber-700 border-amber-200';
      case 4: return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Product handlers
  const handleEditProduct = (item: Product) => {
    setCurrentProduct({ ...item });
    setIsProductModalOpen(true);
  };

  const handleAddNewProduct = () => {
    setCurrentProduct({
      id: 0,
      code: '',
      name: '',
      spec: '',
      type: 'FINISHED',
      description: '',
      regDate: ''
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    if (currentProduct.id > 0) {
      updateProduct(currentProduct);
      toast.success(`${currentProduct.name} 정보가 수정되었습니다.`);
    } else {
      addProduct({
        code: currentProduct.code,
        name: currentProduct.name,
        spec: currentProduct.spec,
        type: currentProduct.type || 'FINISHED',
        processCode: currentProduct.processCode,
        crimpCode: currentProduct.crimpCode,
        description: currentProduct.description
      });
      toast.success('새로운 완제품이 등록되었습니다.');
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id: number) => {
    deleteProduct(id);
    toast.success('완제품이 삭제되었습니다.');
  };

  const renderMaterialTable = () => (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">품목 마스터</CardTitle>
          <CardDescription>품목마스터 관리 양식 기반 자재 정보 ({materials.length}건)</CardDescription>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="품번, 품명, 공급사품번 검색..." className="pl-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[100px] text-xs">경림품번</TableHead>
                <TableHead className="text-xs">품명</TableHead>
                <TableHead className="text-xs">공급사품번</TableHead>
                <TableHead className="text-xs">PDA품번</TableHead>
                <TableHead className="text-xs">공급처</TableHead>
                <TableHead className="text-xs">규격</TableHead>
                <TableHead className="text-xs text-center">색상</TableHead>
                <TableHead className="text-xs text-center">단위</TableHead>
                <TableHead className="text-xs">품목유형</TableHead>
                <TableHead className="w-[100px] text-center">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                    등록된 자재가 없습니다. 엑셀 업로드로 품목마스터를 등록하세요.
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs font-medium text-blue-600">{item.code}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate" title={item.name}>{item.name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{item.supplierCode || '-'}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{item.pdaCode || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[100px] truncate" title={item.supplier}>{item.supplier || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{item.spec || '-'}</TableCell>
                    <TableCell className="text-center">
                      {item.color && (
                        <Badge variant="outline" className="text-xs font-normal">{item.color}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs font-normal">{item.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{item.category || '원재료'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-blue-50"
                          onClick={() => handleEdit(item)}
                          title="정보 수정"
                        >
                          <Edit2 className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-red-50"
                          onClick={() => handleDirectDelete(item.id, item.name || item.code)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderProductTable = () => (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">완제품 목록</CardTitle>
          <CardDescription>완제품 품번 정보를 관리합니다. ({products.length}건)</CardDescription>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="품번 또는 품명 검색..." className="pl-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">품번</TableHead>
              <TableHead>품명</TableHead>
              <TableHead>규격</TableHead>
              <TableHead className="text-center">유형</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className="w-[100px] text-center">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  등록된 품번이 없습니다. 신규 등록 버튼을 눌러 추가하세요.
                </TableCell>
              </TableRow>
            ) : (
              products.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-slate-500">{item.spec || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-normal">
                      {item.type === 'FINISHED' ? '완제품' : item.type === 'SEMI' ? '반제품' : item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 truncate max-w-[200px]">{item.description || '-'}</TableCell>
                  <TableCell className="text-slate-500">{item.regDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-blue-50"
                        onClick={() => handleEditProduct(item)}
                        title="정보 수정"
                      >
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-red-50"
                        onClick={() => handleDirectDeleteProduct(item.id, item.name || item.code)}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    if (type === 'product') {
      return renderProductTable();
    }

    if (type === 'material') {
      return renderMaterialTable();
    }

    if (type === 'bom') {
      return (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-blue-600" />
                BOM 구조 목록
              </CardTitle>
              <CardDescription>
                완제품/반제품별 자재 구성을 관리합니다. ({bomGroups.length}개 품번, {bomItems.length}개 자재)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} disabled={bomGroups.length === 0}>
                전체 펼치기
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} disabled={bomGroups.length === 0}>
                전체 접기
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {bomGroups.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <FolderTree size={48} className="mx-auto mb-4 opacity-20" />
                <p>등록된 BOM이 없습니다.</p>
                <p className="text-sm mt-2">양식 다운로드 후 Excel로 업로드하세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bomGroups.map((group) => {
                  const isProductExpanded = expandedProducts.has(group.productCode);
                  return (
                    <div key={group.productCode} className="bg-white">
                      {/* ========================================== */}
                      {/* LV0: 품번 헤더 (클릭하여 펼치기/접기) */}
                      {/* ========================================== */}
                      <button
                        onClick={() => toggleProductExpand(group.productCode)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isProductExpanded ? (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-mono text-xs">
                              LV0
                            </Badge>
                            <span className="font-mono font-semibold text-blue-600">{group.productCode}</span>
                            {group.productName && (
                              <span className="text-slate-600">{group.productName}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-normal">
                            {group.levelGroups.length}개 공정 / {group.totalItems}개 자재
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDeleteBOM(group.productCode);
                            }}
                            title="이 품번 BOM 전체 삭제"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </button>

                      {/* ========================================== */}
                      {/* LV1-4: 레벨별 그룹 (품번 펼쳐졌을 때만 표시) */}
                      {/* ========================================== */}
                      {isProductExpanded && (
                        <div className="bg-slate-50 border-t border-slate-100">
                          {group.levelGroups.map((levelGroup) => {
                            const isLevelOpen = isLevelExpanded(group.productCode, levelGroup.level);
                            const hascrimpGroups = levelGroup.level === 4 && levelGroup.crimpGroups && levelGroup.crimpGroups.length > 0;

                            return (
                              <div key={`${group.productCode}-L${levelGroup.level}`} className="border-b border-slate-100 last:border-b-0">
                                {/* 레벨 헤더 */}
                                <button
                                  onClick={() => toggleLevelExpand(group.productCode, levelGroup.level)}
                                  className="w-full flex items-center justify-between pl-8 pr-4 py-2.5 hover:bg-slate-100/70 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    {isLevelOpen ? (
                                      <ChevronDown className="h-4 w-4 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )}
                                    <Badge variant="outline" className={`font-mono text-xs ${getLevelBadgeColor(levelGroup.level)}`}>
                                      LV{levelGroup.level}
                                    </Badge>
                                    <span className="font-medium text-slate-700">
                                      {levelGroup.processCode} {levelGroup.processName}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" className="font-normal text-xs">
                                    {levelGroup.items.length}개 자재
                                    {hascrimpGroups && ` / ${levelGroup.crimpGroups!.length}개 절압품번`}
                                  </Badge>
                                </button>

                                {/* 레벨 내용 (펼쳐졌을 때만 표시) */}
                                {isLevelOpen && (
                                  <div className="bg-white">
                                    {/* LV4 CA: crimpCode별 하위 그룹 */}
                                    {hascrimpGroups ? (
                                      <div className="divide-y divide-slate-50">
                                        {levelGroup.crimpGroups!.map((crimpGroup) => {
                                          const isCrimpOpen = isCrimpExpanded(group.productCode, crimpGroup.crimpCode);

                                          return (
                                            <div key={`${group.productCode}-${crimpGroup.crimpCode}`}>
                                              {/* crimpCode 헤더 */}
                                              <button
                                                onClick={() => toggleCrimpExpand(group.productCode, crimpGroup.crimpCode)}
                                                className="w-full flex items-center justify-between pl-16 pr-4 py-2 hover:bg-slate-50 transition-colors text-left"
                                              >
                                                <div className="flex items-center gap-3">
                                                  {isCrimpOpen ? (
                                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                                  ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                  )}
                                                  <Package className="h-4 w-4 text-purple-500" />
                                                  <span className="font-mono text-sm text-purple-700">{crimpGroup.crimpCode}</span>
                                                </div>
                                                <Badge variant="outline" className="font-normal text-xs">
                                                  {crimpGroup.items.length}개
                                                </Badge>
                                              </button>

                                              {/* crimpCode 자재 테이블 */}
                                              {isCrimpOpen && (
                                                <div className="pl-20 pr-4 pb-2">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow className="bg-purple-50/50">
                                                        <TableHead className="w-[140px] text-xs">자재 품번</TableHead>
                                                        <TableHead className="text-xs">자재명</TableHead>
                                                        <TableHead className="text-right w-[80px] text-xs">소요량</TableHead>
                                                        <TableHead className="w-[60px] text-xs">단위</TableHead>
                                                        <TableHead className="w-[40px]"></TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {crimpGroup.items.map((item) => (
                                                        <TableRow key={item.id} className="hover:bg-purple-50/30">
                                                          <TableCell className="font-mono text-xs py-1.5">{item.materialCode}</TableCell>
                                                          <TableCell className="text-xs py-1.5">{item.materialName}</TableCell>
                                                          <TableCell className="text-right font-medium text-purple-600 text-xs py-1.5">
                                                            {item.quantity.toLocaleString()}
                                                          </TableCell>
                                                          <TableCell className="py-1.5">
                                                            <Badge variant="outline" className="font-normal text-xs">{item.unit}</Badge>
                                                          </TableCell>
                                                          <TableCell className="py-1.5">
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                              onClick={() => {
                                                                deleteBOMItem(item.id);
                                                                toast.success('자재가 삭제되었습니다.');
                                                              }}
                                                            >
                                                              <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      /* LV1-3: 일반 자재 테이블 */
                                      <div className="pl-12 pr-4 py-2">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className={`${levelGroup.level === 1 ? 'bg-blue-50/50' : levelGroup.level === 2 ? 'bg-green-50/50' : 'bg-amber-50/50'}`}>
                                              <TableHead className="w-[140px] text-xs">자재 품번</TableHead>
                                              <TableHead className="text-xs">자재명</TableHead>
                                              <TableHead className="text-right w-[80px] text-xs">소요량</TableHead>
                                              <TableHead className="w-[60px] text-xs">단위</TableHead>
                                              <TableHead className="text-xs">비고</TableHead>
                                              <TableHead className="w-[40px]"></TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {levelGroup.items.map((item) => (
                                              <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono text-xs py-1.5">{item.materialCode}</TableCell>
                                                <TableCell className="text-xs py-1.5">{item.materialName}</TableCell>
                                                <TableCell className={`text-right font-medium text-xs py-1.5 ${levelGroup.level === 1 ? 'text-blue-600' : levelGroup.level === 2 ? 'text-green-600' : 'text-amber-600'}`}>
                                                  {item.quantity.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-1.5">
                                                  <Badge variant="outline" className="font-normal text-xs">{item.unit}</Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-400 text-xs py-1.5 truncate max-w-[120px]">
                                                  {item.description || '-'}
                                                </TableCell>
                                                <TableCell className="py-1.5">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => {
                                                      deleteBOMItem(item.id);
                                                      toast.success('자재가 삭제되었습니다.');
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Default Fallback for other types (product, user) - 아직 서비스 미연동
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">데이터 목록</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="검색어 입력..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>완제품 품번</TableHead>
                <TableHead>품명</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  {type === 'product' && '등록된 품번이 없습니다. 신규 등록 버튼을 눌러 추가하세요.'}
                  {type === 'user' && '등록된 사용자가 없습니다. (admin 제외)'}
                  {type !== 'product' && type !== 'user' && '데이터가 없습니다.'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">{getTitle()}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDown className="mr-2 h-4 w-4" /> 양식
          </Button>
          <Button variant="outline" onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" /> 업로드
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
            if (type === 'material') handleAddNew();
            else if (type === 'product') handleAddNewProduct();
            else toast.info('이 기능은 현재 자재/완제품 관리에서만 사용할 수 있습니다.');
          }}>
            <Plus className="mr-2 h-4 w-4" /> 신규 등록
          </Button>
        </div>
      </div>

      {renderContent()}

      {/* Material Edit/Create Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentMaterial?.id ? '자재 정보 수정' : '신규 자재 등록'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">자재 품번</Label>
                  <Input 
                    id="code" 
                    value={currentMaterial?.code || ''} 
                    onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, code: e.target.value} : null)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">자재 유형</Label>
                  <Input
                    id="category"
                    value={currentMaterial?.category || ''}
                    onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, category: e.target.value} : null)}
                    placeholder="예: 원자재, 부자재"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">품명</Label>
                <Input 
                  id="name" 
                  value={currentMaterial?.name || ''} 
                  onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, name: e.target.value} : null)}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="spec">규격/사양</Label>
                  <Input 
                    id="spec" 
                    value={currentMaterial?.spec || ''} 
                    onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, spec: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">단위</Label>
                  <Input 
                    id="unit" 
                    value={currentMaterial?.unit || ''} 
                    onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, unit: e.target.value} : null)}
                  />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <Label htmlFor="safeStock" className="font-semibold text-slate-700">안전 재고 (알림 기준)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    id="safeStock" 
                    type="number"
                    className="bg-white"
                    value={currentMaterial?.safeStock || 0} 
                    onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, safeStock: parseInt(e.target.value)} : null)}
                  />
                  <span className="text-sm text-slate-500 whitespace-nowrap">
                    {currentMaterial?.unit || 'EA'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  * 재고량이 이 수치보다 낮아지면 대시보드에 알림이 표시됩니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">비고 / 설명</Label>
                <Input 
                  id="desc" 
                  value={currentMaterial?.desc || ''} 
                  onChange={(e) => setCurrentMaterial(prev => prev ? {...prev, desc: e.target.value} : null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>취소</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" /> 저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Edit/Create Dialog */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentProduct?.id ? '완제품 정보 수정' : '신규 완제품 등록'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productCode">품번 *</Label>
                  <Input
                    id="productCode"
                    value={currentProduct?.code || ''}
                    onChange={(e) => setCurrentProduct(prev => prev ? {...prev, code: e.target.value} : null)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productType">유형</Label>
                  <Input
                    id="productType"
                    value={currentProduct?.type || 'FINISHED'}
                    onChange={(e) => setCurrentProduct(prev => prev ? {...prev, type: e.target.value} : null)}
                    placeholder="FINISHED, SEMI"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productName">품명 *</Label>
                <Input
                  id="productName"
                  value={currentProduct?.name || ''}
                  onChange={(e) => setCurrentProduct(prev => prev ? {...prev, name: e.target.value} : null)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productSpec">규격/사양</Label>
                <Input
                  id="productSpec"
                  value={currentProduct?.spec || ''}
                  onChange={(e) => setCurrentProduct(prev => prev ? {...prev, spec: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productDesc">설명</Label>
                <Input
                  id="productDesc"
                  value={currentProduct?.description || ''}
                  onChange={(e) => setCurrentProduct(prev => prev ? {...prev, description: e.target.value} : null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsProductModalOpen(false)}>취소</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" /> 저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        importType={(type || 'material') as ImportType}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};
