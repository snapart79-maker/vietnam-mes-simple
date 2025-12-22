import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';

// 완제품 데이터 타입 정의
export interface Product {
  id: number;
  code: string;          // 품번
  name: string;          // 품명
  spec?: string;         // 규격
  type: string;          // 유형 (FINISHED, SEMI 등)
  processCode?: string;  // 공정 코드
  crimpCode?: string;    // 압착 코드
  description?: string;  // 설명
  regDate: string;       // 등록일
}

interface ProductContextType {
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'regDate'>) => void;
  addProducts: (products: Omit<Product, 'id' | 'regDate'>[]) => number; // 일괄 등록
  updateProduct: (product: Product) => void;
  deleteProduct: (id: number) => void;
  resetProducts: () => number;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// localStorage 키
const STORAGE_KEY = 'vietnam_mes_products';

// localStorage에서 데이터 로드
function loadFromStorage(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('ProductContext: localStorage 로드 실패', e);
  }
  return [];
}

// localStorage에 데이터 저장
function saveToStorage(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch (e) {
    console.error('ProductContext: localStorage 저장 실패', e);
  }
}

export const ProductProvider = ({ children }: PropsWithChildren) => {
  // 초기 로드 시 localStorage에서 데이터 복원
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage());

  // products 변경 시 localStorage에 저장
  useEffect(() => {
    saveToStorage(products);
  }, [products]);

  const addProduct = (newProd: Omit<Product, 'id' | 'regDate'>) => {
    const id = Math.max(...products.map(p => p.id), 0) + 1;
    const product: Product = {
      ...newProd,
      id,
      regDate: new Date().toISOString().split('T')[0],
    };
    setProducts([...products, product]);
  };

  // 일괄 등록 함수
  const addProducts = (newProds: Omit<Product, 'id' | 'regDate'>[]): number => {
    const startId = Math.max(...products.map(p => p.id), 0) + 1;
    const today = new Date().toISOString().split('T')[0];

    const productsToAdd: Product[] = newProds.map((prod, index) => ({
      ...prod,
      id: startId + index,
      regDate: today,
    }));

    setProducts(prev => [...prev, ...productsToAdd]);
    return productsToAdd.length;
  };

  const updateProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
  };

  const deleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const resetProducts = () => {
    const count = products.length;
    setProducts([]);
    return count;
  };

  return (
    <ProductContext.Provider value={{
      products,
      addProduct,
      addProducts,
      updateProduct,
      deleteProduct,
      resetProducts
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProduct = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
};
