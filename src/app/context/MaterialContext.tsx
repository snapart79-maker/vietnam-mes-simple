import React, { createContext, useContext, useState, useEffect, ReactNode, PropsWithChildren, useMemo, useCallback } from 'react';

// Electron API 헬퍼 함수
import { hasBusinessAPI, getAPI } from '../../lib/electronBridge';

// localStorage 키 (자재 마스터용)
const MATERIALS_STORAGE_KEY = 'vietnam_mes_materials';

// localStorage에서 자재 로드
function loadMaterialsFromStorage(): Material[] {
  try {
    const stored = localStorage.getItem(MATERIALS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('MaterialContext: localStorage 로드 실패', e);
  }
  return [];
}

// localStorage에 자재 저장
function saveMaterialsToStorage(materials: Material[]) {
  try {
    localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    console.error('MaterialContext: localStorage 저장 실패', e);
  }
}

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
  addMaterial: (material: Omit<Material, 'id' | 'stock' | 'regDate'>) => Promise<void>;
  addMaterials: (materials: Omit<Material, 'id' | 'stock' | 'regDate'>[]) => Promise<number>;
  updateMaterial: (material: Material) => Promise<void>;
  deleteMaterial: (id: number) => Promise<void>;
  resetMaterials: () => Promise<number>;
  getMaterialByCode: (code: string) => Material | undefined;
  getMaterialByHQCode: (hqCode: string) => Material | undefined;
  // 전선 색상코드 매핑 관련
  wireColorMappings: WireColorMapping[];
  loadWireColorMappings: (mappings: WireColorMapping[]) => number;
  getWireMappingCount: () => number;
  // DB에서 자재 목록 새로고침
  refreshMaterials: () => Promise<void>;
}

const MaterialContext = createContext<MaterialContextType | undefined>(undefined);

// localStorage 키 (전선 색상코드 매핑용)
const WIRE_MAPPING_KEY = 'vietnam_mes_wire_color_mappings';

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

// localStorage에 전선 색상코드 매핑 저장
function saveWireMappingsToStorage(mappings: WireColorMapping[]) {
  try {
    localStorage.setItem(WIRE_MAPPING_KEY, JSON.stringify(mappings));
  } catch (e) {
    console.error('MaterialContext: wire mapping 저장 실패', e);
  }
}

