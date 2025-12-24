import { contextBridge as r, ipcRenderer as t } from "electron";
r.exposeInMainWorld("ipcRenderer", {
  on(...e) {
    const [o, n] = e;
    return t.on(o, (i, ...c) => n(i, ...c));
  },
  off(...e) {
    const [o, ...n] = e;
    return t.off(o, ...n);
  },
  send(...e) {
    const [o, ...n] = e;
    return t.send(o, ...n);
  },
  invoke(...e) {
    const [o, ...n] = e;
    return t.invoke(o, ...n);
  }
});
r.exposeInMainWorld("electronAPI", {
  // 프린터
  getPrinters: () => t.invoke("get-printers"),
  printPDF: (e) => t.invoke("print-pdf", e),
  printToPDF: () => t.invoke("print-to-pdf"),
  printLabel: (e) => t.invoke("print-label", e),
  // 파일 시스템
  saveFileDialog: (e) => t.invoke("save-file-dialog", e),
  openFileDialog: (e) => t.invoke("open-file-dialog", e),
  writeFile: (e) => t.invoke("write-file", e),
  readFile: (e) => t.invoke("read-file", e),
  // ============================================
  // Production API (10개)
  // ============================================
  production: {
    createLot: (e) => t.invoke("production:createLot", e),
    startProduction: (e) => t.invoke("production:startProduction", e),
    completeProduction: (e, o) => t.invoke("production:completeProduction", e, o),
    addMaterial: (e, o, n, i) => t.invoke("production:addMaterial", e, o, n, i),
    removeMaterial: (e) => t.invoke("production:removeMaterial", e),
    getLotById: (e) => t.invoke("production:getLotById", e),
    getLotByNumber: (e) => t.invoke("production:getLotByNumber", e),
    getLotsByProcess: (e) => t.invoke("production:getLotsByProcess", e),
    getLotsByStatus: (e) => t.invoke("production:getLotsByStatus", e),
    updateLotQuantity: (e, o) => t.invoke("production:updateLotQuantity", e, o)
  },
  // ============================================
  // Stock API (20개)
  // ============================================
  stock: {
    // 기본 재고 API (8개)
    receiveStock: (e) => t.invoke("stock:receiveStock", e),
    consumeStock: (e, o, n) => t.invoke("stock:consumeStock", e, o, n),
    deductByBOM: (e, o, n, i, c, k) => t.invoke("stock:deductByBOM", e, o, n, i, c, k),
    getStockByMaterial: (e) => t.invoke("stock:getStockByMaterial", e),
    getStockSummary: () => t.invoke("stock:getStockSummary"),
    getLowStock: () => t.invoke("stock:getLowStock"),
    getAvailableQty: (e) => t.invoke("stock:getAvailableQty", e),
    getTodayReceivings: () => t.invoke("stock:getTodayReceivings"),
    // 전체 재고 조회
    getAllStocks: (e) => t.invoke("stock:getAllStocks", e),
    // 공정별 재고 API (9개)
    registerProcessStock: (e) => t.invoke("stock:registerProcessStock", e),
    getStocksByProcess: (e, o) => t.invoke("stock:getStocksByProcess", e, o),
    checkProcessStockStatus: (e, o) => t.invoke("stock:checkProcessStockStatus", e, o),
    consumeProcessStock: (e, o, n, i, c) => t.invoke("stock:consumeProcessStock", e, o, n, i, c),
    getProcessStockSummary: (e) => t.invoke("stock:getProcessStockSummary", e),
    getProcessAvailableQty: (e, o) => t.invoke("stock:getProcessAvailableQty", e, o),
    getTodayProcessReceivings: (e) => t.invoke("stock:getTodayProcessReceivings", e),
    // 데이터 관리 API (2개)
    deleteStockItems: (e) => t.invoke("stock:deleteStockItems", e),
    resetAllStockData: () => t.invoke("stock:resetAllStockData")
  },
  // ============================================
  // BOM API (4개)
  // ============================================
  bom: {
    createBOMItem: (e) => t.invoke("bom:createBOMItem", e),
    updateBOMItem: (e, o) => t.invoke("bom:updateBOMItem", e, o),
    deleteBOMItem: (e) => t.invoke("bom:deleteBOMItem", e),
    getBOMByProduct: (e) => t.invoke("bom:getBOMByProduct", e)
  },
  // ============================================
  // Material API (5개)
  // ============================================
  material: {
    create: (e) => t.invoke("material:create", e),
    getById: (e) => t.invoke("material:getById", e),
    update: (e, o) => t.invoke("material:update", e, o),
    delete: (e) => t.invoke("material:delete", e),
    getAll: () => t.invoke("material:getAll")
  },
  // ============================================
  // LotTrace API (3개)
  // ============================================
  lotTrace: {
    traceForward: (e) => t.invoke("lotTrace:traceForward", e),
    traceBackward: (e) => t.invoke("lotTrace:traceBackward", e),
    buildTraceTree: (e, o) => t.invoke("lotTrace:buildTraceTree", e, o)
  },
  // ============================================
  // Inspection API (2개)
  // ============================================
  inspection: {
    create: (e) => t.invoke("inspection:create", e),
    getByLot: (e) => t.invoke("inspection:getByLot", e)
  },
  // ============================================
  // Line API (2개)
  // ============================================
  line: {
    getAll: () => t.invoke("line:getAll"),
    getByProcess: (e) => t.invoke("line:getByProcess", e)
  },
  // ============================================
  // Sequence API (2개)
  // ============================================
  sequence: {
    getNext: (e) => t.invoke("sequence:getNext", e),
    getNextBundle: (e) => t.invoke("sequence:getNextBundle", e)
  },
  // ============================================
  // Bundle API (12개)
  // ============================================
  bundle: {
    create: (e) => t.invoke("bundle:create", e),
    addToBundle: (e) => t.invoke("bundle:addToBundle", e),
    removeFromBundle: (e) => t.invoke("bundle:removeFromBundle", e),
    complete: (e) => t.invoke("bundle:complete", e),
    unbundle: (e) => t.invoke("bundle:unbundle", e),
    delete: (e) => t.invoke("bundle:delete", e),
    getById: (e) => t.invoke("bundle:getById", e),
    getByNo: (e) => t.invoke("bundle:getByNo", e),
    getActive: () => t.invoke("bundle:getActive"),
    getAvailableLots: (e) => t.invoke("bundle:getAvailableLots", e),
    createSet: (e) => t.invoke("bundle:createSet", e),
    shipEntire: (e) => t.invoke("bundle:shipEntire", e)
  },
  // ============================================
  // Product API (5개)
  // ============================================
  product: {
    getAll: () => t.invoke("product:getAll"),
    getById: (e) => t.invoke("product:getById", e),
    create: (e) => t.invoke("product:create", e),
    update: (e, o) => t.invoke("product:update", e, o),
    delete: (e) => t.invoke("product:delete", e)
  }
});
