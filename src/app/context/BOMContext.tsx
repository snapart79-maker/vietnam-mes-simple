import React, { createContext, useContext, useState, useMemo, useEffect, PropsWithChildren } from 'react';

// Electron API 헬퍼 함수
import { hasBusinessAPI, getAPI } from '../../lib/electronBridge';

// ============================================================
// BOM Level 결정 함수
// 공정코드에 따라 BOM Level을 자동 산출
// ============================================================
export function determineLevel(processCode: string): number {
  switch (processCode?.toUpperCase()) {
    case 'PA': return 1;  // 제품조립
    case 'MC': return 2;  // 수동압착
    case 'SB':            // 서브조립
    case 'MS': return 3;  // 중간탈피
    case 'CA': return 4;  // 자동절단압착
    default: return 1;    // 기본값: LV1 (PA)
  }
}

// 공정 코드에 대한 공정명 반환
export function getProcessName(processCode: string): string {
  switch (processCode?.toUpperCase()) {
    case 'PA': return '제품조립';
    case 'MC': return '수동압착';
    case 'SB': return '서브조립';
    case 'MS': return '중간탈피';
    case 'CA': return '자동절단압착';
    default: return processCode || '기타';
  }
}

// ============================================================
// 타입 정의
// ============================================================

// BOM 아이템 타입 정의
export interface BOMItem {
  id: number;
  productCode: string;     // 완제품/반제품 품번
  productName?: string;    // 완제품/반제품 품명
  materialCode: string;    // 자재 품번
  materialName: string;    // 자재 품명
  quantity: number;        // 소요량
  unit: string;            // 단위

  // BOM Level 관련 필드
  processCode: string;     // 공정 코드 (PA/MC/SB/MS/CA)
  crimpCode?: string;      // 절압착 품번 (CA 자재용, 예: 00315452-001)
  level: number;           // BOM Level (1-4, processCode에서 자동 산출)

  description?: string;    // 설명
  regDate: string;         // 등록일
}

// 절압착 품번별 그룹 (LV4 CA 자재용)
export interface CrimpGroup {
  crimpCode: string;       // 절압착 품번 (00315452-001)
  items: BOMItem[];
}

// Level별 그룹
export interface LevelGroup {
  level: number;           // 1-4
  processCode: string;     // PA, MC, SB, MS, CA
  processName: string;     // 제품조립, 수동압착 등
  items: BOMItem[];
  crimpGroups?: CrimpGroup[];  // LV4 CA인 경우만
}

// 품번별 그룹핑된 BOM 구조 (계층형)
export interface BOMGroup {
  productCode: string;
  productName?: string;
  levelGroups: LevelGroup[];
  totalItems: number;      // 전체 자재 수
}

// ============================================================
// Context 정의
// ============================================================

interface BOMContextType {
  bomItems: BOMItem[];
  bomGroups: BOMGroup[];  // 품번별로 계층 그룹핑된 데이터
  addBOMItem: (item: Omit<BOMItem, 'id' | 'regDate' | 'level'> & { level?: number }) => Promise<void>; // (하이브리드)
  addBOMItems: (items: (Omit<BOMItem, 'id' | 'regDate' | 'level'> & { level?: number })[]) => Promise<number>; // (하이브리드)
  updateBOMItem: (item: BOMItem) => Promise<void>; // (하이브리드)
  deleteBOMItem: (id: number) => Promise<void>; // (하이브리드)
  deleteBOMByProduct: (productCode: string) => Promise<number>; // (하이브리드)
  getBOMByProduct: (productCode: string) => BOMItem[];  // 로컬 상태 조회
  getBOMByLevel: (productCode: string, level: number) => BOMItem[];  // 로컬 상태 조회
  resetBOM: () => Promise<number>; // (하이브리드)
  refreshBOM: () => Promise<void>; // (하이브리드) DB에서 BOM 목록 새로고침
}

const BOMContext = createContext<BOMContextType | undefined>(undefined);

// localStorage 키
const STORAGE_KEY = 'vietnam_mes_bom';

// localStorage에서 데이터 로드
function loadFromStorage(): BOMItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('BOMContext: localStorage 로드 실패', e);
  }
  return [];
}

// localStorage에 데이터 저장
function saveToStorage(bomItems: BOMItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bomItems));
  } catch (e) {
    console.error('BOMContext: localStorage 저장 실패', e);
  }
}

// ============================================================
// Provider 구현
// ============================================================