export const MaterialProvider = ({ children }: PropsWithChildren) => {
  // 초기 상태: 브라우저 환경에서는 localStorage에서 로드
  const [materials, setMaterials] = useState<Material[]>(() => {
    if (!hasBusinessAPI()) {
      return loadMaterialsFromStorage();
    }
    return [];
  });
  const [wireColorMappings, setWireColorMappings] = useState<WireColorMapping[]>(() => loadWireMappingsFromStorage());

  // wireColorMappings 변경 시 localStorage에 저장
  useEffect(() => {
    saveWireMappingsToStorage(wireColorMappings);
  }, [wireColorMappings]);

  // 브라우저 환경에서 materials 변경 시 localStorage에 저장
  useEffect(() => {
    if (!hasBusinessAPI()) {
      saveMaterialsToStorage(materials);
    }
  }, [materials]);

  // 초기 로드 시 DB에서 자재 목록 가져오기 (Electron 환경만)
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        if (!hasBusinessAPI()) {
          console.log('[MaterialContext] Electron API not available, using localStorage');
          return;
        }
        const api = getAPI();
        if (!api) return;

        const result = await api.material.getAll();
        if (result.success && result.data) {
          setMaterials(result.data as Material[]);
        }
      } catch (err) {
        console.error('[MaterialContext] 초기 자재 로드 실패:', err);
      }
    };
    loadMaterials();
  }, []);

  // 전선 색상코드 → MES 품번 매핑 (빠른 조회용 Map)
  const wireCodeToMesCode = useMemo(() => {
    const map = new Map<string, string>();
    wireColorMappings.forEach(m => {
      map.set(m.colorCode, m.mesCode);
    });
    return map;
  }, [wireColorMappings]);

  // 자재 등록 (Electron API + 브라우저 localStorage 폴백)
  const addMaterial = async (newMat: Omit<Material, 'id' | 'stock' | 'regDate'>): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];

    // 브라우저 환경: localStorage에 저장
    if (!hasBusinessAPI()) {
      const newId = Date.now();
      const material: Material = {
        ...newMat,
        id: newId,
        stock: 0,
        regDate: today,
        spec: newMat.spec || '',
        desc: newMat.desc || '',
      };
      setMaterials(prev => [...prev, material]);
      return;
    }

    // Electron 환경: DB에 저장
    const api = getAPI();
    const result = await api!.material.create({
      code: newMat.code,
      name: newMat.name,
      spec: newMat.spec,
      unit: newMat.unit,
      category: newMat.category,
      safeStock: newMat.safeStock,
    });

    if (!result.success) {
      throw new Error(result.error || '자재 등록 실패');
    }

    // DB에서 생성된 데이터로 로컬 상태 업데이트
    const dbMaterial = result.data as Material;
    const material: Material = {
      ...newMat,
      id: dbMaterial.id,
      stock: dbMaterial.stock || 0,
      regDate: dbMaterial.regDate || today,
    };
    setMaterials(prev => [...prev, material]);
  };

  // 일괄 등록 함수 (Electron API + 브라우저 localStorage 폴백)
  const addMaterials = async (newMats: Omit<Material, 'id' | 'stock' | 'regDate'>[]): Promise<number> => {
    const today = new Date().toISOString().split('T')[0];

    // 브라우저 환경: localStorage에 저장
    if (!hasBusinessAPI()) {
      console.log('[MaterialContext] Browser mode: 일괄 등록', newMats.length, '건');
      const addedMaterials: Material[] = newMats.map((newMat, index) => ({
        ...newMat,
        id: Date.now() + index, // 고유 ID 생성
        stock: 0,
        regDate: today,
        spec: newMat.spec || '',
        desc: newMat.desc || '',
      }));

      // 중복 제거: 이미 있는 code는 제외
      setMaterials(prev => {
        const existingCodes = new Set(prev.map(m => m.code));
        const newUniqueMaterials = addedMaterials.filter(m => !existingCodes.has(m.code));
        console.log('[MaterialContext] 중복 제외 후 등록:', newUniqueMaterials.length, '건');
        return [...prev, ...newUniqueMaterials];
      });

      return addedMaterials.length;
    }

    // Electron 환경: DB에 저장
    const api = getAPI();
    const addedMaterials: Material[] = [];

    for (const newMat of newMats) {
      const result = await api!.material.create({
        code: newMat.code,
        name: newMat.name,
        spec: newMat.spec,
        unit: newMat.unit,
        category: newMat.category,
        safeStock: newMat.safeStock,
      });

      if (result.success && result.data) {
        const dbMaterial = result.data as Material;
        addedMaterials.push({
          ...newMat,
          id: dbMaterial.id,
          stock: dbMaterial.stock || 0,
          regDate: dbMaterial.regDate || today,
        });
      }
    }

    // 로컬 상태 일괄 업데이트
    setMaterials(prev => [...prev, ...addedMaterials]);
    return addedMaterials.length;
  };

  // 자재 수정 (Electron API + 브라우저 localStorage 폴백)
  const updateMaterial = async (updatedMat: Material): Promise<void> => {
    // 브라우저 환경: localStorage에서 수정
    if (!hasBusinessAPI()) {
      setMaterials(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
      return;
    }

    // Electron 환경: DB에서 수정
    const api = getAPI();
    const result = await api!.material.update(updatedMat.id, {
      name: updatedMat.name,
      spec: updatedMat.spec,
      unit: updatedMat.unit,
      category: updatedMat.category,
      safeStock: updatedMat.safeStock,
    });

    if (!result.success) {
      throw new Error(result.error || '자재 수정 실패');
    }

    // 로컬 상태 업데이트
    setMaterials(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
  };

  // 자재 삭제 (Electron API + 브라우저 localStorage 폴백)
  const deleteMaterial = async (id: number): Promise<void> => {
    console.log('[MaterialContext] deleteMaterial called with id:', id);

    // 브라우저 환경: localStorage에서 삭제
    if (!hasBusinessAPI()) {
      setMaterials(prev => {
        console.log('[MaterialContext] prev materials count:', prev.length);
        const filtered = prev.filter(m => m.id !== id);
        console.log('[MaterialContext] after filter count:', filtered.length);
        return filtered;
      });
      return;
    }

    // Electron 환경: DB에서 삭제
    const api = getAPI();
    const result = await api!.material.delete(id);

    if (!result.success) {
      throw new Error(result.error || '자재 삭제 실패');
    }

    // 로컬 상태 업데이트
    setMaterials(prev => {
      console.log('[MaterialContext] prev materials count:', prev.length);
      const filtered = prev.filter(m => m.id !== id);
      console.log('[MaterialContext] after filter count:', filtered.length);
      return filtered;
    });
  };

  // 자재 초기화 (Electron API + 브라우저 localStorage 폴백)
  const resetMaterials = async (): Promise<number> => {
    const count = materials.length;

    // 브라우저 환경: localStorage 초기화
    if (!hasBusinessAPI()) {
      setMaterials([]);
      return count;
    }

    // Electron 환경: DB에서 삭제
    const api = getAPI();

    // 모든 자재 삭제
    for (const material of materials) {
      await api!.material.delete(material.id);
    }

    // 로컬 상태 초기화
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

  // DB에서 자재 목록 새로고침 (Electron API + 브라우저 localStorage 폴백)
  const refreshMaterials = async (): Promise<void> => {
    // 브라우저 환경: localStorage에서 새로고침
    if (!hasBusinessAPI()) {
      console.log('[MaterialContext] Browser mode: localStorage에서 새로고침');
      const storedMaterials = loadMaterialsFromStorage();
      setMaterials(storedMaterials);
      return;
    }

    // Electron 환경: DB에서 새로고침
    const api = getAPI();
    const result = await api!.material.getAll();

    if (!result.success) {
      throw new Error(result.error || '자재 목록 조회 실패');
    }

    // DB 데이터로 로컬 상태 갱신
    const dbMaterials = (result.data || []) as Material[];
    setMaterials(dbMaterials);
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
      refreshMaterials,
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
