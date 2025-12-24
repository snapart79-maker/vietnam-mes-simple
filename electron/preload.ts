import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Printer & File API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // 프린터
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printPDF: (options: {
    printerName?: string
    silent?: boolean
    copies?: number
  }) => ipcRenderer.invoke('print-pdf', options),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  printLabel: (options: {
    printerName: string
    zplData?: string
    pdfBase64?: string
  }) => ipcRenderer.invoke('print-label', options),

  // 파일 시스템
  saveFileDialog: (options: {
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => ipcRenderer.invoke('save-file-dialog', options),
  openFileDialog: (options: {
    filters?: { name: string; extensions: string[] }[]
    multiple?: boolean
  }) => ipcRenderer.invoke('open-file-dialog', options),
  writeFile: (options: { filePath: string; data: string | Buffer }) =>
    ipcRenderer.invoke('write-file', options),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),

  // ============================================
  // Production API (10개)
  // ============================================
  production: {
    createLot: (input: {
      processCode: string
      productId: number
      targetQuantity: number
      lineId?: number
      workerId?: string
      inputMaterialDetails?: Array<{
        materialId: number
        materialCode: string
        materialName: string
        quantity: number
        lotNumber?: string
      }>
    }) => ipcRenderer.invoke('production:createLot', input),

    startProduction: (lotId: number) =>
      ipcRenderer.invoke('production:startProduction', lotId),

    completeProduction: (lotId: number, quantity: number) =>
      ipcRenderer.invoke('production:completeProduction', lotId, quantity),

    addMaterial: (lotId: number, materialId: number, quantity: number, lotNumber?: string) =>
      ipcRenderer.invoke('production:addMaterial', lotId, materialId, quantity, lotNumber),

    removeMaterial: (lotMaterialId: number) =>
      ipcRenderer.invoke('production:removeMaterial', lotMaterialId),

    getLotById: (lotId: number) =>
      ipcRenderer.invoke('production:getLotById', lotId),

    getLotByNumber: (lotNumber: string) =>
      ipcRenderer.invoke('production:getLotByNumber', lotNumber),

    getLotsByProcess: (processCode: string) =>
      ipcRenderer.invoke('production:getLotsByProcess', processCode),

    getLotsByStatus: (status: string) =>
      ipcRenderer.invoke('production:getLotsByStatus', status),

    updateLotQuantity: (lotId: number, quantity: number) =>
      ipcRenderer.invoke('production:updateLotQuantity', lotId, quantity),
  },

  // ============================================
  // Stock API (20개)
  // ============================================
  stock: {
    // 기본 재고 API (8개)
    receiveStock: (input: {
      materialId: number
      quantity: number
      lotNumber?: string
      location?: string
      expiryDate?: Date
      supplierId?: number
    }) => ipcRenderer.invoke('stock:receiveStock', input),

    consumeStock: (stockId: number, quantity: number, lotId?: number) =>
      ipcRenderer.invoke('stock:consumeStock', stockId, quantity, lotId),

    deductByBOM: (
      productId: number,
      processCode: string,
      productionQty: number,
      inputMaterials?: Array<{ materialId: number; quantity: number; lotNumber?: string }>,
      allowNegative?: boolean,
      productionLotId?: number
    ) => ipcRenderer.invoke('stock:deductByBOM', productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId),

    getStockByMaterial: (materialId: number) =>
      ipcRenderer.invoke('stock:getStockByMaterial', materialId),

    getStockSummary: () =>
      ipcRenderer.invoke('stock:getStockSummary'),

    getLowStock: () =>
      ipcRenderer.invoke('stock:getLowStock'),

    getAvailableQty: (materialId: number) =>
      ipcRenderer.invoke('stock:getAvailableQty', materialId),

    getTodayReceivings: () =>
      ipcRenderer.invoke('stock:getTodayReceivings'),

    // 전체 재고 조회
    getAllStocks: (options?: { materialCode?: string; showZero?: boolean }) =>
      ipcRenderer.invoke('stock:getAllStocks', options),

    // 공정별 재고 API (9개)
    registerProcessStock: (input: {
      processCode: string
      materialId: number
      materialCode: string
      materialName: string
      lotNumber: string
      quantity: number
    }) => ipcRenderer.invoke('stock:registerProcessStock', input),

    getStocksByProcess: (processCode: string, options?: { materialCode?: string; showZero?: boolean }) =>
      ipcRenderer.invoke('stock:getStocksByProcess', processCode, options),

    checkProcessStockStatus: (processCode: string, lotNumber: string) =>
      ipcRenderer.invoke('stock:checkProcessStockStatus', processCode, lotNumber),

    consumeProcessStock: (processCode: string, materialId: number, quantity: number, productionLotId?: number, allowNegative?: boolean) =>
      ipcRenderer.invoke('stock:consumeProcessStock', processCode, materialId, quantity, productionLotId, allowNegative),

    getProcessStockSummary: (processCode: string) =>
      ipcRenderer.invoke('stock:getProcessStockSummary', processCode),

    getProcessAvailableQty: (processCode: string, materialId: number) =>
      ipcRenderer.invoke('stock:getProcessAvailableQty', processCode, materialId),

    getTodayProcessReceivings: (processCode?: string) =>
      ipcRenderer.invoke('stock:getTodayProcessReceivings', processCode),

    // 데이터 관리 API (2개)
    deleteStockItems: (ids: number[]) =>
      ipcRenderer.invoke('stock:deleteStockItems', ids),

    resetAllStockData: () =>
      ipcRenderer.invoke('stock:resetAllStockData'),
  },

  // ============================================
  // BOM API (4개)
  // ============================================
  bom: {
    createBOMItem: (input: {
      productId: number
      materialId: number
      quantity: number
      processCode?: string
      unit?: string
    }) => ipcRenderer.invoke('bom:createBOMItem', input),

    updateBOMItem: (bomId: number, input: {
      quantity?: number
      processCode?: string
      unit?: string
    }) => ipcRenderer.invoke('bom:updateBOMItem', bomId, input),

    deleteBOMItem: (bomId: number) =>
      ipcRenderer.invoke('bom:deleteBOMItem', bomId),

    getBOMByProduct: (productId: number) =>
      ipcRenderer.invoke('bom:getBOMByProduct', productId),
  },

  // ============================================
  // Material API (5개)
  // ============================================
  material: {
    create: (input: {
      code: string
      name: string
      spec?: string
      unit: string
      category?: string
      safeStock?: number
    }) => ipcRenderer.invoke('material:create', input),

    getById: (materialId: number) =>
      ipcRenderer.invoke('material:getById', materialId),

    update: (materialId: number, input: {
      name?: string
      spec?: string
      unit?: string
      category?: string
      safeStock?: number
    }) => ipcRenderer.invoke('material:update', materialId, input),

    delete: (materialId: number) =>
      ipcRenderer.invoke('material:delete', materialId),

    getAll: () =>
      ipcRenderer.invoke('material:getAll'),
  },

  // ============================================
  // LotTrace API (3개)
  // ============================================
  lotTrace: {
    traceForward: (lotId: number) =>
      ipcRenderer.invoke('lotTrace:traceForward', lotId),

    traceBackward: (lotId: number) =>
      ipcRenderer.invoke('lotTrace:traceBackward', lotId),

    buildTraceTree: (lotId: number, direction: 'forward' | 'backward') =>
      ipcRenderer.invoke('lotTrace:buildTraceTree', lotId, direction),
  },

  // ============================================
  // Inspection API (2개)
  // ============================================
  inspection: {
    create: (input: {
      lotId: number
      inspectorId?: string
      result: 'PASS' | 'FAIL' | 'PENDING'
      defectCount?: number
      defectType?: string
      notes?: string
    }) => ipcRenderer.invoke('inspection:create', input),

    getByLot: (lotId: number) =>
      ipcRenderer.invoke('inspection:getByLot', lotId),
  },

  // ============================================
  // Line API (2개)
  // ============================================
  line: {
    getAll: () =>
      ipcRenderer.invoke('line:getAll'),

    getByProcess: (processCode: string) =>
      ipcRenderer.invoke('line:getByProcess', processCode),
  },

  // ============================================
  // Sequence API (2개)
  // ============================================
  sequence: {
    getNext: (prefix: string) =>
      ipcRenderer.invoke('sequence:getNext', prefix),

    getNextBundle: (prefix: string) =>
      ipcRenderer.invoke('sequence:getNextBundle', prefix),
  },

  // ============================================
  // Bundle API (12개)
  // ============================================
  bundle: {
    create: (input: {
      processCode: string
      productId: number
      productCode: string
      setQuantity: number
    }) => ipcRenderer.invoke('bundle:create', input),

    addToBundle: (input: {
      bundleLotId: number
      productionLotId: number
      quantity: number
    }) => ipcRenderer.invoke('bundle:addToBundle', input),

    removeFromBundle: (bundleItemId: number) =>
      ipcRenderer.invoke('bundle:removeFromBundle', bundleItemId),

    complete: (bundleLotId: number) =>
      ipcRenderer.invoke('bundle:complete', bundleLotId),

    unbundle: (bundleLotId: number) =>
      ipcRenderer.invoke('bundle:unbundle', bundleLotId),

    delete: (bundleLotId: number) =>
      ipcRenderer.invoke('bundle:delete', bundleLotId),

    getById: (bundleLotId: number) =>
      ipcRenderer.invoke('bundle:getById', bundleLotId),

    getByNo: (bundleNo: string) =>
      ipcRenderer.invoke('bundle:getByNo', bundleNo),

    getActive: () =>
      ipcRenderer.invoke('bundle:getActive'),

    getAvailableLots: (productId: number) =>
      ipcRenderer.invoke('bundle:getAvailableLots', productId),

    createSet: (items: Array<{ lotId: number; quantity: number }>) =>
      ipcRenderer.invoke('bundle:createSet', items),

    shipEntire: (bundleId: number) =>
      ipcRenderer.invoke('bundle:shipEntire', bundleId),
  },

  // ============================================
  // Product API (5개)
  // ============================================
  product: {
    getAll: () =>
      ipcRenderer.invoke('product:getAll'),

    getById: (productId: number) =>
      ipcRenderer.invoke('product:getById', productId),

    create: (input: {
      code: string
      name: string
      spec?: string
      processCode?: string
      bomLevel?: number
    }) => ipcRenderer.invoke('product:create', input),

    update: (productId: number, input: {
      name?: string
      spec?: string
      processCode?: string
      bomLevel?: number
    }) => ipcRenderer.invoke('product:update', productId, input),

    delete: (productId: number) =>
      ipcRenderer.invoke('product:delete', productId),
  },
})
