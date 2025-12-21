import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProcessView } from './pages/ProcessView';
import { InspectionView } from './pages/InspectionView';
import { MasterData } from './pages/MasterData';
import { ReportView } from './pages/ReportView';
import { MaterialReceiving } from './pages/MaterialReceiving';
import { MaterialStock } from './pages/MaterialStock';
import { Settings } from './pages/Settings';
import { MaterialProvider } from './context/MaterialContext';
import { AuthProvider } from './context/AuthContext';
import { ProductionProvider } from './context/ProductionContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <MaterialProvider>
        <ProductionProvider>
          <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes Wrapper */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Material Management */}
            <Route path="/material/receiving" element={<MaterialReceiving />} />
            <Route path="/material/stock" element={<MaterialStock />} />

            {/* Production Processes */}
            <Route path="/process/:processId" element={<ProcessView />} />
            
            {/* Quality Inspection */}
            <Route path="/inspection/:type" element={<InspectionView />} />
            
            {/* Reports & Inquiry */}
            <Route path="/report/:reportId" element={<ReportView />} />
            
            {/* Master Data */}
            <Route path="/master/:type" element={<MasterData />} />

            {/* System Settings */}
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
          </HashRouter>
          <Toaster position="top-right" richColors />
        </ProductionProvider>
      </MaterialProvider>
    </AuthProvider>
  );
}

export default App;
