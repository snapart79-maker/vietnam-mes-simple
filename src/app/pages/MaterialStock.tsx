import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Search, Download, History, Layers, RefreshCw, Trash2, ArrowUpRight, FolderTree } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { downloadExcel } from '@/lib/excelUtils';
import { toast } from 'sonner';
import {
  getAllStocks,
  getAllReceivings,
  getStockSummary,
  deleteStockItems,
  deleteReceivingRecords,
  resetAllStockData,
  type StockItem,
  type ReceivingRecord,
} from '@/services/mock/stockService.mock';

// 선택 가능한 아이템 타입 확장
interface SelectableStockItem extends StockItem {
  selected: boolean;
}

interface SelectableReceivingRecord extends ReceivingRecord {
  selected: boolean;
}

export const MaterialStock = () => {
  const [showExhausted, setShowExhausted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('lot');

  // LOT별 재고 데이터 (선택 기능 포함)
  const [lotStocks, setLotStocks] = useState<SelectableStockItem[]>([]);
  const [receivings, setReceivings] = useState<SelectableReceivingRecord[]>([]);
  const [summary, setSummary] = useState({
    totalLots: 0,
    totalQuantity: 0,
    totalAvailable: 0,
    totalUsed: 0,
    materialCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 삭제 확인 다이얼로그
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'lot' | 'receiving' | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);


  // 데이터 로드
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stocks, history, stats] = await Promise.all([
        getAllStocks({ showZero: showExhausted }),
        getAllReceivings({ limit: 100 }),
        getStockSummary(),
      ]);
      // 선택 필드 추가
      setLotStocks(stocks.map(s => ({ ...s, selected: false })));
      setReceivings(history.map(r => ({ ...r, selected: false })));
      setSummary(stats);
    } catch (error) {
      console.error('Failed to load stock data:', error);
      toast.error('재고 데이터 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [showExhausted]);

  // ========== 선택 토글 함수들 ==========

  // LOT별 재고 선택 토글
  const toggleLotSelection = (id: number) => {
    setLotStocks(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const toggleAllLots = () => {
    const filtered = filteredLotStocks;
    const allSelected = filtered.every(l => l.selected);
    setLotStocks(prev =>
      prev.map(item =>
        filtered.some(f => f.id === item.id)
          ? { ...item, selected: !allSelected }
          : item
      )
    );
  };

  // 입고 이력 선택 토글
  const toggleReceivingSelection = (id: number) => {
    setReceivings(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const toggleAllReceivings = () => {
    const filtered = filteredReceivings;
    const allSelected = filtered.every(r => r.selected);
    setReceivings(prev =>
      prev.map(item =>
        filtered.some(f => f.id === item.id)
          ? { ...item, selected: !allSelected }
          : item
      )
    );
  };

  // ========== 삭제 함수들 ==========

  const handleDeleteSelected = (target: 'lot' | 'receiving') => {
    let count = 0;
    switch (target) {
      case 'lot':
        count = lotStocks.filter(l => l.selected).length;
        break;
      case 'receiving':
        count = receivings.filter(r => r.selected).length;
        break;
    }

    if (count === 0) {
      toast.error('삭제할 항목을 선택하세요.');
      return;
    }

    setDeleteTarget(target);
    setDeleteCount(count);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    switch (deleteTarget) {
      case 'lot':
        // LOT 재고 삭제 (localStorage에서도 삭제)
        const lotIdsToDelete = lotStocks.filter(l => l.selected).map(l => l.id);
        const deletedLots = deleteStockItems(lotIdsToDelete);
        setLotStocks(prev => prev.filter(l => !l.selected));
        toast.success(`${deletedLots}건의 LOT 재고가 삭제되었습니다.`);
        break;
      case 'receiving':
        // 입고 이력 삭제 (localStorage에서도 삭제)
        const receivingIdsToDelete = receivings.filter(r => r.selected).map(r => r.id);
        const deletedReceivings = deleteReceivingRecords(receivingIdsToDelete);
        setReceivings(prev => prev.filter(r => !r.selected));
        toast.success(`${deletedReceivings}건의 입고 이력이 삭제되었습니다.`);
        break;
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setDeleteCount(0);
    // 요약 통계 갱신
    loadData();
  };

  // 전체 데이터 초기화
  const handleResetAll = () => {
    if (window.confirm('모든 재고 데이터와 입고 이력을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      const result = resetAllStockData();
      setLotStocks([]);
      setReceivings([]);
      setSummary({ totalLots: 0, totalQuantity: 0, totalAvailable: 0, totalUsed: 0, materialCount: 0 });
      toast.success(`재고 ${result.stocks}건, 입고 이력 ${result.receivings}건이 삭제되었습니다.`);
    }
  };

  // ========== 엑셀 다운로드 ==========

  // LOT별 재고 다운로드
  const handleDownloadLotStock = () => {
    const exportData = lotStocks.map(item => ({
      '품번': item.materialCode,
      '품명': item.materialName,
      'LOT번호': item.lotNumber,
      '입고수량': item.quantity,
      '사용수량': item.usedQty,
      '가용수량': item.availableQty,
      '입고일자': item.receivedAt.split('T')[0],
    }));
    downloadExcel(exportData, '재고현황_LOT별', 'LOT별재고');
    toast.success('LOT별 재고가 다운로드되었습니다.');
  };

  // 탭3: 입고 이력 다운로드
  const handleDownloadReceivings = () => {
    const exportData = receivings.map(item => ({
      '입고일자': item.receivedAt.split('T')[0],
      '입고시간': item.receivedAt.split('T')[1]?.split('.')[0] || '',
      '품번': item.material.code,
      '품명': item.material.name,
      'LOT번호': item.lotNumber,
      '수량': item.quantity,
      '단위': item.material.unit,
    }));
    downloadExcel(exportData, '입고이력', '입고이력');
    toast.success('입고 이력이 다운로드되었습니다.');
  };

  // ========== 필터링 ==========

  // 필터링된 LOT 재고
  const filteredLotStocks = lotStocks.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.materialCode.toLowerCase().includes(query) ||
      item.materialName.toLowerCase().includes(query) ||
      item.lotNumber.toLowerCase().includes(query)
    );
  });

  // 필터링된 입고 이력
  const filteredReceivings = receivings.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.material.code.toLowerCase().includes(query) ||
      item.material.name.toLowerCase().includes(query) ||
      item.lotNumber.toLowerCase().includes(query)
    );
  });

  // 선택 개수
  const selectedLotCount = lotStocks.filter(l => l.selected).length;
  const selectedReceivingCount = receivings.filter(r => r.selected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">자재 재고 현황</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="destructive" size="sm" onClick={handleResetAll} disabled={summary.totalLots === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            전체 삭제
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{summary.totalLots}</div>
            <div className="text-sm text-slate-500">총 LOT 수</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{summary.totalQuantity.toLocaleString()}</div>
            <div className="text-sm text-slate-500">총 입고수량</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{summary.totalUsed.toLocaleString()}</div>
            <div className="text-sm text-slate-500">총 사용수량</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">{(summary.totalQuantity - summary.totalUsed).toLocaleString()}</div>
            <div className="text-sm text-slate-500">잔여 재고</div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 필터 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="grid w-full gap-1.5 flex-1">
              <Label htmlFor="search">검색어</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="품번, 품명, LOT번호로 검색..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pb-2">
              <Checkbox
                id="exhausted"
                checked={showExhausted}
                onCheckedChange={(checked) => setShowExhausted(checked as boolean)}
              />
              <Label htmlFor="exhausted" className="cursor-pointer">소진된 재고 포함</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 탭 컨텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="lot" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            LOT별 재고
          </TabsTrigger>
          <TabsTrigger value="category" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            종류별 재고
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            입고 이력
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            출고 이력
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: LOT별 재고 */}
        <TabsContent value="lot" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">LOT별 상세 재고 ({filteredLotStocks.length}건)</CardTitle>
              <div className="flex gap-2">
                {selectedLotCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSelected('lot')}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    선택 삭제 ({selectedLotCount})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownloadLotStock}>
                  <Download className="mr-2 h-4 w-4" />
                  엑셀 다운로드
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={filteredLotStocks.length > 0 && filteredLotStocks.every(l => l.selected)}
                          onCheckedChange={toggleAllLots}
                          disabled={filteredLotStocks.length === 0}
                        />
                      </th>
                      <th className="px-4 py-3">품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">입고수량</th>
                      <th className="px-4 py-3 text-right">사용수량</th>
                      <th className="px-4 py-3 text-right">가용수량</th>
                      <th className="px-4 py-3">입고일자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLotStocks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          입고된 재고가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredLotStocks.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 transition-colors ${item.selected ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleLotSelection(item.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{item.materialCode}</td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.lotNumber}</td>
                          <td className="px-4 py-3 text-right">{item.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{item.usedQty.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            item.availableQty <= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.availableQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.receivedAt.split('T')[0]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탭 3: 입고 이력 */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">입고 이력 ({filteredReceivings.length}건)</CardTitle>
              <div className="flex gap-2">
                {selectedReceivingCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSelected('receiving')}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    선택 삭제 ({selectedReceivingCount})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownloadReceivings}>
                  <Download className="mr-2 h-4 w-4" />
                  엑셀 다운로드
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={filteredReceivings.length > 0 && filteredReceivings.every(r => r.selected)}
                          onCheckedChange={toggleAllReceivings}
                          disabled={filteredReceivings.length === 0}
                        />
                      </th>
                      <th className="px-4 py-3">입고일시</th>
                      <th className="px-4 py-3">품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">단위</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReceivings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          입고 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivings.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 transition-colors ${item.selected ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleReceivingSelection(item.id)}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.receivedAt.split('T')[0]}{' '}
                            <span className="text-slate-400 text-xs">
                              {item.receivedAt.split('T')[1]?.split('.')[0] || ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{item.material.code}</td>
                          <td className="px-4 py-3">{item.material.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.lotNumber}</td>
                          <td className="px-4 py-3 text-right font-bold">{item.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{item.material.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탭 2: 종류별 재고 */}
        <TabsContent value="category" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">자재 종류별 재고 현황</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                // 종류별 재고 그룹핑 데이터
                const grouped = lotStocks.reduce((acc, item) => {
                  const key = item.materialCode;
                  if (!acc[key]) {
                    acc[key] = {
                      materialCode: item.materialCode,
                      materialName: item.materialName,
                      totalQty: 0,
                      usedQty: 0,
                      availableQty: 0,
                      lotCount: 0,
                    };
                  }
                  acc[key].totalQty += item.quantity;
                  acc[key].usedQty += item.usedQty;
                  acc[key].availableQty += item.availableQty;
                  acc[key].lotCount += 1;
                  return acc;
                }, {} as Record<string, { materialCode: string; materialName: string; totalQty: number; usedQty: number; availableQty: number; lotCount: number }>);

                const exportData = Object.values(grouped).map(item => ({
                  '품번': item.materialCode,
                  '품명': item.materialName,
                  'LOT 수': item.lotCount,
                  '총 입고수량': item.totalQty,
                  '사용수량': item.usedQty,
                  '잔여수량': item.availableQty,
                }));
                downloadExcel(exportData, '종류별재고현황', '종류별재고');
                toast.success('종류별 재고 현황이 다운로드되었습니다.');
              }}>
                <Download className="mr-2 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3 text-center">LOT 수</th>
                      <th className="px-4 py-3 text-right">총 입고수량</th>
                      <th className="px-4 py-3 text-right">사용수량</th>
                      <th className="px-4 py-3 text-right">잔여수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(() => {
                      // 종류별 재고 그룹핑
                      const grouped = lotStocks.reduce((acc, item) => {
                        const key = item.materialCode;
                        if (!acc[key]) {
                          acc[key] = {
                            materialCode: item.materialCode,
                            materialName: item.materialName,
                            totalQty: 0,
                            usedQty: 0,
                            availableQty: 0,
                            lotCount: 0,
                          };
                        }
                        acc[key].totalQty += item.quantity;
                        acc[key].usedQty += item.usedQty;
                        acc[key].availableQty += item.availableQty;
                        acc[key].lotCount += 1;
                        return acc;
                      }, {} as Record<string, { materialCode: string; materialName: string; totalQty: number; usedQty: number; availableQty: number; lotCount: number }>);

                      const categoryData = Object.values(grouped).filter(item => {
                        const query = searchQuery.toLowerCase();
                        return (
                          item.materialCode.toLowerCase().includes(query) ||
                          item.materialName.toLowerCase().includes(query)
                        );
                      });

                      if (categoryData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              입고된 재고가 없습니다.
                            </td>
                          </tr>
                        );
                      }

                      return categoryData.map((item) => (
                        <tr key={item.materialCode} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium">{item.materialCode}</td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline">{item.lotCount}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">{item.totalQty.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{item.usedQty.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            item.availableQty <= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.availableQty.toLocaleString()}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탭 4: 출고 이력 */}
        <TabsContent value="outgoing" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">출고(사용) 이력</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                // 사용 기록이 있는 LOT만 추출
                const usedLots = lotStocks.filter(l => l.usedQty > 0);
                const exportData = usedLots.map(item => ({
                  '품번': item.materialCode,
                  '품명': item.materialName,
                  'LOT번호': item.lotNumber,
                  '입고수량': item.quantity,
                  '사용수량': item.usedQty,
                  '잔여수량': item.availableQty,
                  '입고일자': item.receivedAt.split('T')[0],
                }));
                downloadExcel(exportData, '출고이력', '출고이력');
                toast.success('출고 이력이 다운로드되었습니다.');
              }}>
                <Download className="mr-2 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">입고수량</th>
                      <th className="px-4 py-3 text-right">사용수량</th>
                      <th className="px-4 py-3 text-right">잔여수량</th>
                      <th className="px-4 py-3">입고일자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(() => {
                      // 사용 기록이 있는 LOT만 필터링
                      const usedLots = lotStocks.filter(l => {
                        if (l.usedQty <= 0) return false;
                        const query = searchQuery.toLowerCase();
                        return (
                          l.materialCode.toLowerCase().includes(query) ||
                          l.materialName.toLowerCase().includes(query) ||
                          l.lotNumber.toLowerCase().includes(query)
                        );
                      });

                      if (usedLots.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              출고(사용) 이력이 없습니다.
                            </td>
                          </tr>
                        );
                      }

                      return usedLots.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium">{item.materialCode}</td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.lotNumber}</td>
                          <td className="px-4 py-3 text-right">{item.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-orange-600 font-bold">{item.usedQty.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right ${
                            item.availableQty <= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.availableQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.receivedAt.split('T')[0]}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {deleteCount}건을 목록에서 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
