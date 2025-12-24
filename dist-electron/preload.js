import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  }
});
contextBridge.exposeInMainWorld("electronAPI", {
  // 프린터
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printPDF: (options) => ipcRenderer.invoke("print-pdf", options),
  printToPDF: () => ipcRenderer.invoke("print-to-pdf"),
  printLabel: (options) => ipcRenderer.invoke("print-label", options),
  // 파일 시스템
  saveFileDialog: (options) => ipcRenderer.invoke("save-file-dialog", options),
  openFileDialog: (options) => ipcRenderer.invoke("open-file-dialog", options),
  writeFile: (options) => ipcRenderer.invoke("write-file", options),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  // ============================================
  // Production API (10개)
  // ============================================
  production: {
    createLot: (input) => ipcRenderer.invoke("production:createLot", input),
    startProduction: (lotId) => ipcRenderer.invoke("production:startProduction", lotId),
    completeProduction: (lotId, quantity) => ipcRenderer.invoke("production:completeProduction", lotId, quantity),
    addMaterial: (lotId, materialId, quantity, lotNumber) => ipcRenderer.invoke("production:addMaterial", lotId, materialId, quantity, lotNumber),
    removeMaterial: (lotMaterialId) => ipcRenderer.invoke("production:removeMaterial", lotMaterialId),
    getLotById: (lotId) => ipcRenderer.invoke("production:getLotById", lotId),
    getLotByNumber: (lotNumber) => ipcRenderer.invoke("production:getLotByNumber", lotNumber),
    getLotsByProcess: (processCode) => ipcRenderer.invoke("production:getLotsByProcess", processCode),
    getLotsByStatus: (status) => ipcRenderer.invoke("production:getLotsByStatus", status),
    updateLotQuantity: (lotId, quantity) => ipcRenderer.invoke("production:updateLotQuantity", lotId, quantity)
  },
  // ============================================
  // Stock API (20개)
  // ============================================
  stock: {
    // 기본 재고 API (8개)
    receiveStock: (input) => ipcRenderer.invoke("stock:receiveStock", input),
    consumeStock: (stockId, quantity, lotId) => ipcRenderer.invoke("stock:consumeStock", stockId, quantity, lotId),
    deductByBOM: (productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId) => ipcRenderer.invoke("stock:deductByBOM", productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId),
    getStockByMaterial: (materialId) => ipcRenderer.invoke("stock:getStockByMaterial", materialId),
    getStockSummary: () => ipcRenderer.invoke("stock:getStockSummary"),
    getLowStock: () => ipcRenderer.invoke("stock:getLowStock"),
    getAvailableQty: (materialId) => ipcRenderer.invoke("stock:getAvailableQty", materialId),
    getTodayReceivings: () => ipcRenderer.invoke("stock:getTodayReceivings"),
    // 전체 재고 조회
    getAllStocks: (options) => ipcRenderer.invoke("stock:getAllStocks", options),
    // 공정별 재고 API (9개)
    registerProcessStock: (input) => ipcRenderer.invoke("stock:registerProcessStock", input),
    getStocksByProcess: (processCode, options) => ipcRenderer.invoke("stock:getStocksByProcess", processCode, options),
    checkProcessStockStatus: (processCode, lotNumber) => ipcRenderer.invoke("stock:checkProcessStockStatus", processCode, lotNumber),
    consumeProcessStock: (processCode, materialId, quantity, productionLotId, allowNegative) => ipcRenderer.invoke("stock:consumeProcessStock", processCode, materialId, quantity, productionLotId, allowNegative),
    getProcessStockSummary: (processCode) => ipcRenderer.invoke("stock:getProcessStockSummary", processCode),
    getProcessAvailableQty: (processCode, materialId) => ipcRenderer.invoke("stock:getProcessAvailableQty", processCode, materialId),
    getTodayProcessReceivings: (processCode) => ipcRenderer.invoke("stock:getTodayProcessReceivings", processCode),
    // 데이터 관리 API (2개)
    deleteStockItems: (ids) => ipcRenderer.invoke("stock:deleteStockItems", ids),
    resetAllStockData: () => ipcRenderer.invoke("stock:resetAllStockData")
  },
  // ============================================
  // BOM API (4개)
  // ============================================
  bom: {
    createBOMItem: (input) => ipcRenderer.invoke("bom:createBOMItem", input),
    updateBOMItem: (bomId, input) => ipcRenderer.invoke("bom:updateBOMItem", bomId, input),
    deleteBOMItem: (bomId) => ipcRenderer.invoke("bom:deleteBOMItem", bomId),
    getBOMByProduct: (productId) => ipcRenderer.invoke("bom:getBOMByProduct", productId)
  },
  // ============================================
  // Material API (5개)
  // ============================================
  material: {
    create: (input) => ipcRenderer.invoke("material:create", input),
    getById: (materialId) => ipcRenderer.invoke("material:getById", materialId),
    update: (materialId, input) => ipcRenderer.invoke("material:update", materialId, input),
    delete: (materialId) => ipcRenderer.invoke("material:delete", materialId),
    getAll: () => ipcRenderer.invoke("material:getAll")
  },
  // ============================================
  // LotTrace API (3개)
  // ============================================
  lotTrace: {
    traceForward: (lotId) => ipcRenderer.invoke("lotTrace:traceForward", lotId),
    traceBackward: (lotId) => ipcRenderer.invoke("lotTrace:traceBackward", lotId),
    buildTraceTree: (lotId, direction) => ipcRenderer.invoke("lotTrace:buildTraceTree", lotId, direction)
  },
  // ============================================
  // Inspection API (2개)
  // ============================================
  inspection: {
    create: (input) => ipcRenderer.invoke("inspection:create", input),
    getByLot: (lotId) => ipcRenderer.invoke("inspection:getByLot", lotId)
  },
  // ============================================
  // Line API (2개)
  // ============================================
  line: {
    getAll: () => ipcRenderer.invoke("line:getAll"),
    getByProcess: (processCode) => ipcRenderer.invoke("line:getByProcess", processCode)
  },
  // ============================================
  // Sequence API (2개)
  // ============================================
  sequence: {
    getNext: (prefix) => ipcRenderer.invoke("sequence:getNext", prefix),
    getNextBundle: (prefix) => ipcRenderer.invoke("sequence:getNextBundle", prefix)
  },
  // ============================================
  // Bundle API (12개)
  // ============================================
  bundle: {
    create: (input) => ipcRenderer.invoke("bundle:create", input),
    addToBundle: (input) => ipcRenderer.invoke("bundle:addToBundle", input),
    removeFromBundle: (bundleItemId) => ipcRenderer.invoke("bundle:removeFromBundle", bundleItemId),
    complete: (bundleLotId) => ipcRenderer.invoke("bundle:complete", bundleLotId),
    unbundle: (bundleLotId) => ipcRenderer.invoke("bundle:unbundle", bundleLotId),
    delete: (bundleLotId) => ipcRenderer.invoke("bundle:delete", bundleLotId),
    getById: (bundleLotId) => ipcRenderer.invoke("bundle:getById", bundleLotId),
    getByNo: (bundleNo) => ipcRenderer.invoke("bundle:getByNo", bundleNo),
    getActive: () => ipcRenderer.invoke("bundle:getActive"),
    getAvailableLots: (productId) => ipcRenderer.invoke("bundle:getAvailableLots", productId),
    createSet: (items) => ipcRenderer.invoke("bundle:createSet", items),
    shipEntire: (bundleId) => ipcRenderer.invoke("bundle:shipEntire", bundleId)
  },
  // ============================================
  // Product API (5개)
  // ============================================
  product: {
    getAll: () => ipcRenderer.invoke("product:getAll"),
    getById: (productId) => ipcRenderer.invoke("product:getById", productId),
    create: (input) => ipcRenderer.invoke("product:create", input),
    update: (productId, input) => ipcRenderer.invoke("product:update", productId, input),
    delete: (productId) => ipcRenderer.invoke("product:delete", productId)
  }
});
