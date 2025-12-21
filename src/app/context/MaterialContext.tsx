import React, { createContext, useContext, useState, ReactNode, PropsWithChildren } from 'react';

// 자재 데이터 타입 정의 (MasterData와 MaterialStock의 필드 통합)
export interface Material {
  id: number;
  code: string;
  name: string;
  spec: string;       // 규격
  category: string;   // 분류 (자재 유형)
  unit: string;       // 단위
  stock: number;      // 현재고
  safeStock: number;  // 안전 재고
  desc: string;       // 설명/비고
  regDate: string;    // 등록일
  status?: 'good' | 'warning' | 'danger' | 'exhausted'; // UI용 상태 (계산됨)
}

interface MaterialContextType {
  materials: Material[];
  addMaterial: (material: Omit<Material, 'id' | 'stock' | 'regDate'>) => void;
  updateMaterial: (material: Material) => void;
  deleteMaterial: (id: number) => void;
  resetMaterials: () => number; // 초기화 함수 추가
}

const MaterialContext = createContext<MaterialContextType | undefined>(undefined);

// 초기 데이터 없음 (공장초기화 상태)
const INITIAL_MATERIALS: Material[] = [];

export const MaterialProvider = ({ children }: PropsWithChildren) => {
  const [materials, setMaterials] = useState<Material[]>(INITIAL_MATERIALS);

  const addMaterial = (newMat: Omit<Material, 'id' | 'stock' | 'regDate'>) => {
    const id = Math.max(...materials.map(m => m.id), 0) + 1;
    const material: Material = {
      ...newMat,
      id,
      stock: 0, // 신규 자재는 재고 0으로 시작
      regDate: new Date().toISOString().split('T')[0],
    };
    setMaterials([...materials, material]);
  };

  const updateMaterial = (updatedMat: Material) => {
    setMaterials(materials.map(m => m.id === updatedMat.id ? updatedMat : m));
  };

  const deleteMaterial = (id: number) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const resetMaterials = () => {
    const count = materials.length;
    setMaterials([]);
    return count;
  };

  return (
    <MaterialContext.Provider value={{ materials, addMaterial, updateMaterial, deleteMaterial, resetMaterials }}>
      {children}
    </MaterialContext.Provider>
  );
};

export const useMaterial = () => {
  const context = useContext(MaterialContext);
  if (!context) {
    throw new Error('useMaterial must be used within a MaterialProvider');
  }
  return context;
};
