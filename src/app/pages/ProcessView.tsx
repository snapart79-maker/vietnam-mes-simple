import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Printer, 
  ScanLine, 
  History,
  AlertCircle,
  Factory,
  ChevronDown
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from '../components/ui/dropdown-menu';

interface WorkHistory {
  id: number;
  lotNo: string;
  productName: string;
  qty: number;
  time: string;
  status: 'OK' | 'NG';
}

const availableLines = [
  { code: 'CA-L01', name: '자동절단압착 1라인', process: 'CA' },
  { code: 'CA-L02', name: '자동절단압착 2라인', process: 'CA' },
  { code: 'MC-L01', name: '수동압착 1라인', process: 'MC' },
  { code: 'MS-L01', name: '중간스트립 1라인', process: 'MS' },
  { code: 'SB-L01', name: 'Sub 조립 1라인', process: 'SB' },
  { code: 'PA-L01', name: '제품조립 1라인', process: 'PA' },
  { code: 'PA-L02', name: '제품조립 2라인', process: 'PA' },
  { code: 'HS-L01', name: '열수축 1라인', process: 'HS' },
];

export const ProcessView = () => {
  const { processId } = useParams<{ processId: string }>();
  const [isWorking, setIsWorking] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scannedLot, setScannedLot] = useState<{ lotNo: string; item: string; qty: number } | null>(null);
  const [currentLine, setCurrentLine] = useState<{ code: string, name: string } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Mock History Data
  const [history, setHistory] = useState<WorkHistory[]>([
    { id: 1, lotNo: 'L231201-001', productName: 'Wire Harness A', qty: 50, time: '10:30:00', status: 'OK' },
    { id: 2, lotNo: 'L231201-002', productName: 'Wire Harness A', qty: 50, time: '10:45:00', status: 'OK' },
    { id: 3, lotNo: 'L231201-003', productName: 'Wire Harness B', qty: 30, time: '11:00:00', status: 'NG' },
  ]);

  // Process Title Mapping
  const processNames: Record<string, string> = {
    ca: 'CA - 자동절단압착',
    mc: 'MC - 수동압착',
    ms: 'MS - 중간스트립',
    sb: 'SB - Sub',
    pa: 'PA - 제품조립',
    hs: 'HS - 열수축',
  };

  const processName = processNames[processId || ''] || '알 수 없는 공정';

  // Filter lines based on current process
  const processLines = useMemo(() => {
    if (!processId) return [];
    return availableLines.filter(line => line.process.toLowerCase() === processId.toLowerCase());
  }, [processId]);

  // Auto-select first line when process changes
  useEffect(() => {
    if (processLines.length > 0) {
      setCurrentLine(processLines[0]);
    } else {
      setCurrentLine(null);
    }
  }, [processLines]);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [processId]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode) return;
    
    // Simulate Scan Logic
    setScannedLot({
      lotNo: barcode,
      item: 'Wire Harness Type-C',
      qty: 100
    });
    setBarcode('');
  };

  const handleStart = () => setIsWorking(true);
  const handleStop = () => {
    setIsWorking(false);
    // Add to history
    if (scannedLot) {
      setHistory(prev => [{
        id: Date.now(),
        lotNo: scannedLot.lotNo,
        productName: scannedLot.item,
        qty: scannedLot.qty,
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        status: 'OK'
      }, ...prev]);
      setScannedLot(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{processName}</h2>
          
          {/* Line Selector Dropdown */}
          {processLines.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-sm h-9">
                  <Factory size={16} />
                  <span className="font-semibold">
                    {currentLine ? `${currentLine.name} (${currentLine.code})` : '라인 선택'}
                  </span>
                  <ChevronDown size={14} className="opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>작업 라인 선택</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {processLines.map((line) => (
                  <DropdownMenuItem 
                    key={line.code} 
                    onClick={() => setCurrentLine(line)}
                    className="cursor-pointer"
                  >
                    <span className="font-medium">{line.name}</span>
                    <span className="ml-auto text-xs text-slate-500">{line.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Badge variant={isWorking ? "default" : "secondary"} className={isWorking ? "bg-green-600" : "bg-slate-500"}>
          {isWorking ? '작업 중 (RUNNING)' : '대기 (IDLE)'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
        
        {/* Left Panel: Work Area */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Scan Section */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-blue-600" />
                바코드 스캔
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-slate-400 hover:text-blue-600"
                onClick={() => {
                  const dummyLot = `L${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                  setBarcode(dummyLot);
                  // Simulate scan immediately
                  setScannedLot({
                    lotNo: dummyLot,
                    item: 'Wire Harness Type-C (TEST)',
                    qty: 100
                  });
                }}
              >
                [개발용] 테스트 스캔
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <Input 
                  ref={barcodeInputRef}
                  placeholder="LOT 번호를 스캔하세요" 
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="h-12 text-lg font-mono border-2 focus:border-blue-500"
                  autoComplete="off"
                />
              </form>
            </CardContent>
          </Card>

          {/* Job Info Section */}
          <Card className="flex-1 shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">작업 정보</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-6 space-y-6">
              {!scannedLot ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                  <ScanLine size={48} className="mb-4 opacity-20" />
                  <p>스캔된 정보가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-slate-500">LOT 번호</Label>
                      <div className="font-mono text-lg font-bold text-slate-900 bg-slate-100 p-2 rounded">{scannedLot.lotNo}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-500">지시 수량</Label>
                      <div className="font-mono text-lg font-bold text-blue-600 bg-blue-50 p-2 rounded text-right">{scannedLot.qty} EA</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-500">품명</Label>
                    <div className="text-lg font-medium border-b border-slate-200 pb-1">{scannedLot.item}</div>
                  </div>
                  
                  <div className="pt-4">
                    <Label className="text-slate-500 mb-2 block">투입 자재 목록</Label>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                        <span>Wire Black 22AWG</span>
                        <Badge variant="outline" className="text-slate-500">OK</Badge>
                      </li>
                      <li className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                        <span>Terminal #22</span>
                        <Badge variant="outline" className="text-slate-500">OK</Badge>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Action Buttons */}
            <div className="p-4 border-t bg-slate-50 grid grid-cols-2 gap-3">
              {!isWorking ? (
                <Button 
                  size="lg" 
                  className="col-span-2 bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                  disabled={!scannedLot}
                  onClick={handleStart}
                >
                  <Play className="mr-2 fill-current" /> 작업 시작
                </Button>
              ) : (
                <>
                  <Button 
                    size="lg" 
                    variant="destructive" 
                    className="col-span-2 bg-red-600 hover:bg-red-700 h-14 text-lg"
                    onClick={handleStop}
                  >
                    <Square className="mr-2 fill-current" /> 작업 종료 및 실적 등록
                  </Button>
                </>
              )}
              <Button variant="outline" className="col-span-1" disabled={isWorking}>
                <Printer className="mr-2 h-4 w-4" /> 라벨 발행
              </Button>
              <Button variant="outline" className="col-span-1" disabled={isWorking}>
                <RotateCcw className="mr-2 h-4 w-4" /> 초기화
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Panel: History Grid */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <Card className="h-full shadow-md border-slate-200 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-500" />
                  금일 작업 이력
                </CardTitle>
                <CardDescription>현재 라인의 작업 내역입니다.</CardDescription>
              </div>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm">내 작업만 보기</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[100px]">시간</TableHead>
                    <TableHead>LOT 번호</TableHead>
                    <TableHead>품명</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                        작업 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-500">{row.time}</TableCell>
                        <TableCell className="font-mono">{row.lotNo}</TableCell>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell className="text-right font-bold">{row.qty}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.status === 'OK' ? 'default' : 'destructive'} className={row.status === 'OK' ? 'bg-green-500' : ''}>
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};
