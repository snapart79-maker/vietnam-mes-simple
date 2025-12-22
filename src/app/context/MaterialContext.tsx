import React, { createContext, useContext, useState, useEffect, ReactNode, PropsWithChildren, useMemo } from 'react';

// 자재 데이터 타입 정의 (MasterData와 MaterialStock의 필드 통합)
export interface Material {
  id: number;
  code: string;       // MES 내부 품번 (예: 250-1235)
  name: string;       // 자재명
  hqCode?: string;    // 본사 코드 (예: 682028) - 바코드 스캔용
  spec: string;       // 규격
  category: string;   // 분류 (자재 유형)
  unit: string;       // 단위
  stock: number;      // 현재고
  safeStock: number;  // 안전 재고
  desc: string;       // 설명/비고
  regDate: string;    // 등록일
  status?: 'good' | 'warning' | 'danger' | 'exhausted'; // UI용 상태 (계산됨)
}

// 전선 색상코드 매핑 타입 (경신전선, 케이알로지스 등)
export interface WireColorMapping {
  colorCode: string;  // 바코드에서 추출한 색상코드 (예: C1A1BKR)
  mesCode: string;    // MES 품번 (예: 210-4917)
  hqCode: string;     // 본사 품명 코드
  name: string;       // 품명
  supplier: string;   // 공급사
}

interface MaterialContextType {
  materials: Material[];
  addMaterial: (material: Omit<Material, 'id' | 'stock' | 'regDate'>) => void;
  addMaterials: (materials: Omit<Material, 'id' | 'stock' | 'regDate'>[]) => number; // 일괄 등록
  updateMaterial: (material: Material) => void;
  deleteMaterial: (id: number) => void;
  resetMaterials: () => number; // 초기화 함수 추가
  getMaterialByCode: (code: string) => Material | undefined; // 품번으로 조회
  getMaterialByHQCode: (hqCode: string) => Material | undefined; // 본사 코드로 조회
  // 전선 색상코드 매핑 관련
  wireColorMappings: WireColorMapping[];
  loadWireColorMappings: (mappings: WireColorMapping[]) => number;
  getWireMappingCount: () => number;
}

const MaterialContext = createContext<MaterialContextType | undefined>(undefined);

// localStorage 키
const STORAGE_KEY = 'vietnam_mes_materials';
const WIRE_MAPPING_KEY = 'vietnam_mes_wire_color_mappings';

// localStorage에서 데이터 로드
function loadFromStorage(): Material[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('MaterialContext: localStorage 로드 실패', e);
  }
  return [];
}

