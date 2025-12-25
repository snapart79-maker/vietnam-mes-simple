/**
 * App.tsx - 메인 애플리케이션 컴포넌트
 *
 * Provider 계층:
 * - AuthProvider: 인증 상태 관리
 * - I18nProvider: 다국어 지원
 * - MaterialProvider: 자재 데이터 관리
 * - ProductProvider: 완제품 데이터 관리
 * - BOMProvider: BOM 데이터 관리
 * - ProductionProvider: 생산 데이터 관리
 */
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { MaterialProvider } from './context/MaterialContext';
import { ProductProvider } from './context/ProductContext';
import { BOMProvider } from './context/BOMContext';
import { ProductionProvider } from './context/ProductionContext';
import { StockProvider } from './context/StockContext';
import { PurchaseOrderProvider } from './context/PurchaseOrderContext';

// Layout
import { MainLayout } from './layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MaterialReceiving from './pages/MaterialReceiving';
import MaterialStock from './pages/MaterialStock';
import ProcessView from './pages/ProcessView';
import InspectionView from './pages/InspectionView';
import ReportView from './pages/ReportView';
import MasterData from './pages/MasterData';
import Settings from './pages/Settings';
import PurchaseOrder from './pages/PurchaseOrder';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nProvider>
          <MaterialProvider>
            <ProductProvider>
              <BOMProvider>
                <StockProvider>
                  <ProductionProvider>
                    <PurchaseOrderProvider>
                      <HashRouter>
                      <Routes>
                        {/* 로그인 페이지 */}
                        <Route path="/login" element={<Login />} />

                        {/* 메인 레이아웃 */}
                        <Route path="/" element={<MainLayout />}>
                          <Route index element={<Dashboard />} />
                          <Route path="dashboard" element={<Dashboard />} />

                          {/* 발주서 관리 */}
                          <Route path="purchase-order" element={<PurchaseOrder />} />

                          {/* 자재 관리 */}
                          <Route path="material/receiving" element={<MaterialReceiving />} />
                          <Route path="material/stock" element={<MaterialStock />} />

                          {/* 공정 모니터링 */}
                          <Route path="process/:processId" element={<ProcessView />} />

                          {/* 품질 검사 */}
                          <Route path="inspection/:type" element={<InspectionView />} />

                          {/* 리포트 */}
                          <Route path="report/:reportId" element={<ReportView />} />

                          {/* 기초 자료 */}
                          <Route path="master/:type" element={<MasterData />} />

                          {/* 설정 */}
                          <Route path="settings" element={<Settings />} />

                          {/* 404 */}
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                      </Routes>
                      </HashRouter>
                      <Toaster position="top-right" richColors />
                    </PurchaseOrderProvider>
                  </ProductionProvider>
                </StockProvider>
              </BOMProvider>
            </ProductProvider>
          </MaterialProvider>
        </I18nProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;