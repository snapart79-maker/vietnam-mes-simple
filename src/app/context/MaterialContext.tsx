import React, { createContext, useContext, useState, useEffect, ReactNode, PropsWithChildren, useMemo } from 'react';

// 자재 데이터 타입 정의 (품목마스터 관리 양식 기반)
export interface Material {
  id: number;
  // === 핵심 식별 필드 ===
  code: string;           // 경림품번 (MES 내부 품번, 예: 250-351201)
  name: string;           // 품명 (예: PB625-03027) - 바코드 매칭용
  // === 바코드 매칭용 필드 ===
  supplierCode?: string;  // 원자재 공급사 품번 (바코드 매칭용)
  pdaCode?: string;       // PDA 확인 품번 (바코드 매칭용)
  hqCode?: string;        // 본사 코드 (레거시 호환)
  // === 공급처 정보 ===
  supplier?: string;      // 원자재-공급처 (예: 한국단자공업, 케이유엠두서)
  customerCode?: string;  // 출하 고객품번
  // === 규격 정보 ===
  spec: string;           // 규격1
  spec2?: string;         // 규격2
  spec3?: string;         // 규격3
  // === 전선 정보 ===
  wireMaterial?: string;  // 전선재질
  wireGauge?: string;     // 전선 굵기
  color?: string;         // 색상
  // === 분류 정보 ===
  projectCode?: string;   // 프로젝트코드 (주자재/부자재)
  category: string;       // 품목유형 (원재료/반제품)
  // === 단위/중량 ===
  unit: string;           // 단위 (EA, M 등)
  unitWeight?: number;    // 단위중량
  weightUnit?: string;    // 중량단위 (KG)
  // === 재고 관리 ===
  stock: number;          // 현재고
  safeStock: number;      // 안전 재고
  // === 기타 ===
  desc: string;           // 설명/비고
  regDate: string;        // 등록일
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
    setMaterials(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
  };

  const deleteMaterial = (id: number) => {
    console.log('[MaterialContext] deleteMaterial called with id:', id);
    setMaterials(prev => {
      console.log('[MaterialContext] prev materials count:', prev.length);
      const filtered = prev.filter(m => m.id !== id);
      console.log('[MaterialContext] after filter count:', filtered.length);
      return filtered;
    });
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
  // 검색 우선순위: pdaCode > supplierCode > name > code > hqCode > 정규화/부분일치
  const getMaterialByHQCode = (extractedCode: string): Material | undefined => {
    // 정규화 함수: 대시, 공백 제거하고 소문자로
    const normalize = (s: string) => s.replace(/[-\s]/g, '').toLowerCase();
    const normalizedCode = normalize(extractedCode);
    const trimmedCode = extractedCode.trim();

    // === 1차: 정확 일치 (trim 적용) ===

    // 1. pdaCode 일치 (PDA 확인 품번 - 가장 신뢰도 높음)
    const byPdaCode = materials.find(m => m.pdaCode?.trim() === trimmedCode);
    if (byPdaCode) return byPdaCode;

    // 2. supplierCode 일치 (원자재 공급사 품번)
    const bySupplierCode = materials.find(m => m.supplierCode?.trim() === trimmedCode);
    if (bySupplierCode) return bySupplierCode;

    // 3. name 일치 (품명 - 생산처 바코드 대응)
    const byNameExact = materials.find(m => m.name?.trim() === trimmedCode);
    if (byNameExact) return byNameExact;

    // 4. code 일치 (경림품번)
    const byCode = materials.find(m => m.code?.trim() === trimmedCode);
    if (byCode) return byCode;

    // 5. hqCode 일치 (본사 코드 - 레거시)
    const byHQCode = materials.find(m => m.hqCode?.trim() === trimmedCode);
    if (byHQCode) return byHQCode;

    // === 2차: 전선 색상코드 매핑 ===

    // 6. 전선 색상코드 매핑 조회 (경신전선, 케이알로지스 등)
    const mappedMesCode = wireCodeToMesCode.get(extractedCode);
    if (mappedMesCode) {
      const byMappedCode = materials.find(m => m.code === mappedMesCode);
      if (byMappedCode) return byMappedCode;
    }

    // === 3차: 정규화 일치 (대시/공백 제거) ===

    // 7. pdaCode 정규화
    const byNormalizedPda = materials.find(m => m.pdaCode && normalize(m.pdaCode) === normalizedCode);
    if (byNormalizedPda) return byNormalizedPda;

    // 8. supplierCode 정규화
    const byNormalizedSupplier = materials.find(m => m.supplierCode && normalize(m.supplierCode) === normalizedCode);
    if (byNormalizedSupplier) return byNormalizedSupplier;

    // 9. name 정규화
    const byNormalizedName = materials.find(m => m.name && normalize(m.name) === normalizedCode);
    if (byNormalizedName) return byNormalizedName;

    // 10. code 정규화
    const byNormalizedCode = materials.find(m => m.code && normalize(m.code) === normalizedCode);
    if (byNormalizedCode) return byNormalizedCode;

    // 11. hqCode 정규화
    const byNormalizedHQ = materials.find(m => m.hqCode && normalize(m.hqCode) === normalizedCode);
    if (byNormalizedHQ) return byNormalizedHQ;

    // === 4차: 부분 일치 ===

    // 12. pdaCode/supplierCode 부분 일치
    const byPartialPda = materials.find(m => m.pdaCode && m.pdaCode.includes(extractedCode));
    if (byPartialPda) return byPartialPda;

    const byPartialSupplier = materials.find(m => m.supplierCode && m.supplierCode.includes(extractedCode));
    if (byPartialSupplier) return byPartialSupplier;

    // 13. name 포함 검색
    const byNameContains = materials.find(m => m.name && m.name.includes(extractedCode));
    if (byNameContains) return byNameContains;

    // 14. hqCode 부분 일치 (접두사/접미사)
    const byPartialHQ = materials.find(m => m.hqCode && (m.hqCode.startsWith(extractedCode) || m.hqCode.endsWith(extractedCode)));
    if (byPartialHQ) return byPartialHQ;

    // 15. 정규화된 부분 일치
    const byNormalizedPartial = materials.find(m =>
      (m.pdaCode && normalize(m.pdaCode).includes(normalizedCode)) ||
      (m.supplierCode && normalize(m.supplierCode).includes(normalizedCode)) ||
      (m.hqCode && normalize(m.hqCode).includes(normalizedCode))
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
