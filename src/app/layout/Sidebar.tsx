import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  ClipboardCheck,
  FileBarChart,
  Database,
  ChevronDown,
  ChevronRight,
  Package,
  ScanLine,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Archive,
  ClipboardList
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
  isMobile?: boolean;
  onLinkClick?: () => void;
}

interface NavItemProps {
  to: string;
  label: string;
  icon?: any;
  indent?: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  onLinkClick?: () => void;
}

const NavItem = ({ to, label, icon: Icon, indent = false, isCollapsed, isMobile, onLinkClick }: NavItemProps) => {
  if (isCollapsed && indent && !isMobile) return null;

  return (
    <NavLink
      to={to}
      onClick={onLinkClick}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors overflow-hidden",
          indent ? "ml-4 text-slate-400" : "text-slate-300",
          isActive 
            ? "bg-blue-600 text-white shadow-md" 
            : "hover:bg-slate-800 hover:text-white",
          (isCollapsed && !isMobile) && "justify-center px-2"
        )
      }
      title={(isCollapsed && !isMobile) ? label : undefined}
    >
      {Icon && <Icon size={18} className="shrink-0" />}
      {(!Icon && (!isCollapsed || isMobile)) && <span className="w-[18px] shrink-0" />} 
      {(!isCollapsed || isMobile) && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
    </NavLink>
  );
};

interface GroupHeaderProps {
  label: string;
  icon: any;
  id: string;
  isCollapsed: boolean;
  isMobile: boolean;
  expandedMenus: Record<string, boolean>;
  onToggle: (id: string) => void;
}

const GroupHeader = ({ label, icon: Icon, id, isCollapsed, isMobile, expandedMenus, onToggle }: GroupHeaderProps) => (
  <button
    onClick={() => onToggle(id)}
    className={clsx(
      "flex w-full items-center px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors mt-2 overflow-hidden",
      (isCollapsed && !isMobile) ? "justify-center" : "justify-between"
    )}
    title={(isCollapsed && !isMobile) ? label : undefined}
  >
    <div className="flex items-center gap-3 overflow-hidden">
      <Icon size={18} className="shrink-0" />
      {(!isCollapsed || isMobile) && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
    </div>
    {(!isCollapsed || isMobile) && (expandedMenus[id] ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />)}
  </button>
);

export const Sidebar = ({ isCollapsed = false, toggleSidebar, isMobile = false, onLinkClick }: SidebarProps) => {
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    material: true,
    production: true,
    quality: true,
    report: false,
    master: false
  });

  const toggleMenu = (key: string) => {
    if (isCollapsed && toggleSidebar && !isMobile) {
      toggleSidebar();
      setExpandedMenus(prev => ({ ...prev, [key]: true }));
      return;
    }
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navProps = { isCollapsed, isMobile, onLinkClick };
  const groupProps = { isCollapsed, isMobile, expandedMenus, onToggle: toggleMenu };

  return (
    <aside 
      className={clsx(
        "bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out",
        isMobile ? "w-full" : (isCollapsed ? "w-20" : "w-64"),
        !isMobile && "h-screen border-r border-slate-800"
      )}
    >
      <div className={clsx("p-6 flex items-center border-b border-slate-800 transition-all duration-300", (isCollapsed && !isMobile) ? "justify-center px-0" : "gap-3 justify-between")}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shrink-0">B</div>
          {(!isCollapsed || isMobile) && <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap overflow-hidden">Barcord</span>}
        </div>
        {(!isCollapsed && toggleSidebar && !isMobile) && (
          <button onClick={toggleSidebar} className="text-slate-500 hover:text-white transition-colors shrink-0">
            <ChevronsLeft size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 overflow-x-hidden">
        <NavItem to="/dashboard" label="대시보드" icon={LayoutDashboard} {...navProps} />
        <NavItem to="/purchase-order" label="발주서 관리" icon={ClipboardList} {...navProps} />

        <GroupHeader label="자재 관리" icon={Package} id="material" {...groupProps} />
        {((!isCollapsed || isMobile) && expandedMenus.material) && (
          <div className="space-y-1 mt-1">
            <NavItem to="/material/receiving" label="자재 불출" indent {...navProps} />
            <NavItem to="/material/stock" label="자재 현황" indent {...navProps} />
          </div>
        )}

        <GroupHeader label="생산 공정" icon={Factory} id="production" {...groupProps} />
        {((!isCollapsed || isMobile) && expandedMenus.production) && (
          <div className="space-y-1 mt-1">
            <NavItem to="/process/ca" label="CA - 자동절단압착" indent {...navProps} />
            <NavItem to="/process/mc" label="MC - 수동압착" indent {...navProps} />
            <NavItem to="/process/ms" label="MS - 중간스트립" indent {...navProps} />
            <NavItem to="/process/sb" label="SB - Sub" indent {...navProps} />
            <NavItem to="/process/hs" label="HS - 열수축" indent {...navProps} />
            <NavItem to="/process/sp" label="SP - 제품조립제공부품" indent {...navProps} />
            <NavItem to="/process/pa" label="PA - 제품조립" indent {...navProps} />
          </div>
        )}

        <GroupHeader label="품질 검사" icon={ClipboardCheck} id="quality" {...groupProps} />
        {((!isCollapsed || isMobile) && expandedMenus.quality) && (
          <div className="space-y-1 mt-1">
            <NavItem to="/inspection/crimp" label="압착검사" indent {...navProps} />
            <NavItem to="/inspection/circuit" label="회로검사 (CI)" indent {...navProps} />
            <NavItem to="/inspection/visual" label="육안검사 (VI)" indent {...navProps} />
          </div>
        )}

        <GroupHeader label="조회 및 리포트" icon={FileBarChart} id="report" {...groupProps} />
        {((!isCollapsed || isMobile) && expandedMenus.report) && (
          <div className="space-y-1 mt-1">
            <NavItem to="/report/trace" label="LOT 추적" indent {...navProps} />
            <NavItem to="/report/production" label="생산 현황" indent {...navProps} />
            <NavItem to="/report/input-history" label="투입 이력" indent {...navProps} />
          </div>
        )}

        <GroupHeader label="기준 정보" icon={Database} id="master" {...groupProps} />
        {((!isCollapsed || isMobile) && expandedMenus.master) && (
          <div className="space-y-1 mt-1">
            <NavItem to="/master/product" label="완제품 관리" indent {...navProps} />
            <NavItem to="/master/material" label="자재 관리" indent {...navProps} />
            <NavItem to="/master/bom" label="BOM 관리" indent {...navProps} />
            <NavItem to="/master/user" label="사용자 관리" indent {...navProps} />
          </div>
        )}
      </nav>

      <div className={clsx("p-4 border-t border-slate-800", (isCollapsed && !isMobile) ? "flex justify-center" : "")}>
        {(isCollapsed && toggleSidebar && !isMobile) ? (
          <button onClick={toggleSidebar} className="text-slate-500 hover:text-white transition-colors">
            <ChevronsRight size={20} />
          </button>
        ) : (
          <NavLink to="/settings" onClick={onLinkClick} className="flex items-center gap-3 text-sm text-slate-500 hover:text-white transition-colors">
            <Settings size={16} className="shrink-0" />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">시스템 설정</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
};