export const BOMProvider = ({ children }: PropsWithChildren) => {
  // 초기 로드 시 localStorage에서 데이터 복원
  const [bomItems, setBomItems] = useState<BOMItem[]>(() => loadFromStorage());

  // bomItems 변경 시 localStorage에 저장
  useEffect(() => {
    saveToStorage(bomItems);
  }, [bomItems]);

  // 품번별, Level별, (CA인 경우) crimpCode별 계층 그룹핑
  const bomGroups = useMemo<BOMGroup[]>(() => {
    // Step 1: 품번별로 그룹핑
    const productMap = new Map<string, {
      productCode: string;
      productName?: string;
      items: BOMItem[];
    }>();

    bomItems.forEach(item => {
      if (!productMap.has(item.productCode)) {
        productMap.set(item.productCode, {
          productCode: item.productCode,
          productName: item.productName,
          items: []
        });
      }
      productMap.get(item.productCode)!.items.push(item);
    });

    // Step 2: 각 품번에 대해 Level별 그룹핑
    const result: BOMGroup[] = [];

    productMap.forEach((productGroup) => {
      // Level별로 분류
      const levelMap = new Map<number, BOMItem[]>();

      productGroup.items.forEach(item => {
        const level = item.level;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(item);
      });

      // LevelGroup 배열 생성 (level 순 정렬)
      const levelGroups: LevelGroup[] = [];

      // Level 1~4 순서대로 처리
      [1, 2, 3, 4].forEach(level => {
        const items = levelMap.get(level);
        if (items && items.length > 0) {
          // 해당 레벨의 공정 코드 결정 (첫 번째 아이템 기준)
          const processCode = items[0].processCode?.toUpperCase() || '';

          const levelGroup: LevelGroup = {
            level,
            processCode,
            processName: getProcessName(processCode),
            items
          };

          // LV4 (CA)인 경우 crimpCode별로 추가 그룹핑
          if (level === 4) {
            const crimpMap = new Map<string, BOMItem[]>();

            items.forEach(item => {
              const code = item.crimpCode || '(미지정)';
              if (!crimpMap.has(code)) {
                crimpMap.set(code, []);
              }
              crimpMap.get(code)!.push(item);
            });

            levelGroup.crimpGroups = Array.from(crimpMap.entries())
              .map(([crimpCode, crimpItems]) => ({
                crimpCode,
                items: crimpItems
              }))
              .sort((a, b) => a.crimpCode.localeCompare(b.crimpCode));
          }

          levelGroups.push(levelGroup);
        }
      });

      result.push({
        productCode: productGroup.productCode,
        productName: productGroup.productName,
        levelGroups,
        totalItems: productGroup.items.length
      });
    });

    return result.sort((a, b) => a.productCode.localeCompare(b.productCode));
  }, [bomItems]);

  // 단일 BOM 아이템 추가 (하이브리드)
  const addBOMItem = async (newItem: Omit<BOMItem, 'id' | 'regDate' | 'level'> & { level?: number }): Promise<void> => {
    const level = newItem.level ?? determineLevel(newItem.processCode);

    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 실제 DB 서비스 호출
      const api = getAPI();
      // productCode에서 productId를 추출하거나 변환 필요 (실제 구현에 따라 조정)
      const result = await api!.bom.createBOMItem({
        productId: parseInt(newItem.productCode) || 0,  // 실제 매핑 필요
        materialId: parseInt(newItem.materialCode) || 0, // 실제 매핑 필요
        quantity: newItem.quantity,
        processCode: newItem.processCode,
        unit: newItem.unit,
      });
      if (!result.success) {
        throw new Error(result.error || 'BOM 아이템 등록 실패');
      }
      // DB에서 생성된 데이터로 로컬 상태 업데이트
      const dbItem = result.data as { id: number };
      const item: BOMItem = {
        ...newItem,
        id: dbItem.id,
        level,
        regDate: new Date().toISOString().split('T')[0],
      };
      setBomItems(prev => [...prev, item]);
    } else {
      // 브라우저 환경: Mock 서비스 사용 (localStorage)
      const id = Math.max(...bomItems.map(b => b.id), 0) + 1;
      const item: BOMItem = {
        ...newItem,
        id,
        level,
        regDate: new Date().toISOString().split('T')[0],
      };
      setBomItems([...bomItems, item]);
    }
  };

  // 일괄 등록 함수 (하이브리드)
  const addBOMItems = async (newItems: (Omit<BOMItem, 'id' | 'regDate' | 'level'> & { level?: number })[]): Promise<number> => {
    const today = new Date().toISOString().split('T')[0];

    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 실제 DB 서비스 호출 (개별 등록)
      const api = getAPI();
      const addedItems: BOMItem[] = [];

      for (const newItem of newItems) {
        const level = newItem.level ?? determineLevel(newItem.processCode);
        const result = await api!.bom.createBOMItem({
          productId: parseInt(newItem.productCode) || 0,
          materialId: parseInt(newItem.materialCode) || 0,
          quantity: newItem.quantity,
          processCode: newItem.processCode,
          unit: newItem.unit,
        });
        if (result.success && result.data) {
          const dbItem = result.data as { id: number };
          addedItems.push({
            ...newItem,
            id: dbItem.id,
            level,
            regDate: today,
          });
        }
      }

      // 로컬 상태 일괄 업데이트
      setBomItems(prev => [...prev, ...addedItems]);
      return addedItems.length;
    } else {
      // 브라우저 환경: Mock 서비스 사용 (localStorage)
      setBomItems(prev => {
        const startId = Math.max(...prev.map(b => b.id), 0) + 1;
        const itemsToAdd: BOMItem[] = newItems.map((item, index) => ({
          ...item,
          id: startId + index,
          level: item.level ?? determineLevel(item.processCode),
          regDate: today,
        }));
        return [...prev, ...itemsToAdd];
      });

      return newItems.length;
    }
  };

  // BOM 아이템 수정 (하이브리드)
  const updateBOMItem = async (updatedItem: BOMItem): Promise<void> => {
    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 실제 DB 서비스 호출
      const api = getAPI();
      const result = await api!.bom.updateBOMItem(updatedItem.id, {
        quantity: updatedItem.quantity,
        processCode: updatedItem.processCode,
        unit: updatedItem.unit,
      });
      if (!result.success) {
        throw new Error(result.error || 'BOM 아이템 수정 실패');
      }
    }
    // 로컬 상태 업데이트 (Electron, 브라우저 공통)
    setBomItems(prev => prev.map(b => b.id === updatedItem.id ? updatedItem : b));
  };

  // BOM 아이템 삭제 (하이브리드)
  const deleteBOMItem = async (id: number): Promise<void> => {
    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 실제 DB 서비스 호출
      const api = getAPI();
      const result = await api!.bom.deleteBOMItem(id);
      if (!result.success) {
        throw new Error(result.error || 'BOM 아이템 삭제 실패');
      }
    }
    // 로컬 상태 업데이트 (Electron, 브라우저 공통)
    setBomItems(prev => prev.filter(b => b.id !== id));
  };

  // 특정 품번의 BOM 전체 삭제 (하이브리드)
  const deleteBOMByProduct = async (productCode: string): Promise<number> => {
    const toDelete = bomItems.filter(b => b.productCode === productCode);
    const deletedCount = toDelete.length;

    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 모든 아이템 삭제
      const api = getAPI();
      for (const item of toDelete) {
        await api!.bom.deleteBOMItem(item.id);
      }
    }

    // 로컬 상태 업데이트 (Electron, 브라우저 공통)
    setBomItems(prev => prev.filter(b => b.productCode !== productCode));
    return deletedCount;
  };

  // 특정 품번의 BOM 조회 (로컬 상태)
  const getBOMByProduct = (productCode: string): BOMItem[] => {
    return bomItems.filter(b => b.productCode === productCode);
  };

  // 특정 품번, 특정 Level의 BOM 조회 (로컬 상태)
  const getBOMByLevel = (productCode: string, level: number): BOMItem[] => {
    return bomItems.filter(b => b.productCode === productCode && b.level === level);
  };

  // BOM 초기화 (하이브리드)
  const resetBOM = async (): Promise<number> => {
    const count = bomItems.length;

    if (hasBusinessAPI()) {
      // Electron 환경: IPC를 통해 모든 BOM 삭제
      const api = getAPI();
      for (const item of bomItems) {
        await api!.bom.deleteBOMItem(item.id);
      }
    }

    // 로컬 상태 초기화 (Electron, 브라우저 공통)
    setBomItems([]);
    return count;
  };

  // DB에서 BOM 목록 새로고침 (하이브리드)
  const refreshBOM = async (): Promise<void> => {
    if (hasBusinessAPI()) {
      // Electron 환경: 모든 제품의 BOM 로드 (실제 구현 시 getAll 메서드 필요)
      // 현재 BOMAPI에 getAll이 없으므로, 각 제품별로 조회 필요
      // 일단 로컬 상태 유지
      console.log('[BOMContext] refreshBOM called - Electron mode');
    }
    // 브라우저 환경: localStorage에서 이미 로드되어 있으므로 무시
  };

  return (
    <BOMContext.Provider value={{
      bomItems,
      bomGroups,
      addBOMItem,
      addBOMItems,
      updateBOMItem,
      deleteBOMItem,
      deleteBOMByProduct,
      getBOMByProduct,
      getBOMByLevel,
      resetBOM,
      refreshBOM,
    }}>
      {children}
    </BOMContext.Provider>
  );
};

export const useBOM = () => {
  const context = useContext(BOMContext);
  if (!context) {
    throw new Error('useBOM must be used within a BOMProvider');
  }
  return context;
};
