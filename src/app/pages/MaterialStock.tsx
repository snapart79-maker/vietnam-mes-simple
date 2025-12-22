import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search, Download, Package, History, Layers, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useMaterial } from '../context/MaterialContext';
import { downloadExcel } from '@/lib/excelUtils';
import { toast } from 'sonner';
import {
  getAllStocks,
  getAllReceivings,
  getStockSummary,
  type StockItem,
  type ReceivingRecord,
} from '@/services/mock/stockService.mock';

export const MaterialStock = () => {
  const [showExhausted, setShowExhausted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  // LOT별 재고 데이터
  const [lotStocks, setLotStocks] = useState<StockItem[]>([]);
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [summary, setSummary] = useState({
    totalLots: 0,
    totalQuantity: 0,
    totalAvailable: 0,
    totalUsed: 0,
    materialCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 자재 마스터 (Context)
  const { materials } = useMaterial();

  // 데이터 로드
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stocks, history, stats] = await Promise.all([
        getAllStocks({ showZero: showExhausted }),
        getAllReceivings({ limit: 100 }),
        getStockSummary(),
      ]);
      setLotStocks(stocks);
      setReceivings(history);
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

  // 자재 마스터 기준 상태 계산
  const getStatus = (stock: number, safeStock: number) => {
    if (stock === 0) return 'exhausted';
    if (stock < safeStock * 0.3) return 'danger';
    if (stock < safeStock) return 'warning';
    return 'good';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good': return '정상';
      case 'warning': return '경고';
      case 'danger': return '위험';
      case 'exhausted': return '소진';
      default: return status;
    }
  };

  // 탭1: 자재별 요약 다운로드
  const handleDownloadSummary = () => {
    const exportData = materials.map(item => ({
      '상태': getStatusText(getStatus(item.stock, item.safeStock)),
      '품번': item.code,
      '품명': item.name,
      '분류': item.category,
      '현재고': item.stock,
      '안전재고': item.safeStock,
      '단위': item.unit
    }));
    downloadExcel(exportData, '재고현황_자재별', '자재별재고');
    toast.success('재고 현황이 다운로드되었습니다.');
  };

  // 탭2: LOT별 재고 다운로드
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

  // 필터링된 자재 마스터 데이터
  const filteredMaterials = materials
    .map(item => ({
      ...item,
      status: getStatus(item.stock, item.safeStock)
    }))
    .filter(item => {
      if (!showExhausted && item.stock === 0) return false;
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query)
      );
    });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">자재 재고 현황</h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
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
            <div className="text-2xl font-bold text-green-600">{summary.totalAvailable.toLocaleString()}</div>
            <div className="text-sm text-slate-500">가용 재고</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{summary.totalUsed.toLocaleString()}</div>
            <div className="text-sm text-slate-500">사용 수량</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-600">{summary.materialCount}</div>
            <div className="text-sm text-slate-500">자재 종류</div>
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
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            자재별 요약
          </TabsTrigger>
          <TabsTrigger value="lot" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            LOT별 재고
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            입고 이력
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: 자재별 요약 */}
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">자재별 재고 요약 ({filteredMaterials.length}건)</CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
                <Download className="mr-2 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-6 py-3">상태</th>
                      <th className="px-6 py-3">품번</th>
                      <th className="px-6 py-3">품명</th>
                      <th className="px-6 py-3">분류</th>
                      <th className="px-6 py-3 text-right">현재고</th>
                      <th className="px-6 py-3 text-right">안전재고</th>
                      <th className="px-6 py-3 text-center">단위</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                          등록된 자재가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3">
                            {item.status === 'danger' && <Badge variant="destructive">위험</Badge>}
                            {item.status === 'warning' && <Badge className="bg-orange-500 hover:bg-orange-600">경고</Badge>}
                            {item.status === 'good' && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">정상</Badge>}
                            {item.status === 'exhausted' && <Badge variant="secondary">소진</Badge>}
                          </td>
                          <td className="px-6 py-3 font-mono font-medium">{item.code}</td>
                          <td className="px-6 py-3">{item.name}</td>
                          <td className="px-6 py-3 text-slate-500">{item.category}</td>
                          <td className={`px-6 py-3 text-right font-bold ${
                            item.status === 'danger' || item.status === 'exhausted' ? 'text-red-600' : ''
                          }`}>
                            {item.stock.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-500">{item.safeStock.toLocaleString()}</td>
                          <td className="px-6 py-3 text-center text-slate-500">{item.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 탭 2: LOT별 재고 */}
        <TabsContent value="lot" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">LOT별 상세 재고 ({filteredLotStocks.length}건)</CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadLotStock}>
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
                      <th className="px-4 py-3 text-right">가용수량</th>
                      <th className="px-4 py-3">입고일자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLotStocks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          입고된 재고가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredLotStocks.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
              <Button variant="outline" size="sm" onClick={handleDownloadReceivings}>
                <Download className="mr-2 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
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
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          입고 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivings.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
      </Tabs>
    </div>
  );
};
