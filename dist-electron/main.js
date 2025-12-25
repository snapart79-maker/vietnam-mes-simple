import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
const prisma$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: prisma,
  prisma
}, Symbol.toStringTag, { value: "Module" }));
const PROCESS_SHORT_CODES = {
  "MO": "O",
  // 자재출고
  "CA": "C",
  // 자동절압착
  "MC": "M",
  // 수동압착
  "MS": "S",
  // 미드스플라이스
  "SB": "B",
  // 서브조립
  "HS": "H",
  // 열수축
  "SP": "P",
  // 제품조립제공부품
  "PA": "A",
  // 제품조립
  "CI": "I",
  // 회로검사
  "VI": "V"
  // 육안검사
};
Object.fromEntries(
  Object.entries(PROCESS_SHORT_CODES).map(([k, v]) => [v, k])
);
function getDateString(date = /* @__PURE__ */ new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}
function generateBarcodeV1(processCode, sequence, date = /* @__PURE__ */ new Date()) {
  const dateStr = getDateString(date);
  const seqStr = String(sequence).padStart(4, "0");
  return `${processCode.toUpperCase()}-${dateStr}-${seqStr}`;
}
function generateBarcodeV2(processCode, productCode, quantity, sequence, date = /* @__PURE__ */ new Date()) {
  const shortCode = PROCESS_SHORT_CODES[processCode.toUpperCase()] || processCode[0];
  const dateStr = getDateString(date);
  const seqStr = String(sequence).padStart(3, "0");
  return `${productCode}Q${quantity}-${shortCode}${dateStr}-${seqStr}`;
}
function generateBundleBarcode(productCode, _setQuantity, sequence, date = /* @__PURE__ */ new Date()) {
  const dateStr = getDateString(date);
  const seqStr = String(sequence).padStart(3, "0");
  return `BD-${productCode}-${dateStr}-${seqStr}`;
}
const DEFAULT_PADDING = 4;
const BUNDLE_PADDING = 3;
const MAX_SEQUENCE = 9999;
async function getNextSequence(prefix, date = /* @__PURE__ */ new Date(), padding = DEFAULT_PADDING) {
  const dateKey = getDateString(date);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.sequenceCounter.findUnique({
      where: {
        prefix_dateKey: {
          prefix,
          dateKey
        }
      }
    });
    let nextNumber;
    if (existing) {
      nextNumber = existing.lastNumber + 1;
      if (nextNumber > MAX_SEQUENCE) {
        throw new Error(`시퀀스 한계 초과: ${prefix}-${dateKey} (max: ${MAX_SEQUENCE})`);
      }
      await tx.sequenceCounter.update({
        where: {
          prefix_dateKey: {
            prefix,
            dateKey
          }
        },
        data: {
          lastNumber: nextNumber
        }
      });
    } else {
      nextNumber = 1;
      await tx.sequenceCounter.create({
        data: {
          prefix,
          dateKey,
          lastNumber: nextNumber
        }
      });
    }
    return nextNumber;
  });
  return {
    prefix,
    dateKey,
    sequence: result,
    formatted: String(result).padStart(padding, "0")
  };
}
async function getNextBundleSequence(processCode, date = /* @__PURE__ */ new Date()) {
  const prefix = `${processCode.toUpperCase()}_BUNDLE`;
  return getNextSequence(prefix, date, BUNDLE_PADDING);
}
async function createLot(input) {
  const {
    processCode,
    productId,
    productCode,
    lineCode,
    plannedQty = 0,
    workerId,
    barcodeVersion = 2
  } = input;
  const sequence = await getNextSequence(processCode);
  let lotNumber;
  if (barcodeVersion === 1) {
    lotNumber = generateBarcodeV1(processCode, sequence.sequence);
  } else {
    const code = productCode || "TEMP";
    lotNumber = generateBarcodeV2(processCode, code, plannedQty, sequence.sequence);
  }
  const lot = await prisma.productionLot.create({
    data: {
      lotNumber,
      processCode: processCode.toUpperCase(),
      productId,
      lineCode,
      plannedQty,
      workerId,
      barcodeVersion,
      status: "IN_PROGRESS"
    },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
  return lot;
}
async function startProduction(lotId, lineCode, workerId) {
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: {
      lineCode,
      workerId,
      startedAt: /* @__PURE__ */ new Date(),
      status: "IN_PROGRESS"
    },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
  return lot;
}
async function completeProduction(input) {
  const { lotId, completedQty, defectQty = 0 } = input;
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: {
      completedQty,
      defectQty,
      completedAt: /* @__PURE__ */ new Date(),
      status: "COMPLETED"
    },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
  return lot;
}
async function updateLotQuantity(lotId, updates) {
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: updates,
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
  return lot;
}
async function addMaterial(input) {
  const { lotId, materialBarcode, materialId, quantity } = input;
  const lotMaterial = await prisma.lotMaterial.create({
    data: {
      productionLotId: lotId,
      materialId,
      materialLotNo: materialBarcode,
      quantity
    }
  });
  const lot = await getLotById(lotId);
  return {
    lotMaterialId: lotMaterial.id,
    lot
  };
}
async function removeMaterial(lotMaterialId) {
  await prisma.lotMaterial.delete({
    where: { id: lotMaterialId }
  });
}
async function getLotById(lotId) {
  return prisma.productionLot.findUnique({
    where: { id: lotId },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
}
async function getLotByNumber(lotNumber) {
  return prisma.productionLot.findUnique({
    where: { lotNumber },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    }
  });
}
async function getLotsByProcess(processCode, options) {
  const { status, startDate, endDate, limit = 100 } = {};
  const where = {
    processCode: processCode.toUpperCase()
  };
  if (status) {
    where.status = status;
  }
  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) where.startedAt.gte = startDate;
    if (endDate) where.startedAt.lte = endDate;
  }
  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    },
    orderBy: { startedAt: "desc" },
    take: limit
  });
}
async function getLotsByStatus(status, options) {
  const { processCode, limit = 100 } = {};
  const where = { status };
  if (processCode) {
    where.processCode = processCode.toUpperCase();
  }
  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true }
      },
      worker: {
        select: { id: true, name: true }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    },
    orderBy: { startedAt: "desc" },
    take: limit
  });
}
async function createBOMItem(input) {
  if (input.itemType === "MATERIAL" && !input.materialId) {
    throw new Error("자재 BOM은 materialId가 필요합니다.");
  }
  if (input.itemType === "PRODUCT" && !input.childProductId) {
    throw new Error("반제품 BOM은 childProductId가 필요합니다.");
  }
  return prisma.bOM.create({
    data: {
      productId: input.productId,
      itemType: input.itemType,
      materialId: input.materialId,
      childProductId: input.childProductId,
      quantity: input.quantity,
      unit: input.unit,
      processCode: input.processCode
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true }
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true }
      }
    }
  });
}
async function updateBOMItem(id, input) {
  return prisma.bOM.update({
    where: { id },
    data: input,
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true }
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true }
      }
    }
  });
}
async function deleteBOMItem(id) {
  await prisma.bOM.delete({
    where: { id }
  });
}
async function getBOMByProduct(productId) {
  const items = await prisma.bOM.findMany({
    where: { productId },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true }
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true }
      }
    },
    orderBy: [
      { itemType: "asc" },
      { id: "asc" }
    ]
  });
  return items.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    processCode: item.processCode,
    material: item.material || void 0,
    childProduct: item.childProduct || void 0
  }));
}
async function getBOMRequirements(productId, processCode) {
  const where = {
    productId,
    itemType: "MATERIAL",
    materialId: { not: null }
  };
  if (processCode) {
    where.processCode = processCode.toUpperCase();
  }
  const items = await prisma.bOM.findMany({
    where,
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true }
      }
    }
  });
  return items.filter((item) => item.material !== null).map((item) => ({
    materialId: item.material.id,
    materialCode: item.material.code,
    materialName: item.material.name,
    unit: item.material.unit,
    quantityPerUnit: item.quantity,
    processCode: item.processCode
  }));
}
async function calculateRequiredMaterials(productId, processCode, productionQty) {
  const requirements = await getBOMRequirements(productId, processCode);
  return requirements.map((req) => ({
    ...req,
    requiredQty: req.quantityPerUnit * productionQty
  }));
}
async function receiveStock(input) {
  try {
    const stock = await prisma.materialStock.create({
      data: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        usedQty: 0,
        location: input.location,
        receivedAt: /* @__PURE__ */ new Date()
      },
      include: {
        material: {
          select: { code: true, name: true }
        }
      }
    });
    return {
      success: true,
      stock: {
        id: stock.id,
        materialId: stock.materialId,
        materialCode: stock.material.code,
        materialName: stock.material.name,
        lotNumber: stock.lotNumber,
        quantity: stock.quantity,
        usedQty: stock.usedQty,
        availableQty: stock.quantity - stock.usedQty,
        location: stock.location,
        receivedAt: stock.receivedAt
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "입고 처리 실패"
    };
  }
}
async function consumeStock(input) {
  const { materialId, lotNumber, quantity, productionLotId } = input;
  const stock = await prisma.materialStock.findFirst({
    where: {
      materialId,
      lotNumber
    }
  });
  if (!stock) {
    throw new Error(`재고를 찾을 수 없습니다: ${lotNumber}`);
  }
  const availableQty = stock.quantity - stock.usedQty;
  if (availableQty < quantity) {
    throw new Error(`재고 부족: 가용 ${availableQty}, 요청 ${quantity}`);
  }
  await prisma.materialStock.update({
    where: { id: stock.id },
    data: {
      usedQty: stock.usedQty + quantity
    }
  });
  if (productionLotId) {
    await prisma.lotMaterial.create({
      data: {
        productionLotId,
        materialId,
        materialLotNo: lotNumber,
        quantity
      }
    });
  }
}
async function getStockByMaterial(materialId) {
  const stocks = await prisma.materialStock.findMany({
    where: { materialId },
    include: {
      material: {
        select: { code: true, name: true }
      }
    },
    orderBy: { receivedAt: "asc" }
  });
  return stocks.map((s) => ({
    id: s.id,
    materialId: s.materialId,
    materialCode: s.material.code,
    materialName: s.material.name,
    lotNumber: s.lotNumber,
    quantity: s.quantity,
    usedQty: s.usedQty,
    availableQty: s.quantity - s.usedQty,
    location: s.location,
    receivedAt: s.receivedAt
  }));
}
async function getStockSummary() {
  const materials = await prisma.material.findMany({
    where: { isActive: true },
    include: {
      stocks: {
        select: {
          quantity: true,
          usedQty: true
        }
      }
    },
    orderBy: { code: "asc" }
  });
  return materials.map((mat) => {
    const totalStock = mat.stocks.reduce((sum, s) => sum + s.quantity, 0);
    const usedStock = mat.stocks.reduce((sum, s) => sum + s.usedQty, 0);
    const availableStock = totalStock - usedStock;
    let status = "good";
    if (availableStock === 0) {
      status = "exhausted";
    } else if (availableStock < mat.safeStock * 0.3) {
      status = "danger";
    } else if (availableStock < mat.safeStock) {
      status = "warning";
    }
    return {
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      unit: mat.unit,
      safeStock: mat.safeStock,
      totalStock,
      availableStock,
      lotCount: mat.stocks.length,
      status
    };
  });
}
async function getLowStock() {
  const summary = await getStockSummary();
  return summary.filter(
    (s) => s.status === "warning" || s.status === "danger" || s.status === "exhausted"
  );
}
async function getAvailableQty(materialId) {
  const result = await prisma.materialStock.aggregate({
    where: { materialId },
    _sum: {
      quantity: true,
      usedQty: true
    }
  });
  const total = result._sum.quantity || 0;
  const used = result._sum.usedQty || 0;
  return total - used;
}
async function getTodayReceivings() {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const receivings = await prisma.materialStock.findMany({
    where: {
      receivedAt: { gte: today }
    },
    include: {
      material: {
        select: {
          code: true,
          name: true,
          unit: true
        }
      }
    },
    orderBy: { receivedAt: "desc" }
  });
  return receivings;
}
async function consumeStockFIFOWithNegative(materialId, quantity, productionLotId, allowNegative = true) {
  const stocks = await prisma.materialStock.findMany({
    where: { materialId },
    orderBy: { receivedAt: "asc" }
  });
  let remainingQty = quantity;
  const usedLots = [];
  let totalDeducted = 0;
  for (const stock of stocks) {
    if (remainingQty <= 0) break;
    const availableQty = stock.quantity - stock.usedQty;
    if (availableQty <= 0) continue;
    const useQty = Math.min(availableQty, remainingQty);
    await prisma.materialStock.update({
      where: { id: stock.id },
      data: { usedQty: stock.usedQty + useQty }
    });
    if (productionLotId) {
      await prisma.lotMaterial.create({
        data: {
          productionLotId,
          materialId,
          materialLotNo: stock.lotNumber,
          quantity: useQty
        }
      });
    }
    usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty });
    totalDeducted += useQty;
    remainingQty -= useQty;
  }
  if (remainingQty > 0 && allowNegative) {
    const targetStock = stocks.length > 0 ? stocks[stocks.length - 1] : null;
    if (targetStock) {
      await prisma.materialStock.update({
        where: { id: targetStock.id },
        data: { usedQty: targetStock.usedQty + remainingQty }
      });
      if (productionLotId) {
        await prisma.lotMaterial.create({
          data: {
            productionLotId,
            materialId,
            materialLotNo: targetStock.lotNumber,
            quantity: remainingQty
          }
        });
      }
      const existingLot = usedLots.find((l) => l.lotNumber === targetStock.lotNumber);
      if (existingLot) {
        existingLot.usedQty += remainingQty;
      } else {
        usedLots.push({ lotNumber: targetStock.lotNumber, usedQty: remainingQty });
      }
      totalDeducted += remainingQty;
      remainingQty = 0;
    }
  }
  return {
    lots: usedLots,
    deductedQty: totalDeducted,
    remainingQty
  };
}
async function deductByBOM(productId, processCode, productionQty, inputMaterials = [], allowNegative = true, productionLotId) {
  const requirements = await calculateRequiredMaterials(productId, processCode, productionQty);
  const result = {
    success: true,
    productId,
    processCode,
    productionQty,
    allowNegative,
    items: [],
    totalRequired: 0,
    totalDeducted: 0,
    errors: []
  };
  if (requirements.length === 0) {
    return result;
  }
  const inputMap = /* @__PURE__ */ new Map();
  for (const input of inputMaterials) {
    const existing = inputMap.get(input.materialId) || [];
    existing.push(input);
    inputMap.set(input.materialId, existing);
  }
  for (const req of requirements) {
    result.totalRequired += req.requiredQty;
    const item = {
      materialId: req.materialId,
      materialCode: req.materialCode,
      materialName: req.materialName,
      requiredQty: req.requiredQty,
      deductedQty: 0,
      remainingQty: req.requiredQty,
      lots: [],
      success: false,
      allowedNegative: false
    };
    try {
      const scannedInputs = inputMap.get(req.materialId);
      if (scannedInputs && scannedInputs.length > 0) {
        let remaining = req.requiredQty;
        for (const input of scannedInputs) {
          if (remaining <= 0) break;
          if (input.lotNumber) {
            const stock = await prisma.materialStock.findFirst({
              where: {
                materialId: req.materialId,
                lotNumber: input.lotNumber
              }
            });
            if (stock) {
              const availableQty = stock.quantity - stock.usedQty;
              const useQty = input.quantity ? Math.min(input.quantity, remaining) : Math.min(availableQty > 0 ? availableQty : remaining, remaining);
              if (useQty > availableQty && !allowNegative) {
                item.error = `재고 부족: ${input.lotNumber} (가용: ${availableQty}, 필요: ${useQty})`;
                continue;
              }
              await prisma.materialStock.update({
                where: { id: stock.id },
                data: { usedQty: stock.usedQty + useQty }
              });
              if (productionLotId) {
                await prisma.lotMaterial.create({
                  data: {
                    productionLotId,
                    materialId: req.materialId,
                    materialLotNo: input.lotNumber,
                    quantity: useQty
                  }
                });
              }
              item.lots.push({ lotNumber: input.lotNumber, usedQty: useQty });
              item.deductedQty += useQty;
              remaining -= useQty;
              if (useQty > availableQty) {
                item.allowedNegative = true;
              }
            }
          }
        }
        if (remaining > 0) {
          const fifoResult = await consumeStockFIFOWithNegative(
            req.materialId,
            remaining,
            productionLotId,
            allowNegative
          );
          item.lots.push(...fifoResult.lots);
          item.deductedQty += fifoResult.deductedQty;
          remaining = fifoResult.remainingQty;
          if (fifoResult.remainingQty === 0 && fifoResult.deductedQty < remaining) {
            item.allowedNegative = true;
          }
        }
        item.remainingQty = remaining;
        item.success = remaining === 0;
      } else {
        const fifoResult = await consumeStockFIFOWithNegative(
          req.materialId,
          req.requiredQty,
          productionLotId,
          allowNegative
        );
        item.lots = fifoResult.lots;
        item.deductedQty = fifoResult.deductedQty;
        item.remainingQty = fifoResult.remainingQty;
        item.success = fifoResult.remainingQty === 0;
        const totalAvailable = await getAvailableQty(req.materialId);
        if (totalAvailable < 0) {
          item.allowedNegative = true;
        }
      }
      result.totalDeducted += item.deductedQty;
    } catch (error) {
      item.error = error instanceof Error ? error.message : "차감 실패";
      item.success = false;
    }
    if (!item.success && !allowNegative) {
      result.success = false;
      result.errors.push(`${req.materialCode}: ${item.error || "차감 실패"}`);
    }
    result.items.push(item);
  }
  return result;
}
async function createMaterial(input) {
  return prisma.material.create({
    data: {
      code: input.code,
      name: input.name,
      spec: input.spec,
      category: input.category,
      unit: input.unit,
      safeStock: input.safeStock || 0,
      description: input.description
    }
  });
}
async function getMaterialById(id) {
  return prisma.material.findUnique({
    where: { id },
    include: {
      stocks: true,
      _count: {
        select: {
          lotMaterials: true,
          bomItems: true
        }
      }
    }
  });
}
async function updateMaterial(id, input) {
  return prisma.material.update({
    where: { id },
    data: input
  });
}
async function deleteMaterial(id) {
  await prisma.material.update({
    where: { id },
    data: { isActive: false }
  });
}
async function getAllMaterials(options) {
  const { category, isActive = true, search } = {};
  const where = {};
  if (isActive !== void 0) {
    where.isActive = isActive;
  }
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } }
    ];
  }
  return prisma.material.findMany({
    where,
    include: {
      _count: {
        select: {
          stocks: true,
          lotMaterials: true
        }
      }
    },
    orderBy: { code: "asc" }
  });
}
async function traceForward(materialLotNo, maxDepth = 10) {
  const directLots = await prisma.lotMaterial.findMany({
    where: { materialLotNo },
    include: {
      productionLot: {
        include: {
          product: true,
          childLots: {
            include: {
              product: true
            }
          }
        }
      },
      material: true
    }
  });
  if (directLots.length === 0) {
    const material = await prisma.material.findFirst({
      where: {
        OR: [
          { code: materialLotNo },
          { stocks: { some: { lotNumber: materialLotNo } } }
        ]
      }
    });
    const rootNode2 = {
      id: 0,
      lotNumber: materialLotNo,
      processCode: "MATERIAL",
      type: "MATERIAL_LOT",
      materialCode: material?.code,
      materialName: material?.name,
      quantity: 0,
      status: "NOT_FOUND",
      date: /* @__PURE__ */ new Date(),
      depth: 0,
      children: []
    };
    return {
      rootNode: rootNode2,
      totalNodes: 1,
      maxDepth: 0,
      direction: "FORWARD",
      tracedAt: /* @__PURE__ */ new Date()
    };
  }
  const firstLot = directLots[0];
  const rootNode = {
    id: 0,
    lotNumber: materialLotNo,
    processCode: "MATERIAL",
    type: "MATERIAL_LOT",
    materialCode: firstLot.material.code,
    materialName: firstLot.material.name,
    quantity: directLots.reduce((sum, l) => sum + l.quantity, 0),
    status: "TRACED",
    date: firstLot.createdAt,
    depth: 0,
    children: []
  };
  let nodeCount = 1;
  let actualMaxDepth = 0;
  for (const lotMaterial of directLots) {
    const prodLot = lotMaterial.productionLot;
    const childNode = await buildForwardTree(prodLot, 1, maxDepth);
    rootNode.children.push(childNode.node);
    nodeCount += childNode.count;
    actualMaxDepth = Math.max(actualMaxDepth, childNode.depth);
  }
  return {
    rootNode,
    totalNodes: nodeCount,
    maxDepth: actualMaxDepth,
    direction: "FORWARD",
    tracedAt: /* @__PURE__ */ new Date()
  };
}
async function buildForwardTree(lot, currentDepth, maxDepth) {
  const node = {
    id: lot.id,
    lotNumber: lot.lotNumber,
    processCode: lot.processCode,
    type: "PRODUCTION_LOT",
    productCode: lot.product?.code,
    productName: lot.product?.name,
    quantity: lot.completedQty,
    status: lot.status,
    date: lot.startedAt,
    depth: currentDepth,
    children: []
  };
  let count = 1;
  let depth = currentDepth;
  if (currentDepth >= maxDepth) {
    return { node, count, depth };
  }
  const childLots = await prisma.productionLot.findMany({
    where: { parentLotId: lot.id },
    include: {
      product: true,
      childLots: true
    }
  });
  for (const childLot of childLots) {
    const result = await buildForwardTree(
      childLot,
      currentDepth + 1,
      maxDepth
    );
    node.children.push(result.node);
    count += result.count;
    depth = Math.max(depth, result.depth);
  }
  return { node, count, depth };
}
async function traceBackward(lotNumber, maxDepth = 10) {
  const productionLot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    include: {
      product: true,
      lotMaterials: {
        include: { material: true }
      },
      parentLot: {
        include: {
          product: true,
          lotMaterials: {
            include: { material: true }
          }
        }
      }
    }
  });
  if (!productionLot) {
    const rootNode2 = {
      id: 0,
      lotNumber,
      processCode: "UNKNOWN",
      type: "PRODUCTION_LOT",
      quantity: 0,
      status: "NOT_FOUND",
      date: /* @__PURE__ */ new Date(),
      depth: 0,
      children: []
    };
    return {
      rootNode: rootNode2,
      totalNodes: 1,
      maxDepth: 0,
      direction: "BACKWARD",
      tracedAt: /* @__PURE__ */ new Date()
    };
  }
  const rootNode = {
    id: productionLot.id,
    lotNumber: productionLot.lotNumber,
    processCode: productionLot.processCode,
    type: "PRODUCTION_LOT",
    productCode: productionLot.product?.code,
    productName: productionLot.product?.name,
    quantity: productionLot.completedQty,
    status: productionLot.status,
    date: productionLot.startedAt,
    depth: 0,
    children: []
  };
  const result = await buildBackwardTree(
    productionLot,
    rootNode,
    1,
    maxDepth
  );
  return {
    rootNode,
    totalNodes: result.count + 1,
    maxDepth: result.depth,
    direction: "BACKWARD",
    tracedAt: /* @__PURE__ */ new Date()
  };
}
async function buildBackwardTree(lot, node, currentDepth, maxDepth) {
  let count = 0;
  let depth = currentDepth;
  if (currentDepth > maxDepth) {
    return { count, depth: currentDepth - 1 };
  }
  for (const lotMaterial of lot.lotMaterials) {
    const materialNode = {
      id: lotMaterial.id,
      lotNumber: lotMaterial.materialLotNo,
      processCode: "MATERIAL",
      type: "MATERIAL_LOT",
      materialCode: lotMaterial.material.code,
      materialName: lotMaterial.material.name,
      quantity: lotMaterial.quantity,
      status: "USED",
      date: lotMaterial.createdAt,
      depth: currentDepth,
      children: []
    };
    node.children.push(materialNode);
    count++;
  }
  if (lot.parentLotId) {
    const parentLot = await prisma.productionLot.findUnique({
      where: { id: lot.parentLotId },
      include: {
        product: true,
        lotMaterials: {
          include: { material: true }
        }
      }
    });
    if (parentLot) {
      const parentNode = {
        id: parentLot.id,
        lotNumber: parentLot.lotNumber,
        processCode: parentLot.processCode,
        type: "PRODUCTION_LOT",
        productCode: parentLot.product?.code,
        productName: parentLot.product?.name,
        quantity: parentLot.completedQty,
        status: parentLot.status,
        date: parentLot.startedAt,
        depth: currentDepth,
        children: []
      };
      node.children.push(parentNode);
      count++;
      const result = await buildBackwardTree(
        parentLot,
        parentNode,
        currentDepth + 1,
        maxDepth
      );
      count += result.count;
      depth = Math.max(depth, result.depth);
    }
  }
  return { count, depth };
}
async function buildTraceTree(lotNumber, direction, maxDepth = 10) {
  if (direction === "BOTH") {
    const [forward, backward] = await Promise.all([
      traceForward(lotNumber, maxDepth),
      traceBackward(lotNumber, maxDepth)
    ]);
    return { forward, backward };
  }
  if (direction === "FORWARD") {
    return traceForward(lotNumber, maxDepth);
  }
  return traceBackward(lotNumber, maxDepth);
}
async function createInspection(input) {
  const { lotId, type, result, defectReason, defectQty = 0, inspectorId } = input;
  const inspection = await prisma.inspection.create({
    data: {
      productionLotId: lotId,
      type,
      result,
      defectReason,
      defectQty,
      inspectorId,
      inspectedAt: /* @__PURE__ */ new Date()
    },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true }
          }
        }
      },
      inspector: {
        select: { id: true, name: true }
      }
    }
  });
  if (result === "FAIL" && defectQty > 0) {
    await prisma.productionLot.update({
      where: { id: lotId },
      data: {
        defectQty: {
          increment: defectQty
        }
      }
    });
  }
  return inspection;
}
async function getInspectionsByLot(lotId) {
  return prisma.inspection.findMany({
    where: { productionLotId: lotId },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true }
          }
        }
      },
      inspector: {
        select: { id: true, name: true }
      }
    },
    orderBy: { inspectedAt: "desc" }
  });
}
async function getAllLines(options) {
  const { processCode, isActive = true } = options || {};
  const where = {};
  if (isActive !== void 0) {
    where.isActive = isActive;
  }
  if (processCode) {
    where.processCode = processCode.toUpperCase();
  }
  return prisma.line.findMany({
    where,
    orderBy: [
      { processCode: "asc" },
      { code: "asc" }
    ]
  });
}
async function getLinesByProcess(processCode) {
  return getAllLines({ processCode });
}
async function createBundle(input) {
  const { processCode, productId, productCode, setQuantity } = input;
  const sequence = await getNextBundleSequence(processCode);
  const bundleNo = generateBundleBarcode(productCode, setQuantity, sequence.sequence);
  const bundleLot = await prisma.bundleLot.create({
    data: {
      bundleNo,
      productId,
      setQuantity,
      totalQty: 0,
      status: "CREATED"
    },
    include: {
      product: {
        select: { code: true, name: true }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true }
          }
        }
      }
    }
  });
  return {
    id: bundleLot.id,
    bundleNo: bundleLot.bundleNo,
    productId: bundleLot.productId,
    productCode: bundleLot.product.code,
    productName: bundleLot.product.name,
    bundleType: bundleLot.bundleType,
    setQuantity: bundleLot.setQuantity,
    totalQty: bundleLot.totalQty,
    status: bundleLot.status,
    items: [],
    createdAt: bundleLot.createdAt
  };
}
async function addToBundle(input) {
  const { bundleLotId, productionLotId, quantity } = input;
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId }
  });
  if (!bundle) {
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  }
  if (bundle.status !== "CREATED") {
    throw new Error("이미 완료된 번들에는 추가할 수 없습니다.");
  }
  await prisma.bundleItem.create({
    data: {
      bundleLotId,
      productionLotId,
      quantity
    }
  });
  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: {
      totalQty: { increment: quantity }
    }
  });
  return getBundleById(bundleLotId);
}
async function removeFromBundle(bundleItemId) {
  const item = await prisma.bundleItem.findUnique({
    where: { id: bundleItemId },
    include: { bundleLot: true }
  });
  if (!item) {
    throw new Error("번들 아이템을 찾을 수 없습니다.");
  }
  if (item.bundleLot.status !== "CREATED") {
    throw new Error("이미 완료된 번들에서는 제거할 수 없습니다.");
  }
  await prisma.bundleItem.delete({
    where: { id: bundleItemId }
  });
  await prisma.bundleLot.update({
    where: { id: item.bundleLotId },
    data: {
      totalQty: { decrement: item.quantity }
    }
  });
  return getBundleById(item.bundleLotId);
}
async function completeBundle(bundleLotId) {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
    include: { items: true }
  });
  if (!bundle) {
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  }
  if (bundle.items.length === 0) {
    throw new Error("번들에 추가된 LOT가 없습니다.");
  }
  if (bundle.items.length !== bundle.setQuantity) {
    throw new Error(`번들 수량이 일치하지 않습니다. (예상: ${bundle.setQuantity}, 실제: ${bundle.items.length})`);
  }
  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: { status: "SHIPPED" }
  });
  return getBundleById(bundleLotId);
}
async function unbundle(bundleLotId) {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId }
  });
  if (!bundle) {
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  }
  await prisma.bundleItem.deleteMany({
    where: { bundleLotId }
  });
  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: {
      status: "UNBUNDLED",
      totalQty: 0
    }
  });
}
async function deleteBundle(bundleLotId) {
  await prisma.bundleLot.delete({
    where: { id: bundleLotId }
  });
}
async function getBundleById(bundleLotId) {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
    include: {
      product: {
        select: { code: true, name: true }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!bundle) return null;
  return {
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt
    })),
    createdAt: bundle.createdAt
  };
}
async function getBundleByNo(bundleNo) {
  const bundle = await prisma.bundleLot.findUnique({
    where: { bundleNo }
  });
  if (!bundle) return null;
  return getBundleById(bundle.id);
}
async function getActiveBundles() {
  const bundles = await prisma.bundleLot.findMany({
    where: { status: "CREATED" },
    include: {
      product: {
        select: { code: true, name: true }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return bundles.map((bundle) => ({
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt
    })),
    createdAt: bundle.createdAt
  }));
}
async function getAvailableLotsForBundle(productId) {
  const bundledLotIds = await prisma.bundleItem.findMany({
    select: { productionLotId: true }
  });
  const excludeIds = bundledLotIds.map((b) => b.productionLotId);
  const lots = await prisma.productionLot.findMany({
    where: {
      productId,
      processCode: "CA",
      status: "COMPLETED",
      id: { notIn: excludeIds }
    },
    select: {
      id: true,
      lotNumber: true,
      processCode: true,
      completedQty: true,
      completedAt: true
    },
    orderBy: { completedAt: "desc" },
    take: 50
  });
  return lots;
}
async function shipEntireBundle(bundleId) {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true }
          }
        }
      }
    }
  });
  if (!bundle) {
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  }
  if (bundle.items.length === 0) {
    throw new Error("번들에 출하할 아이템이 없습니다.");
  }
  if (bundle.status === "SHIPPED") {
    throw new Error("이미 출하 완료된 번들입니다.");
  }
  await prisma.bundleLot.update({
    where: { id: bundleId },
    data: { status: "SHIPPED" }
  });
  const shippedLotNumbers = bundle.items.map((i) => i.productionLot.lotNumber);
  const shippedItemIds = bundle.items.map((i) => i.id);
  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds,
    shippedLotNumbers,
    newBundleStatus: "SHIPPED",
    message: `번들 전체 출하 완료 (${shippedLotNumbers.length}개 아이템)`
  };
}
async function createSetBundle(items) {
  if (items.length === 0) {
    throw new Error("번들에 추가할 아이템이 없습니다.");
  }
  const lotIds = items.map((i) => i.lotId);
  const lots = await prisma.productionLot.findMany({
    where: { id: { in: lotIds } },
    include: {
      product: {
        select: { id: true, code: true, name: true }
      }
    }
  });
  if (lots.length !== items.length) {
    throw new Error("일부 LOT를 찾을 수 없습니다.");
  }
  const uniqueProductIds = new Set(lots.map((lot) => lot.productId));
  const bundleType = uniqueProductIds.size === 1 ? "SAME_PRODUCT" : "MULTI_PRODUCT";
  const firstLot = lots[0];
  const processCode = firstLot.processCode;
  const productCode = firstLot.product.code;
  const sequence = await getNextBundleSequence(processCode);
  const setQuantity = items.length;
  const bundleNo = generateBundleBarcode(
    bundleType === "MULTI_PRODUCT" ? "SET" : productCode,
    setQuantity,
    sequence.sequence
  );
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const bundle = await prisma.bundleLot.create({
    data: {
      bundleNo,
      productId: firstLot.productId,
      bundleType,
      setQuantity,
      totalQty,
      status: "CREATED"
    }
  });
  for (const item of items) {
    await prisma.bundleItem.create({
      data: {
        bundleLotId: bundle.id,
        productionLotId: item.lotId,
        quantity: item.quantity
      }
    });
  }
  return getBundleById(bundle.id);
}
async function createProduct(input) {
  return prisma.product.create({
    data: {
      code: input.code,
      name: input.name,
      spec: input.spec,
      type: input.type || "FINISHED",
      processCode: input.processCode,
      crimpCode: input.crimpCode,
      description: input.description
    }
  });
}
async function getProductById(id) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          boms: true,
          productionLots: true
        }
      }
    }
  });
}
async function updateProduct(id, input) {
  return prisma.product.update({
    where: { id },
    data: input
  });
}
async function deleteProduct(id) {
  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
}
async function getAllProducts(options) {
  const { type, isActive = true, search } = {};
  const where = {};
  if (isActive !== void 0) {
    where.isActive = isActive;
  }
  if (type) {
    where.type = type;
  }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } }
    ];
  }
  return prisma.product.findMany({
    where,
    include: {
      _count: {
        select: {
          boms: true,
          productionLots: true
        }
      }
    },
    orderBy: { code: "asc" }
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname$1, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const isDev = !app.isPackaged;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("get-printers", async () => {
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault
    }));
  } catch (error) {
    console.error("프린터 목록 조회 오류:", error);
    return [];
  }
});
ipcMain.handle("print-pdf", async (_event, options) => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    const printOptions = {
      silent: options.silent ?? true,
      deviceName: options.printerName,
      copies: options.copies ?? 1
    };
    const success = await win.webContents.print(printOptions);
    return { success };
  } catch (error) {
    console.error("PDF 인쇄 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("print-to-pdf", async () => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: "output.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (!filePath) {
      return { success: false, error: "Cancelled" };
    }
    const data = await win.webContents.printToPDF({});
    writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error) {
    console.error("PDF 저장 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("print-label", async (_event, options) => {
  if (!win) return { success: false, error: "Window not found" };
  try {
    if (options.zplData) {
      console.log("ZPL 라벨 인쇄 요청:", options.printerName);
      return { success: true, message: "ZPL 인쇄 대기중 (구현 예정)" };
    }
    if (options.pdfBase64) {
      const printOptions = {
        silent: true,
        deviceName: options.printerName,
        copies: 1
      };
      await win.webContents.print(printOptions);
      return { success: true };
    }
    return { success: false, error: "No print data provided" };
  } catch (error) {
    console.error("라벨 인쇄 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("save-file-dialog", async (_event, options) => {
  if (!win) return null;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: options.defaultPath,
    filters: options.filters
  });
  return result.filePath || null;
});
ipcMain.handle("open-file-dialog", async (_event, options) => {
  if (!win) return [];
  const result = await dialog.showOpenDialog(win, {
    filters: options.filters,
    properties: options.multiple ? ["openFile", "multiSelections"] : ["openFile"]
  });
  return result.filePaths;
});
ipcMain.handle("write-file", async (_event, options) => {
  try {
    writeFileSync(options.filePath, options.data);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const data = readFileSync(filePath);
    return { success: true, data: data.toString("base64") };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:createLot", async (_event, input) => {
  try {
    const result = await createLot(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:createLot 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:startProduction", async (_event, lotId) => {
  try {
    const result = await startProduction(lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:startProduction 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:completeProduction", async (_event, lotId, quantity) => {
  try {
    const result = await completeProduction(lotId, quantity);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:completeProduction 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:addMaterial", async (_event, lotId, materialId, quantity, lotNumber) => {
  try {
    const result = await addMaterial(lotId, materialId, quantity, lotNumber);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:addMaterial 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:removeMaterial", async (_event, lotMaterialId) => {
  try {
    const result = await removeMaterial(lotMaterialId);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:removeMaterial 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:getLotById", async (_event, lotId) => {
  try {
    const result = await getLotById(lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:getLotById 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:getLotByNumber", async (_event, lotNumber) => {
  try {
    const result = await getLotByNumber(lotNumber);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:getLotByNumber 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:getLotsByProcess", async (_event, processCode) => {
  try {
    const result = await getLotsByProcess(processCode);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:getLotsByProcess 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:getLotsByStatus", async (_event, status) => {
  try {
    const result = await getLotsByStatus(status);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:getLotsByStatus 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("production:updateLotQuantity", async (_event, lotId, quantity) => {
  try {
    const result = await updateLotQuantity(lotId, quantity);
    return { success: true, data: result };
  } catch (error) {
    console.error("production:updateLotQuantity 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:receiveStock", async (_event, input) => {
  try {
    const result = await receiveStock(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:receiveStock 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:consumeStock", async (_event, stockId, quantity, lotId) => {
  try {
    const result = await consumeStock(stockId, quantity, lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:consumeStock 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:deductByBOM", async (_event, productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId) => {
  try {
    const result = await deductByBOM(productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:deductByBOM 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getStockByMaterial", async (_event, materialId) => {
  try {
    const result = await getStockByMaterial(materialId);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getStockByMaterial 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getStockSummary", async () => {
  try {
    const result = await getStockSummary();
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getStockSummary 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getLowStock", async () => {
  try {
    const result = await getLowStock();
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getLowStock 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getAvailableQty", async (_event, materialId) => {
  try {
    const result = await getAvailableQty(materialId);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getAvailableQty 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getTodayReceivings", async () => {
  try {
    const result = await getTodayReceivings();
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getTodayReceivings 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getAllStocks", async (_event, options) => {
  try {
    const materials = await Promise.resolve().then(() => prisma$1).then((m) => m.prisma.material.findMany({
      where: options?.materialCode ? { code: { contains: options.materialCode } } : void 0,
      include: {
        stocks: {
          orderBy: { receivedAt: "asc" }
        }
      }
    }));
    const allStocks = [];
    for (const mat of materials) {
      for (const stock of mat.stocks) {
        const availableQty = stock.quantity - stock.usedQty;
        if (!options?.showZero && availableQty <= 0) continue;
        allStocks.push({
          id: stock.id,
          materialId: stock.materialId,
          materialCode: mat.code,
          materialName: mat.name,
          lotNumber: stock.lotNumber,
          quantity: stock.quantity,
          usedQty: stock.usedQty,
          availableQty,
          processCode: stock.location || void 0,
          // location을 processCode로 활용
          location: stock.location,
          receivedAt: stock.receivedAt
        });
      }
    }
    return { success: true, data: allStocks };
  } catch (error) {
    console.error("stock:getAllStocks 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:registerProcessStock", async (_event, input) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const existing = await prisma2.materialStock.findFirst({
      where: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        location: input.processCode
        // processCode를 location에 저장
      }
    });
    if (existing) {
      const updated = await prisma2.materialStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + input.quantity }
      });
      return {
        success: true,
        data: {
          id: updated.id,
          isNewEntry: false,
          stock: {
            id: updated.id,
            materialId: updated.materialId,
            lotNumber: updated.lotNumber,
            quantity: updated.quantity,
            usedQty: updated.usedQty,
            availableQty: updated.quantity - updated.usedQty,
            processCode: updated.location
          }
        }
      };
    }
    const stock = await prisma2.materialStock.create({
      data: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        usedQty: 0,
        location: input.processCode,
        // processCode를 location에 저장
        receivedAt: /* @__PURE__ */ new Date()
      }
    });
    return {
      success: true,
      data: {
        id: stock.id,
        isNewEntry: true,
        stock: {
          id: stock.id,
          materialId: stock.materialId,
          lotNumber: stock.lotNumber,
          quantity: stock.quantity,
          usedQty: stock.usedQty,
          availableQty: stock.quantity - stock.usedQty,
          processCode: stock.location
        }
      }
    };
  } catch (error) {
    console.error("stock:registerProcessStock 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getStocksByProcess", async (_event, processCode, options) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const stocks = await prisma2.materialStock.findMany({
      where: {
        location: processCode,
        ...options?.materialCode ? {
          material: { code: { contains: options.materialCode } }
        } : {}
      },
      include: {
        material: { select: { code: true, name: true } }
      },
      orderBy: { receivedAt: "asc" }
    });
    const result = stocks.map((s) => ({
      id: s.id,
      materialId: s.materialId,
      materialCode: s.material.code,
      materialName: s.material.name,
      lotNumber: s.lotNumber,
      quantity: s.quantity,
      usedQty: s.usedQty,
      availableQty: s.quantity - s.usedQty,
      processCode: s.location,
      location: s.location,
      receivedAt: s.receivedAt
    })).filter((s) => options?.showZero || s.availableQty > 0);
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getStocksByProcess 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:checkProcessStockStatus", async (_event, processCode, lotNumber) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const stock = await prisma2.materialStock.findFirst({
      where: {
        location: processCode,
        lotNumber
      }
    });
    if (!stock) {
      return {
        success: true,
        data: {
          exists: false,
          lotNumber,
          processCode,
          quantity: 0,
          usedQty: 0,
          availableQty: 0,
          isExhausted: false,
          canRegister: true
        }
      };
    }
    const availableQty = stock.quantity - stock.usedQty;
    const isExhausted = availableQty <= 0;
    return {
      success: true,
      data: {
        exists: true,
        lotNumber,
        processCode,
        quantity: stock.quantity,
        usedQty: stock.usedQty,
        availableQty,
        isExhausted,
        canRegister: !isExhausted
      }
    };
  } catch (error) {
    console.error("stock:checkProcessStockStatus 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:consumeProcessStock", async (_event, processCode, materialId, quantity, productionLotId, allowNegative) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const stocks = await prisma2.materialStock.findMany({
      where: {
        materialId,
        location: processCode
      },
      orderBy: { receivedAt: "asc" }
    });
    let remainingQty = quantity;
    const usedLots = [];
    let totalDeducted = 0;
    for (const stock of stocks) {
      if (remainingQty <= 0) break;
      const availableQty = stock.quantity - stock.usedQty;
      if (availableQty <= 0) continue;
      const useQty = Math.min(availableQty, remainingQty);
      await prisma2.materialStock.update({
        where: { id: stock.id },
        data: { usedQty: stock.usedQty + useQty }
      });
      if (productionLotId) {
        await prisma2.lotMaterial.create({
          data: {
            productionLotId,
            materialId,
            materialLotNo: stock.lotNumber,
            quantity: useQty
          }
        });
      }
      usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty });
      totalDeducted += useQty;
      remainingQty -= useQty;
    }
    if (remainingQty > 0 && allowNegative && stocks.length > 0) {
      const lastStock = stocks[stocks.length - 1];
      await prisma2.materialStock.update({
        where: { id: lastStock.id },
        data: { usedQty: lastStock.usedQty + remainingQty }
      });
      const existingLot = usedLots.find((l) => l.lotNumber === lastStock.lotNumber);
      if (existingLot) {
        existingLot.usedQty += remainingQty;
      } else {
        usedLots.push({ lotNumber: lastStock.lotNumber, usedQty: remainingQty });
      }
      totalDeducted += remainingQty;
      remainingQty = 0;
    }
    return {
      success: true,
      data: {
        lots: usedLots,
        deductedQty: totalDeducted,
        remainingQty
      }
    };
  } catch (error) {
    console.error("stock:consumeProcessStock 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getProcessStockSummary", async (_event, processCode) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const stocks = await prisma2.materialStock.findMany({
      where: { location: processCode }
    });
    const materialIds = new Set(stocks.map((s) => s.materialId));
    const summary = {
      totalLots: stocks.length,
      totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
      totalUsed: stocks.reduce((sum, s) => sum + s.usedQty, 0),
      totalAvailable: stocks.reduce((sum, s) => sum + (s.quantity - s.usedQty), 0),
      materialCount: materialIds.size
    };
    return { success: true, data: summary };
  } catch (error) {
    console.error("stock:getProcessStockSummary 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getProcessAvailableQty", async (_event, processCode, materialId) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const result = await prisma2.materialStock.aggregate({
      where: {
        materialId,
        location: processCode
      },
      _sum: {
        quantity: true,
        usedQty: true
      }
    });
    const total = result._sum.quantity || 0;
    const used = result._sum.usedQty || 0;
    return { success: true, data: total - used };
  } catch (error) {
    console.error("stock:getProcessAvailableQty 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:getTodayProcessReceivings", async (_event, processCode) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const receivings = await prisma2.materialStock.findMany({
      where: {
        receivedAt: { gte: today },
        ...processCode ? { location: processCode } : {}
      },
      include: {
        material: { select: { code: true, name: true } }
      },
      orderBy: { receivedAt: "desc" }
    });
    const result = receivings.map((r) => ({
      id: r.id,
      processCode: r.location || "",
      materialCode: r.material.code,
      materialName: r.material.name,
      lotNumber: r.lotNumber,
      quantity: r.quantity,
      receivedAt: r.receivedAt
    }));
    return { success: true, data: result };
  } catch (error) {
    console.error("stock:getTodayProcessReceivings 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:deleteStockItems", async (_event, ids) => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const result = await prisma2.materialStock.deleteMany({
      where: { id: { in: ids } }
    });
    return { success: true, data: result.count };
  } catch (error) {
    console.error("stock:deleteStockItems 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stock:resetAllStockData", async () => {
  try {
    const { prisma: prisma2 } = await Promise.resolve().then(() => prisma$1);
    const lotMaterialsResult = await prisma2.lotMaterial.deleteMany({});
    const stocksResult = await prisma2.materialStock.deleteMany({});
    return {
      success: true,
      data: {
        stocks: stocksResult.count,
        receivings: 0,
        lotMaterials: lotMaterialsResult.count
      }
    };
  } catch (error) {
    console.error("stock:resetAllStockData 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bom:createBOMItem", async (_event, input) => {
  try {
    const result = await createBOMItem(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("bom:createBOMItem 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bom:updateBOMItem", async (_event, bomId, input) => {
  try {
    const result = await updateBOMItem(bomId, input);
    return { success: true, data: result };
  } catch (error) {
    console.error("bom:updateBOMItem 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bom:deleteBOMItem", async (_event, bomId) => {
  try {
    const result = await deleteBOMItem(bomId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bom:deleteBOMItem 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bom:getBOMByProduct", async (_event, productId) => {
  try {
    const result = await getBOMByProduct(productId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bom:getBOMByProduct 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("material:create", async (_event, input) => {
  try {
    const result = await createMaterial(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("material:create 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("material:getById", async (_event, materialId) => {
  try {
    const result = await getMaterialById(materialId);
    return { success: true, data: result };
  } catch (error) {
    console.error("material:getById 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("material:update", async (_event, materialId, input) => {
  try {
    const result = await updateMaterial(materialId, input);
    return { success: true, data: result };
  } catch (error) {
    console.error("material:update 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("material:delete", async (_event, materialId) => {
  try {
    const result = await deleteMaterial(materialId);
    return { success: true, data: result };
  } catch (error) {
    console.error("material:delete 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("material:getAll", async () => {
  try {
    const result = await getAllMaterials();
    return { success: true, data: result };
  } catch (error) {
    console.error("material:getAll 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("lotTrace:traceForward", async (_event, lotId) => {
  try {
    const result = await traceForward(lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("lotTrace:traceForward 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("lotTrace:traceBackward", async (_event, lotId) => {
  try {
    const result = await traceBackward(lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("lotTrace:traceBackward 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("lotTrace:buildTraceTree", async (_event, lotId, direction) => {
  try {
    const result = await buildTraceTree(lotId, direction);
    return { success: true, data: result };
  } catch (error) {
    console.error("lotTrace:buildTraceTree 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("inspection:create", async (_event, input) => {
  try {
    const result = await createInspection(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("inspection:create 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("inspection:getByLot", async (_event, lotId) => {
  try {
    const result = await getInspectionsByLot(lotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("inspection:getByLot 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("line:getAll", async () => {
  try {
    const result = await getAllLines();
    return { success: true, data: result };
  } catch (error) {
    console.error("line:getAll 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("line:getByProcess", async (_event, processCode) => {
  try {
    const result = await getLinesByProcess(processCode);
    return { success: true, data: result };
  } catch (error) {
    console.error("line:getByProcess 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("sequence:getNext", async (_event, prefix) => {
  try {
    const result = await getNextSequence(prefix);
    return { success: true, data: result };
  } catch (error) {
    console.error("sequence:getNext 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("sequence:getNextBundle", async (_event, prefix) => {
  try {
    const result = await getNextBundleSequence(prefix);
    return { success: true, data: result };
  } catch (error) {
    console.error("sequence:getNextBundle 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:create", async (_event, input) => {
  try {
    const result = await createBundle(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:create 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:addToBundle", async (_event, input) => {
  try {
    const result = await addToBundle(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:addToBundle 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:removeFromBundle", async (_event, bundleItemId) => {
  try {
    const result = await removeFromBundle(bundleItemId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:removeFromBundle 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:complete", async (_event, bundleLotId) => {
  try {
    const result = await completeBundle(bundleLotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:complete 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:unbundle", async (_event, bundleLotId) => {
  try {
    await unbundle(bundleLotId);
    return { success: true };
  } catch (error) {
    console.error("bundle:unbundle 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:delete", async (_event, bundleLotId) => {
  try {
    await deleteBundle(bundleLotId);
    return { success: true };
  } catch (error) {
    console.error("bundle:delete 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:getById", async (_event, bundleLotId) => {
  try {
    const result = await getBundleById(bundleLotId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:getById 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:getByNo", async (_event, bundleNo) => {
  try {
    const result = await getBundleByNo(bundleNo);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:getByNo 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:getActive", async () => {
  try {
    const result = await getActiveBundles();
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:getActive 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:getAvailableLots", async (_event, productId) => {
  try {
    const result = await getAvailableLotsForBundle(productId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:getAvailableLots 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:createSet", async (_event, items) => {
  try {
    const result = await createSetBundle(items);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:createSet 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("bundle:shipEntire", async (_event, bundleId) => {
  try {
    const result = await shipEntireBundle(bundleId);
    return { success: true, data: result };
  } catch (error) {
    console.error("bundle:shipEntire 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("product:getAll", async () => {
  try {
    const result = await getAllProducts();
    return { success: true, data: result };
  } catch (error) {
    console.error("product:getAll 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("product:getById", async (_event, productId) => {
  try {
    const result = await getProductById(productId);
    return { success: true, data: result };
  } catch (error) {
    console.error("product:getById 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("product:create", async (_event, input) => {
  try {
    const result = await createProduct(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("product:create 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("product:update", async (_event, productId, input) => {
  try {
    const result = await updateProduct(productId, input);
    return { success: true, data: result };
  } catch (error) {
    console.error("product:update 오류:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("product:delete", async (_event, productId) => {
  try {
    const result = await deleteProduct(productId);
    return { success: true, data: result };
  } catch (error) {
    console.error("product:delete 오류:", error);
    return { success: false, error: String(error) };
  }
});
