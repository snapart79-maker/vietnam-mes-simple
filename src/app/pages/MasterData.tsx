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
import { Plus, Search, Edit2, Trash2, MoreHorizontal, FileDown, Upload, FolderTree, Package, Save } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useMaterial, Material } from '../context/MaterialContext';
import { downloadImportTemplate } from '@/services/excelImportService';

export const MasterData = () => {
  const { type } = useParams<{ type: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null);
  
  // Use Global Context
  const { materials, addMaterial, updateMaterial, deleteMaterial } = useMaterial();

  const getTitle = () => {
    switch (type) {
      case 'product': return '품번 관리 (Product Master)';
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
    deleteMaterial(id);
    toast.success('자재가 삭제되었습니다.');
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

  const renderMaterialTable = () => (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">자재 목록</CardTitle>
          <CardDescription>재고 관리의 기준이 되는 자재 정보를 관리합니다.</CardDescription>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="자재명 또는 코드 검색..." className="pl-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>품명</TableHead>
              <TableHead>규격/사양</TableHead>
              <TableHead className="text-center">단위</TableHead>
              <TableHead>유형</TableHead>
              <TableHead className="text-right">안전 재고</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-slate-500">{item.spec}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-normal">{item.unit}</Badge>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-right font-medium text-blue-600">
                  {item.safeStock.toLocaleString()}
                </TableCell>
                <TableCell className="text-slate-500 truncate max-w-[150px]">{item.desc}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(item)}>
                        <Edit2 className="mr-2 h-4 w-4" /> 정보 수정
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    // Only 'material' type is fully implemented for this demo
    if (type === 'material') {
      return renderMaterialTable();
    }

    if (type === 'bom') {
      return (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-8 text-center text-slate-500">
            <FolderTree size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">BOM 구조 관리</h3>
            <p>제품을 선택하면 하위 자재 구조가 트리 형태로 표시됩니다.</p>
            <div className="mt-6 flex justify-center gap-4">
              <Input placeholder="완제품 품번 검색..." className="max-w-xs" />
              <Button>조회</Button>
            </div>
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
                <TableHead>코드</TableHead>
                <TableHead>명칭</TableHead>
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
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" /> 업로드
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
            if (type === 'material') handleAddNew();
            else toast.info('이 기능은 현재 자재 관리에서만 사용할 수 있습니다.');
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
                  <Label htmlFor="code">자재 코드</Label>
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
    </div>
  );
};