// localStorage에서 전선 색상코드 매핑 로드
function loadWireMappingsFromStorage(): WireColorMapping[] {
  try {
    const stored = localStorage.getItem(WIRE_MAPPING_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('MaterialContext: wire mapping 로드 실패', e);
  }
  return [];
}

// localStorage에 데이터 저장
function saveToStorage(materials: Material[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    console.error('MaterialContext: localStorage 저장 실패', e);
  }
}

// localStorage에 전선 색상코드 매핑 저장
function saveWireMappingsToStorage(mappings: WireColorMapping[]) {
  try {
    localStorage.setItem(WIRE_MAPPING_KEY, JSON.stringify(mappings));
  } catch (e) {
    console.error('MaterialContext: wire mapping 저장 실패', e);
  }
}

export const MaterialProvider = ({ children }: PropsWithChildren) => {
  // 초기 로드 시 localStorage에서 데이터 복원
  const [materials, setMaterials] = useState<Material[]>(() => loadFromStorage());
  const [wireColorMappings, setWireColorMappings] = useState<WireColorMapping[]>(() => loadWireMappingsFromStorage());

  // materials 변경 시 localStorage에 저장
  useEffect(() => {
    saveToStorage(materials);
  }, [materials]);

  // wireColorMappings 변경 시 localStorage에 저장
  useEffect(() => {
    saveWireMappingsToStorage(wireColorMappings);
  }, [wireColorMappings]);

  // 전선 색상코드 → MES 품번 매핑 (빠른 조회용 Map)
  const wireCodeToMesCode = useMemo(() => {
    const map = new Map<string, string>();
    wireColorMappings.forEach(m => {
      map.set(m.colorCode, m.mesCode);
    });
    return map;
  }, [wireColorMappings]);

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

  // 일괄 등록 함수 (React state batching 문제 해결)
  const addMaterials = (newMats: Omit<Material, 'id' | 'stock' | 'regDate'>[]): number => {
    const today = new Date().toISOString().split('T')[0];

    setMaterials(prev => {
      const startId = Math.max(...prev.map(m => m.id), 0) + 1;
      const materialsToAdd: Material[] = newMats.map((mat, index) => ({
        ...mat,
        id: startId + index,
        stock: 0,
        regDate: today,
      }));
      return [...prev, ...materialsToAdd];
    });

    return newMats.length;
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

  // 전선 색상코드 매핑 로드 (JSON 파일에서)
  const loadWireColorMappings = (mappings: WireColorMapping[]): number => {
    setWireColorMappings(mappings);
    return mappings.length;
  };

  // 전선 색상코드 매핑 개수 조회
  const getWireMappingCount = (): number => {
    return wireColorMappings.length;
  };

  // 품번(code)으로 자재 조회
  const getMaterialByCode = (code: string): Material | undefined => {
    return materials.find(m => m.code === code);
  };

  // 바코드에서 추출한 코드로 자재 조회 (다단계 검색)
  // 공급사별 패턴:
  // - 한국단자공업 등: 바코드에 품명(hqCode) 포함
  // - 금호에이치티 등: 바코드에 품번(code) 포함
  // - 한국단자공업 일부: 대시/접두사 차이 (660480K7 vs 660480-K7)
  // - 사마스전자: 품명에 바코드 코드 포함
  // - 경신전선/케이알로지스: 전선 색상코드 → MES 품번 매핑
  const getMaterialByHQCode = (extractedCode: string): Material | undefined => {
    // 정규화 함수: 대시, 공백 제거하고 소문자로
    const normalize = (s: string) => s.replace(/[-\s]/g, '').toLowerCase();
    const normalizedCode = normalize(extractedCode);

    // 1. hqCode 필드로 정확히 일치
    const byHQCode = materials.find(m => m.hqCode === extractedCode);
    if (byHQCode) return byHQCode;

    // 2. code 필드로 정확히 일치 (품번이 바코드에 있는 패턴)
    const byCode = materials.find(m => m.code === extractedCode);
    if (byCode) return byCode;

    // 3. name 필드로 정확히 일치 (하위 호환성)
    const byName = materials.find(m => m.name === extractedCode);
    if (byName) return byName;

    // 4. 전선 색상코드 매핑 조회 (경신전선, 케이알로지스 등)
    const mappedMesCode = wireCodeToMesCode.get(extractedCode);
    if (mappedMesCode) {
      const byMappedCode = materials.find(m => m.code === mappedMesCode);
      if (byMappedCode) return byMappedCode;
    }

    // 5. 정규화 비교 (대시 차이: 660480K7 vs 660480-K7)
    const byNormalizedHQ = materials.find(m => m.hqCode && normalize(m.hqCode) === normalizedCode);
    if (byNormalizedHQ) return byNormalizedHQ;

    // 6. hqCode 부분 일치 (접미사: 655708-3 vs 655708-3(PA6+G15)KET)
    const byPartialHQ = materials.find(m => m.hqCode && m.hqCode.startsWith(extractedCode));
    if (byPartialHQ) return byPartialHQ;

    // 7. hqCode 접두사 제거 일치 (MG646390-5 → 646390-5)
    const byHQSuffix = materials.find(m => m.hqCode && m.hqCode.endsWith(extractedCode));
    if (byHQSuffix) return byHQSuffix;

    // 8. 품명에서 바코드 코드 포함 검색 (사마스전자: 품명에 "(31100-LX100)" 포함)
    const byNameContains = materials.find(m => m.name && m.name.includes(extractedCode));
    if (byNameContains) return byNameContains;

    // 9. 정규화된 hqCode 부분 일치
    const byNormalizedPartial = materials.find(m =>
      m.hqCode && normalize(m.hqCode).includes(normalizedCode)
    );
    if (byNormalizedPartial) return byNormalizedPartial;

    return undefined;
  };

  return (
    <MaterialContext.Provider value={{
      materials,
      addMaterial,
      addMaterials,
      updateMaterial,
      deleteMaterial,
      resetMaterials,
      getMaterialByCode,
      getMaterialByHQCode,
      wireColorMappings,
      loadWireColorMappings,
      getWireMappingCount,
    }}>
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
