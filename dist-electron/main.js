import { app as b, BrowserWindow as T, ipcMain as i, dialog as A } from "electron";
import k from "node:path";
import { fileURLToPath as j } from "node:url";
import { writeFileSync as E, readFileSync as K } from "node:fs";
import { PrismaClient as z } from "@prisma/client";
const D = globalThis, n = D.prisma ?? new z({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
process.env.NODE_ENV !== "production" && (D.prisma = n);
const w = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: n,
  prisma: n
}, Symbol.toStringTag, { value: "Module" })), O = {
  MO: "O",
  // 자재출고
  CA: "C",
  // 자동절압착
  MC: "M",
  // 수동압착
  MS: "S",
  // 미드스플라이스
  SB: "B",
  // 서브조립
  HS: "H",
  // 열수축
  SP: "P",
  // 제품조립제공부품
  PA: "A",
  // 제품조립
  CI: "I",
  // 회로검사
  VI: "V"
  // 육안검사
};
Object.fromEntries(
  Object.entries(O).map(([r, t]) => [t, r])
);
function L(r = /* @__PURE__ */ new Date()) {
  const t = String(r.getFullYear()).slice(-2), e = String(r.getMonth() + 1).padStart(2, "0"), a = String(r.getDate()).padStart(2, "0");
  return `${t}${e}${a}`;
}
function G(r, t, e = /* @__PURE__ */ new Date()) {
  const a = L(e), s = String(t).padStart(4, "0");
  return `${r.toUpperCase()}-${a}-${s}`;
}
function Z(r, t, e, a, s = /* @__PURE__ */ new Date()) {
  const c = O[r.toUpperCase()] || r[0], o = L(s), u = String(a).padStart(3, "0");
  return `${t}Q${e}-${c}${o}-${u}`;
}
function R(r, t, e, a = /* @__PURE__ */ new Date()) {
  const s = L(a), c = String(e).padStart(3, "0");
  return `BD-${r}-${s}-${c}`;
}
const X = 4, Y = 3, B = 9999;
async function q(r, t = /* @__PURE__ */ new Date(), e = X) {
  const a = L(t), s = await n.$transaction(async (c) => {
    const o = await c.sequenceCounter.findUnique({
      where: {
        prefix_dateKey: {
          prefix: r,
          dateKey: a
        }
      }
    });
    let u;
    if (o) {
      if (u = o.lastNumber + 1, u > B)
        throw new Error(`시퀀스 한계 초과: ${r}-${a} (max: ${B})`);
      await c.sequenceCounter.update({
        where: {
          prefix_dateKey: {
            prefix: r,
            dateKey: a
          }
        },
        data: {
          lastNumber: u
        }
      });
    } else
      u = 1, await c.sequenceCounter.create({
        data: {
          prefix: r,
          dateKey: a,
          lastNumber: u
        }
      });
    return u;
  });
  return {
    prefix: r,
    dateKey: a,
    sequence: s,
    formatted: String(s).padStart(e, "0")
  };
}
async function M(r, t = /* @__PURE__ */ new Date()) {
  const e = `${r.toUpperCase()}_BUNDLE`;
  return q(e, t, Y);
}
async function J(r) {
  const {
    processCode: t,
    productId: e,
    productCode: a,
    lineCode: s,
    plannedQty: c = 0,
    workerId: o,
    barcodeVersion: u = 2
  } = r, d = await q(t);
  let l;
  return u === 1 ? l = G(t, d.sequence) : l = Z(t, a || "TEMP", c, d.sequence), await n.productionLot.create({
    data: {
      lotNumber: l,
      processCode: t.toUpperCase(),
      productId: e,
      lineCode: s,
      plannedQty: c,
      workerId: o,
      barcodeVersion: u,
      status: "IN_PROGRESS"
    },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function ee(r, t, e) {
  return await n.productionLot.update({
    where: { id: r },
    data: {
      lineCode: t,
      workerId: e,
      startedAt: /* @__PURE__ */ new Date(),
      status: "IN_PROGRESS"
    },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function te(r) {
  const { lotId: t, completedQty: e, defectQty: a = 0 } = r;
  return await n.productionLot.update({
    where: { id: t },
    data: {
      completedQty: e,
      defectQty: a,
      completedAt: /* @__PURE__ */ new Date(),
      status: "COMPLETED"
    },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function re(r, t) {
  return await n.productionLot.update({
    where: { id: r },
    data: t,
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function ae(r) {
  const { lotId: t, materialBarcode: e, materialId: a, quantity: s } = r, c = await n.lotMaterial.create({
    data: {
      productionLotId: t,
      materialId: a,
      materialLotNo: e,
      quantity: s
    }
  }), o = await U(t);
  return {
    lotMaterialId: c.id,
    lot: o
  };
}
async function se(r) {
  await n.lotMaterial.delete({
    where: { id: r }
  });
}
async function U(r) {
  return n.productionLot.findUnique({
    where: { id: r },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function oe(r) {
  return n.productionLot.findUnique({
    where: { lotNumber: r },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    }
  });
}
async function ce(r, t) {
  const { status: e, startDate: a, endDate: s, limit: c = 100 } = {}, o = {
    processCode: r.toUpperCase()
  };
  return e && (o.status = e), (a || s) && (o.startedAt = {}, a && (o.startedAt.gte = a), s && (o.startedAt.lte = s)), n.productionLot.findMany({
    where: o,
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    },
    orderBy: { startedAt: "desc" },
    take: c
  });
}
async function ne(r, t) {
  const { processCode: e, limit: a = 100 } = {}, s = { status: r };
  return e && (s.processCode = e.toUpperCase()), n.productionLot.findMany({
    where: s,
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      },
      worker: {
        select: { id: !0, name: !0 }
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: !0, code: !0, name: !0 }
          }
        }
      }
    },
    orderBy: { startedAt: "desc" },
    take: a
  });
}
async function ue(r) {
  if (r.itemType === "MATERIAL" && !r.materialId)
    throw new Error("자재 BOM은 materialId가 필요합니다.");
  if (r.itemType === "PRODUCT" && !r.childProductId)
    throw new Error("반제품 BOM은 childProductId가 필요합니다.");
  return n.bOM.create({
    data: {
      productId: r.productId,
      itemType: r.itemType,
      materialId: r.materialId,
      childProductId: r.childProductId,
      quantity: r.quantity,
      unit: r.unit,
      processCode: r.processCode
    },
    include: {
      material: {
        select: { id: !0, code: !0, name: !0, unit: !0 }
      },
      childProduct: {
        select: { id: !0, code: !0, name: !0, type: !0 }
      }
    }
  });
}
async function ie(r, t) {
  return n.bOM.update({
    where: { id: r },
    data: t,
    include: {
      material: {
        select: { id: !0, code: !0, name: !0, unit: !0 }
      },
      childProduct: {
        select: { id: !0, code: !0, name: !0, type: !0 }
      }
    }
  });
}
async function de(r) {
  await n.bOM.delete({
    where: { id: r }
  });
}
async function le(r) {
  return (await n.bOM.findMany({
    where: { productId: r },
    include: {
      material: {
        select: { id: !0, code: !0, name: !0, unit: !0 }
      },
      childProduct: {
        select: { id: !0, code: !0, name: !0, type: !0 }
      }
    },
    orderBy: [
      { itemType: "asc" },
      { id: "asc" }
    ]
  })).map((e) => ({
    id: e.id,
    itemType: e.itemType,
    quantity: e.quantity,
    unit: e.unit,
    processCode: e.processCode,
    material: e.material || void 0,
    childProduct: e.childProduct || void 0
  }));
}
async function ye(r, t) {
  const e = {
    productId: r,
    itemType: "MATERIAL",
    materialId: { not: null }
  };
  return t && (e.processCode = t.toUpperCase()), (await n.bOM.findMany({
    where: e,
    include: {
      material: {
        select: { id: !0, code: !0, name: !0, unit: !0 }
      }
    }
  })).filter((s) => s.material !== null).map((s) => ({
    materialId: s.material.id,
    materialCode: s.material.code,
    materialName: s.material.name,
    unit: s.material.unit,
    quantityPerUnit: s.quantity,
    processCode: s.processCode
  }));
}
async function me(r, t, e) {
  return (await ye(r, t)).map((s) => ({
    ...s,
    requiredQty: s.quantityPerUnit * e
  }));
}
async function pe(r) {
  try {
    const t = await n.materialStock.create({
      data: {
        materialId: r.materialId,
        lotNumber: r.lotNumber,
        quantity: r.quantity,
        usedQty: 0,
        location: r.location,
        receivedAt: /* @__PURE__ */ new Date()
      },
      include: {
        material: {
          select: { code: !0, name: !0 }
        }
      }
    });
    return {
      success: !0,
      stock: {
        id: t.id,
        materialId: t.materialId,
        materialCode: t.material.code,
        materialName: t.material.name,
        lotNumber: t.lotNumber,
        quantity: t.quantity,
        usedQty: t.usedQty,
        availableQty: t.quantity - t.usedQty,
        location: t.location,
        receivedAt: t.receivedAt
      }
    };
  } catch (t) {
    return {
      success: !1,
      error: t instanceof Error ? t.message : "입고 처리 실패"
    };
  }
}
async function fe(r) {
  const { materialId: t, lotNumber: e, quantity: a, productionLotId: s } = r, c = await n.materialStock.findFirst({
    where: {
      materialId: t,
      lotNumber: e
    }
  });
  if (!c)
    throw new Error(`재고를 찾을 수 없습니다: ${e}`);
  const o = c.quantity - c.usedQty;
  if (o < a)
    throw new Error(`재고 부족: 가용 ${o}, 요청 ${a}`);
  await n.materialStock.update({
    where: { id: c.id },
    data: {
      usedQty: c.usedQty + a
    }
  }), s && await n.lotMaterial.create({
    data: {
      productionLotId: s,
      materialId: t,
      materialLotNo: e,
      quantity: a
    }
  });
}
async function he(r) {
  return (await n.materialStock.findMany({
    where: { materialId: r },
    include: {
      material: {
        select: { code: !0, name: !0 }
      }
    },
    orderBy: { receivedAt: "asc" }
  })).map((e) => ({
    id: e.id,
    materialId: e.materialId,
    materialCode: e.material.code,
    materialName: e.material.name,
    lotNumber: e.lotNumber,
    quantity: e.quantity,
    usedQty: e.usedQty,
    availableQty: e.quantity - e.usedQty,
    location: e.location,
    receivedAt: e.receivedAt
  }));
}
async function F() {
  return (await n.material.findMany({
    where: { isActive: !0 },
    include: {
      stocks: {
        select: {
          quantity: !0,
          usedQty: !0
        }
      }
    },
    orderBy: { code: "asc" }
  })).map((t) => {
    const e = t.stocks.reduce((o, u) => o + u.quantity, 0), a = t.stocks.reduce((o, u) => o + u.usedQty, 0), s = e - a;
    let c = "good";
    return s === 0 ? c = "exhausted" : s < t.safeStock * 0.3 ? c = "danger" : s < t.safeStock && (c = "warning"), {
      materialId: t.id,
      materialCode: t.code,
      materialName: t.name,
      unit: t.unit,
      safeStock: t.safeStock,
      totalStock: e,
      availableStock: s,
      lotCount: t.stocks.length,
      status: c
    };
  });
}
async function we() {
  return (await F()).filter(
    (t) => t.status === "warning" || t.status === "danger" || t.status === "exhausted"
  );
}
async function $(r) {
  const t = await n.materialStock.aggregate({
    where: { materialId: r },
    _sum: {
      quantity: !0,
      usedQty: !0
    }
  }), e = t._sum.quantity || 0, a = t._sum.usedQty || 0;
  return e - a;
}
async function ge() {
  const r = /* @__PURE__ */ new Date();
  return r.setHours(0, 0, 0, 0), await n.materialStock.findMany({
    where: {
      receivedAt: { gte: r }
    },
    include: {
      material: {
        select: {
          code: !0,
          name: !0,
          unit: !0
        }
      }
    },
    orderBy: { receivedAt: "desc" }
  });
}
async function _(r, t, e, a = !0) {
  const s = await n.materialStock.findMany({
    where: { materialId: r },
    orderBy: { receivedAt: "asc" }
  });
  let c = t;
  const o = [];
  let u = 0;
  for (const d of s) {
    if (c <= 0) break;
    const l = d.quantity - d.usedQty;
    if (l <= 0) continue;
    const y = Math.min(l, c);
    await n.materialStock.update({
      where: { id: d.id },
      data: { usedQty: d.usedQty + y }
    }), e && await n.lotMaterial.create({
      data: {
        productionLotId: e,
        materialId: r,
        materialLotNo: d.lotNumber,
        quantity: y
      }
    }), o.push({ lotNumber: d.lotNumber, usedQty: y }), u += y, c -= y;
  }
  if (c > 0 && a) {
    const d = s.length > 0 ? s[s.length - 1] : null;
    if (d) {
      await n.materialStock.update({
        where: { id: d.id },
        data: { usedQty: d.usedQty + c }
      }), e && await n.lotMaterial.create({
        data: {
          productionLotId: e,
          materialId: r,
          materialLotNo: d.lotNumber,
          quantity: c
        }
      });
      const l = o.find((y) => y.lotNumber === d.lotNumber);
      l ? l.usedQty += c : o.push({ lotNumber: d.lotNumber, usedQty: c }), u += c, c = 0;
    }
  }
  return {
    lots: o,
    deductedQty: u,
    remainingQty: c
  };
}
async function Se(r, t, e, a = [], s = !0, c) {
  const o = await me(r, t, e), u = {
    success: !0,
    productId: r,
    processCode: t,
    productionQty: e,
    allowNegative: s,
    items: [],
    totalRequired: 0,
    totalDeducted: 0,
    errors: []
  };
  if (o.length === 0)
    return u;
  const d = /* @__PURE__ */ new Map();
  for (const l of a) {
    const y = d.get(l.materialId) || [];
    y.push(l), d.set(l.materialId, y);
  }
  for (const l of o) {
    u.totalRequired += l.requiredQty;
    const y = {
      materialId: l.materialId,
      materialCode: l.materialCode,
      materialName: l.materialName,
      requiredQty: l.requiredQty,
      deductedQty: 0,
      remainingQty: l.requiredQty,
      lots: [],
      success: !1,
      allowedNegative: !1
    };
    try {
      const f = d.get(l.materialId);
      if (f && f.length > 0) {
        let p = l.requiredQty;
        for (const m of f) {
          if (p <= 0) break;
          if (m.lotNumber) {
            const S = await n.materialStock.findFirst({
              where: {
                materialId: l.materialId,
                lotNumber: m.lotNumber
              }
            });
            if (S) {
              const N = S.quantity - S.usedQty, g = m.quantity ? Math.min(m.quantity, p) : Math.min(N > 0 ? N : p, p);
              if (g > N && !s) {
                y.error = `재고 부족: ${m.lotNumber} (가용: ${N}, 필요: ${g})`;
                continue;
              }
              await n.materialStock.update({
                where: { id: S.id },
                data: { usedQty: S.usedQty + g }
              }), c && await n.lotMaterial.create({
                data: {
                  productionLotId: c,
                  materialId: l.materialId,
                  materialLotNo: m.lotNumber,
                  quantity: g
                }
              }), y.lots.push({ lotNumber: m.lotNumber, usedQty: g }), y.deductedQty += g, p -= g, g > N && (y.allowedNegative = !0);
            }
          }
        }
        if (p > 0) {
          const m = await _(
            l.materialId,
            p,
            c,
            s
          );
          y.lots.push(...m.lots), y.deductedQty += m.deductedQty, p = m.remainingQty, m.remainingQty === 0 && m.deductedQty < p && (y.allowedNegative = !0);
        }
        y.remainingQty = p, y.success = p === 0;
      } else {
        const p = await _(
          l.materialId,
          l.requiredQty,
          c,
          s
        );
        y.lots = p.lots, y.deductedQty = p.deductedQty, y.remainingQty = p.remainingQty, y.success = p.remainingQty === 0, await $(l.materialId) < 0 && (y.allowedNegative = !0);
      }
      u.totalDeducted += y.deductedQty;
    } catch (f) {
      y.error = f instanceof Error ? f.message : "차감 실패", y.success = !1;
    }
    !y.success && !s && (u.success = !1, u.errors.push(`${l.materialCode}: ${y.error || "차감 실패"}`)), u.items.push(y);
  }
  return u;
}
async function be(r) {
  return n.material.create({
    data: {
      code: r.code,
      name: r.name,
      spec: r.spec,
      category: r.category,
      unit: r.unit,
      safeStock: r.safeStock || 0,
      description: r.description
    }
  });
}
async function ve(r) {
  return n.material.findUnique({
    where: { id: r },
    include: {
      stocks: !0,
      _count: {
        select: {
          lotMaterials: !0,
          bomItems: !0
        }
      }
    }
  });
}
async function Ne(r, t) {
  return n.material.update({
    where: { id: r },
    data: t
  });
}
async function ke(r) {
  await n.material.update({
    where: { id: r },
    data: { isActive: !1 }
  });
}
async function Le(r) {
  const { category: t, isActive: e = !0, search: a } = {}, s = {};
  return e !== void 0 && (s.isActive = e), t && (s.category = t), a && (s.OR = [
    { code: { contains: a, mode: "insensitive" } },
    { name: { contains: a, mode: "insensitive" } }
  ]), n.material.findMany({
    where: s,
    include: {
      _count: {
        select: {
          stocks: !0,
          lotMaterials: !0
        }
      }
    },
    orderBy: { code: "asc" }
  });
}
async function I(r, t = 10) {
  const e = await n.lotMaterial.findMany({
    where: { materialLotNo: r },
    include: {
      productionLot: {
        include: {
          product: !0,
          childLots: {
            include: {
              product: !0
            }
          }
        }
      },
      material: !0
    }
  });
  if (e.length === 0) {
    const u = await n.material.findFirst({
      where: {
        OR: [
          { code: r },
          { stocks: { some: { lotNumber: r } } }
        ]
      }
    });
    return {
      rootNode: {
        id: 0,
        lotNumber: r,
        processCode: "MATERIAL",
        type: "MATERIAL_LOT",
        materialCode: u?.code,
        materialName: u?.name,
        quantity: 0,
        status: "NOT_FOUND",
        date: /* @__PURE__ */ new Date(),
        depth: 0,
        children: []
      },
      totalNodes: 1,
      maxDepth: 0,
      direction: "FORWARD",
      tracedAt: /* @__PURE__ */ new Date()
    };
  }
  const a = e[0], s = {
    id: 0,
    lotNumber: r,
    processCode: "MATERIAL",
    type: "MATERIAL_LOT",
    materialCode: a.material.code,
    materialName: a.material.name,
    quantity: e.reduce((u, d) => u + d.quantity, 0),
    status: "TRACED",
    date: a.createdAt,
    depth: 0,
    children: []
  };
  let c = 1, o = 0;
  for (const u of e) {
    const d = u.productionLot, l = await x(d, 1, t);
    s.children.push(l.node), c += l.count, o = Math.max(o, l.depth);
  }
  return {
    rootNode: s,
    totalNodes: c,
    maxDepth: o,
    direction: "FORWARD",
    tracedAt: /* @__PURE__ */ new Date()
  };
}
async function x(r, t, e) {
  const a = {
    id: r.id,
    lotNumber: r.lotNumber,
    processCode: r.processCode,
    type: "PRODUCTION_LOT",
    productCode: r.product?.code,
    productName: r.product?.name,
    quantity: r.completedQty,
    status: r.status,
    date: r.startedAt,
    depth: t,
    children: []
  };
  let s = 1, c = t;
  if (t >= e)
    return { node: a, count: s, depth: c };
  const o = await n.productionLot.findMany({
    where: { parentLotId: r.id },
    include: {
      product: !0,
      childLots: !0
    }
  });
  for (const u of o) {
    const d = await x(
      u,
      t + 1,
      e
    );
    a.children.push(d.node), s += d.count, c = Math.max(c, d.depth);
  }
  return { node: a, count: s, depth: c };
}
async function Q(r, t = 10) {
  const e = await n.productionLot.findUnique({
    where: { lotNumber: r },
    include: {
      product: !0,
      lotMaterials: {
        include: { material: !0 }
      },
      parentLot: {
        include: {
          product: !0,
          lotMaterials: {
            include: { material: !0 }
          }
        }
      }
    }
  });
  if (!e)
    return {
      rootNode: {
        id: 0,
        lotNumber: r,
        processCode: "UNKNOWN",
        type: "PRODUCTION_LOT",
        quantity: 0,
        status: "NOT_FOUND",
        date: /* @__PURE__ */ new Date(),
        depth: 0,
        children: []
      },
      totalNodes: 1,
      maxDepth: 0,
      direction: "BACKWARD",
      tracedAt: /* @__PURE__ */ new Date()
    };
  const a = {
    id: e.id,
    lotNumber: e.lotNumber,
    processCode: e.processCode,
    type: "PRODUCTION_LOT",
    productCode: e.product?.code,
    productName: e.product?.name,
    quantity: e.completedQty,
    status: e.status,
    date: e.startedAt,
    depth: 0,
    children: []
  }, s = await V(
    e,
    a,
    1,
    t
  );
  return {
    rootNode: a,
    totalNodes: s.count + 1,
    maxDepth: s.depth,
    direction: "BACKWARD",
    tracedAt: /* @__PURE__ */ new Date()
  };
}
async function V(r, t, e, a) {
  let s = 0, c = e;
  if (e > a)
    return { count: s, depth: e - 1 };
  for (const o of r.lotMaterials) {
    const u = {
      id: o.id,
      lotNumber: o.materialLotNo,
      processCode: "MATERIAL",
      type: "MATERIAL_LOT",
      materialCode: o.material.code,
      materialName: o.material.name,
      quantity: o.quantity,
      status: "USED",
      date: o.createdAt,
      depth: e,
      children: []
    };
    t.children.push(u), s++;
  }
  if (r.parentLotId) {
    const o = await n.productionLot.findUnique({
      where: { id: r.parentLotId },
      include: {
        product: !0,
        lotMaterials: {
          include: { material: !0 }
        }
      }
    });
    if (o) {
      const u = {
        id: o.id,
        lotNumber: o.lotNumber,
        processCode: o.processCode,
        type: "PRODUCTION_LOT",
        productCode: o.product?.code,
        productName: o.product?.name,
        quantity: o.completedQty,
        status: o.status,
        date: o.startedAt,
        depth: e,
        children: []
      };
      t.children.push(u), s++;
      const d = await V(
        o,
        u,
        e + 1,
        a
      );
      s += d.count, c = Math.max(c, d.depth);
    }
  }
  return { count: s, depth: c };
}
async function Ie(r, t, e = 10) {
  if (t === "BOTH") {
    const [a, s] = await Promise.all([
      I(r, e),
      Q(r, e)
    ]);
    return { forward: a, backward: s };
  }
  return t === "FORWARD" ? I(r, e) : Q(r, e);
}
async function Qe(r) {
  const { lotId: t, type: e, result: a, defectReason: s, defectQty: c = 0, inspectorId: o } = r, u = await n.inspection.create({
    data: {
      productionLotId: t,
      type: e,
      result: a,
      defectReason: s,
      defectQty: c,
      inspectorId: o,
      inspectedAt: /* @__PURE__ */ new Date()
    },
    include: {
      productionLot: {
        select: {
          id: !0,
          lotNumber: !0,
          processCode: !0,
          product: {
            select: { code: !0, name: !0 }
          }
        }
      },
      inspector: {
        select: { id: !0, name: !0 }
      }
    }
  });
  return a === "FAIL" && c > 0 && await n.productionLot.update({
    where: { id: t },
    data: {
      defectQty: {
        increment: c
      }
    }
  }), u;
}
async function Ae(r) {
  return n.inspection.findMany({
    where: { productionLotId: r },
    include: {
      productionLot: {
        select: {
          id: !0,
          lotNumber: !0,
          processCode: !0,
          product: {
            select: { code: !0, name: !0 }
          }
        }
      },
      inspector: {
        select: { id: !0, name: !0 }
      }
    },
    orderBy: { inspectedAt: "desc" }
  });
}
async function W(r) {
  const { processCode: t, isActive: e = !0 } = r || {}, a = {};
  return e !== void 0 && (a.isActive = e), t && (a.processCode = t.toUpperCase()), n.line.findMany({
    where: a,
    orderBy: [
      { processCode: "asc" },
      { code: "asc" }
    ]
  });
}
async function qe(r) {
  return W({ processCode: r });
}
async function Me(r) {
  const { processCode: t, productId: e, productCode: a, setQuantity: s } = r, c = await M(t), o = R(a, s, c.sequence), u = await n.bundleLot.create({
    data: {
      bundleNo: o,
      productId: e,
      setQuantity: s,
      totalQty: 0,
      status: "CREATED"
    },
    include: {
      product: {
        select: { code: !0, name: !0 }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: !0, processCode: !0 }
          }
        }
      }
    }
  });
  return {
    id: u.id,
    bundleNo: u.bundleNo,
    productId: u.productId,
    productCode: u.product.code,
    productName: u.product.name,
    bundleType: u.bundleType,
    setQuantity: u.setQuantity,
    totalQty: u.totalQty,
    status: u.status,
    items: [],
    createdAt: u.createdAt
  };
}
async function Ce(r) {
  const { bundleLotId: t, productionLotId: e, quantity: a } = r, s = await n.bundleLot.findUnique({
    where: { id: t }
  });
  if (!s)
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  if (s.status !== "CREATED")
    throw new Error("이미 완료된 번들에는 추가할 수 없습니다.");
  return await n.bundleItem.create({
    data: {
      bundleLotId: t,
      productionLotId: e,
      quantity: a
    }
  }), await n.bundleLot.update({
    where: { id: t },
    data: {
      totalQty: { increment: a }
    }
  }), v(t);
}
async function Be(r) {
  const t = await n.bundleItem.findUnique({
    where: { id: r },
    include: { bundleLot: !0 }
  });
  if (!t)
    throw new Error("번들 아이템을 찾을 수 없습니다.");
  if (t.bundleLot.status !== "CREATED")
    throw new Error("이미 완료된 번들에서는 제거할 수 없습니다.");
  return await n.bundleItem.delete({
    where: { id: r }
  }), await n.bundleLot.update({
    where: { id: t.bundleLotId },
    data: {
      totalQty: { decrement: t.quantity }
    }
  }), v(t.bundleLotId);
}
async function _e(r) {
  const t = await n.bundleLot.findUnique({
    where: { id: r },
    include: { items: !0 }
  });
  if (!t)
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  if (t.items.length === 0)
    throw new Error("번들에 추가된 LOT가 없습니다.");
  if (t.items.length !== t.setQuantity)
    throw new Error(`번들 수량이 일치하지 않습니다. (예상: ${t.setQuantity}, 실제: ${t.items.length})`);
  return await n.bundleLot.update({
    where: { id: r },
    data: { status: "SHIPPED" }
  }), v(r);
}
async function Pe(r) {
  if (!await n.bundleLot.findUnique({
    where: { id: r }
  }))
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  await n.bundleItem.deleteMany({
    where: { bundleLotId: r }
  }), await n.bundleLot.update({
    where: { id: r },
    data: {
      status: "UNBUNDLED",
      totalQty: 0
    }
  });
}
async function Te(r) {
  await n.bundleLot.delete({
    where: { id: r }
  });
}
async function v(r) {
  const t = await n.bundleLot.findUnique({
    where: { id: r },
    include: {
      product: {
        select: { code: !0, name: !0 }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: !0, processCode: !0 }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  return t ? {
    id: t.id,
    bundleNo: t.bundleNo,
    productId: t.productId,
    productCode: t.product.code,
    productName: t.product.name,
    bundleType: t.bundleType,
    setQuantity: t.setQuantity,
    totalQty: t.totalQty,
    status: t.status,
    items: t.items.map((e) => ({
      id: e.id,
      productionLotId: e.productionLotId,
      lotNumber: e.productionLot.lotNumber,
      quantity: e.quantity,
      processCode: e.productionLot.processCode,
      createdAt: e.createdAt
    })),
    createdAt: t.createdAt
  } : null;
}
async function Ee(r) {
  const t = await n.bundleLot.findUnique({
    where: { bundleNo: r }
  });
  return t ? v(t.id) : null;
}
async function De() {
  return (await n.bundleLot.findMany({
    where: { status: "CREATED" },
    include: {
      product: {
        select: { code: !0, name: !0 }
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: !0, processCode: !0 }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })).map((t) => ({
    id: t.id,
    bundleNo: t.bundleNo,
    productId: t.productId,
    productCode: t.product.code,
    productName: t.product.name,
    bundleType: t.bundleType,
    setQuantity: t.setQuantity,
    totalQty: t.totalQty,
    status: t.status,
    items: t.items.map((e) => ({
      id: e.id,
      productionLotId: e.productionLotId,
      lotNumber: e.productionLot.lotNumber,
      quantity: e.quantity,
      processCode: e.productionLot.processCode,
      createdAt: e.createdAt
    })),
    createdAt: t.createdAt
  }));
}
async function Oe(r) {
  const e = (await n.bundleItem.findMany({
    select: { productionLotId: !0 }
  })).map((s) => s.productionLotId);
  return await n.productionLot.findMany({
    where: {
      productId: r,
      processCode: "CA",
      status: "COMPLETED",
      id: { notIn: e }
    },
    select: {
      id: !0,
      lotNumber: !0,
      processCode: !0,
      completedQty: !0,
      completedAt: !0
    },
    orderBy: { completedAt: "desc" },
    take: 50
  });
}
async function Re(r) {
  const t = await n.bundleLot.findUnique({
    where: { id: r },
    include: {
      items: {
        include: {
          productionLot: {
            select: { lotNumber: !0 }
          }
        }
      }
    }
  });
  if (!t)
    throw new Error("번들 LOT를 찾을 수 없습니다.");
  if (t.items.length === 0)
    throw new Error("번들에 출하할 아이템이 없습니다.");
  if (t.status === "SHIPPED")
    throw new Error("이미 출하 완료된 번들입니다.");
  await n.bundleLot.update({
    where: { id: r },
    data: { status: "SHIPPED" }
  });
  const e = t.items.map((s) => s.productionLot.lotNumber), a = t.items.map((s) => s.id);
  return {
    success: !0,
    bundleId: r,
    bundleNo: t.bundleNo,
    shippedItemIds: a,
    shippedLotNumbers: e,
    newBundleStatus: "SHIPPED",
    message: `번들 전체 출하 완료 (${e.length}개 아이템)`
  };
}
async function Ue(r) {
  if (r.length === 0)
    throw new Error("번들에 추가할 아이템이 없습니다.");
  const t = r.map((m) => m.lotId), e = await n.productionLot.findMany({
    where: { id: { in: t } },
    include: {
      product: {
        select: { id: !0, code: !0, name: !0 }
      }
    }
  });
  if (e.length !== r.length)
    throw new Error("일부 LOT를 찾을 수 없습니다.");
  const s = new Set(e.map((m) => m.productId)).size === 1 ? "SAME_PRODUCT" : "MULTI_PRODUCT", c = e[0], o = c.processCode, u = c.product.code, d = await M(o), l = r.length, y = R(
    s === "MULTI_PRODUCT" ? "SET" : u,
    l,
    d.sequence
  ), f = r.reduce((m, S) => m + S.quantity, 0), p = await n.bundleLot.create({
    data: {
      bundleNo: y,
      productId: c.productId,
      bundleType: s,
      setQuantity: l,
      totalQty: f,
      status: "CREATED"
    }
  });
  for (const m of r)
    await n.bundleItem.create({
      data: {
        bundleLotId: p.id,
        productionLotId: m.lotId,
        quantity: m.quantity
      }
    });
  return v(p.id);
}
async function Fe(r) {
  return n.product.create({
    data: {
      code: r.code,
      name: r.name,
      spec: r.spec,
      type: r.type || "FINISHED",
      processCode: r.processCode,
      crimpCode: r.crimpCode,
      description: r.description
    }
  });
}
async function $e(r) {
  return n.product.findUnique({
    where: { id: r },
    include: {
      _count: {
        select: {
          boms: !0,
          productionLots: !0
        }
      }
    }
  });
}
async function xe(r, t) {
  return n.product.update({
    where: { id: r },
    data: t
  });
}
async function Ve(r) {
  await n.product.update({
    where: { id: r },
    data: { isActive: !1 }
  });
}
async function We(r) {
  const { type: t, isActive: e = !0, search: a } = {}, s = {};
  return e !== void 0 && (s.isActive = e), t && (s.type = t), a && (s.OR = [
    { code: { contains: a, mode: "insensitive" } },
    { name: { contains: a, mode: "insensitive" } }
  ]), n.product.findMany({
    where: s,
    include: {
      _count: {
        select: {
          boms: !0,
          productionLots: !0
        }
      }
    },
    orderBy: { code: "asc" }
  });
}
const C = k.dirname(j(import.meta.url));
process.env.DIST = k.join(C, "../dist");
process.env.VITE_PUBLIC = b.isPackaged ? process.env.DIST : k.join(C, "../public");
let h;
const P = process.env.VITE_DEV_SERVER_URL, He = !b.isPackaged;
function H() {
  h = new T({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: k.join(C, "preload.js")
    }
  }), h.webContents.on("did-finish-load", () => {
    h?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), P ? h.loadURL(P) : He ? h.loadURL("http://localhost:5173") : h.loadFile(k.join(process.env.DIST, "index.html"));
}
b.on("window-all-closed", () => {
  process.platform !== "darwin" && b.quit();
});
b.on("activate", () => {
  T.getAllWindows().length === 0 && H();
});
b.whenReady().then(H);
i.handle("get-printers", async () => {
  if (!h) return [];
  try {
    return (await h.webContents.getPrintersAsync()).map((t) => ({
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      status: t.status,
      isDefault: t.isDefault
    }));
  } catch (r) {
    return console.error("프린터 목록 조회 오류:", r), [];
  }
});
i.handle("print-pdf", async (r, t) => {
  if (!h) return { success: !1, error: "Window not found" };
  try {
    const e = {
      silent: t.silent ?? !0,
      deviceName: t.printerName,
      copies: t.copies ?? 1
    };
    return { success: await h.webContents.print(e) };
  } catch (e) {
    return console.error("PDF 인쇄 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("print-to-pdf", async () => {
  if (!h) return { success: !1, error: "Window not found" };
  try {
    const { filePath: r } = await A.showSaveDialog(h, {
      defaultPath: "output.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (!r)
      return { success: !1, error: "Cancelled" };
    const t = await h.webContents.printToPDF({});
    return E(r, t), { success: !0, filePath: r };
  } catch (r) {
    return console.error("PDF 저장 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("print-label", async (r, t) => {
  if (!h) return { success: !1, error: "Window not found" };
  try {
    if (t.zplData)
      return console.log("ZPL 라벨 인쇄 요청:", t.printerName), { success: !0, message: "ZPL 인쇄 대기중 (구현 예정)" };
    if (t.pdfBase64) {
      const e = {
        silent: !0,
        deviceName: t.printerName,
        copies: 1
      };
      return await h.webContents.print(e), { success: !0 };
    }
    return { success: !1, error: "No print data provided" };
  } catch (e) {
    return console.error("라벨 인쇄 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("save-file-dialog", async (r, t) => h && (await A.showSaveDialog(h, {
  defaultPath: t.defaultPath,
  filters: t.filters
})).filePath || null);
i.handle("open-file-dialog", async (r, t) => h ? (await A.showOpenDialog(h, {
  filters: t.filters,
  properties: t.multiple ? ["openFile", "multiSelections"] : ["openFile"]
})).filePaths : []);
i.handle("write-file", async (r, t) => {
  try {
    return E(t.filePath, t.data), { success: !0 };
  } catch (e) {
    return { success: !1, error: String(e) };
  }
});
i.handle("read-file", async (r, t) => {
  try {
    return { success: !0, data: K(t).toString("base64") };
  } catch (e) {
    return { success: !1, error: String(e) };
  }
});
i.handle("production:createLot", async (r, t) => {
  try {
    return { success: !0, data: await J(t) };
  } catch (e) {
    return console.error("production:createLot 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:startProduction", async (r, t) => {
  try {
    return { success: !0, data: await ee(t) };
  } catch (e) {
    return console.error("production:startProduction 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:completeProduction", async (r, t, e) => {
  try {
    return { success: !0, data: await te(t, e) };
  } catch (a) {
    return console.error("production:completeProduction 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("production:addMaterial", async (r, t, e, a, s) => {
  try {
    return { success: !0, data: await ae(t, e, a, s) };
  } catch (c) {
    return console.error("production:addMaterial 오류:", c), { success: !1, error: String(c) };
  }
});
i.handle("production:removeMaterial", async (r, t) => {
  try {
    return { success: !0, data: await se(t) };
  } catch (e) {
    return console.error("production:removeMaterial 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:getLotById", async (r, t) => {
  try {
    return { success: !0, data: await U(t) };
  } catch (e) {
    return console.error("production:getLotById 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:getLotByNumber", async (r, t) => {
  try {
    return { success: !0, data: await oe(t) };
  } catch (e) {
    return console.error("production:getLotByNumber 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:getLotsByProcess", async (r, t) => {
  try {
    return { success: !0, data: await ce(t) };
  } catch (e) {
    return console.error("production:getLotsByProcess 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:getLotsByStatus", async (r, t) => {
  try {
    return { success: !0, data: await ne(t) };
  } catch (e) {
    return console.error("production:getLotsByStatus 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("production:updateLotQuantity", async (r, t, e) => {
  try {
    return { success: !0, data: await re(t, e) };
  } catch (a) {
    return console.error("production:updateLotQuantity 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("stock:receiveStock", async (r, t) => {
  try {
    return { success: !0, data: await pe(t) };
  } catch (e) {
    return console.error("stock:receiveStock 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:consumeStock", async (r, t, e, a) => {
  try {
    return { success: !0, data: await fe(t, e, a) };
  } catch (s) {
    return console.error("stock:consumeStock 오류:", s), { success: !1, error: String(s) };
  }
});
i.handle("stock:deductByBOM", async (r, t, e, a, s, c, o) => {
  try {
    return { success: !0, data: await Se(t, e, a, s, c, o) };
  } catch (u) {
    return console.error("stock:deductByBOM 오류:", u), { success: !1, error: String(u) };
  }
});
i.handle("stock:getStockByMaterial", async (r, t) => {
  try {
    return { success: !0, data: await he(t) };
  } catch (e) {
    return console.error("stock:getStockByMaterial 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:getStockSummary", async () => {
  try {
    return { success: !0, data: await F() };
  } catch (r) {
    return console.error("stock:getStockSummary 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("stock:getLowStock", async () => {
  try {
    return { success: !0, data: await we() };
  } catch (r) {
    return console.error("stock:getLowStock 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("stock:getAvailableQty", async (r, t) => {
  try {
    return { success: !0, data: await $(t) };
  } catch (e) {
    return console.error("stock:getAvailableQty 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:getTodayReceivings", async () => {
  try {
    return { success: !0, data: await ge() };
  } catch (r) {
    return console.error("stock:getTodayReceivings 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("stock:getAllStocks", async (r, t) => {
  try {
    const e = await Promise.resolve().then(() => w).then((s) => s.prisma.material.findMany({
      where: t?.materialCode ? { code: { contains: t.materialCode } } : void 0,
      include: {
        stocks: {
          orderBy: { receivedAt: "asc" }
        }
      }
    })), a = [];
    for (const s of e)
      for (const c of s.stocks) {
        const o = c.quantity - c.usedQty;
        !t?.showZero && o <= 0 || a.push({
          id: c.id,
          materialId: c.materialId,
          materialCode: s.code,
          materialName: s.name,
          lotNumber: c.lotNumber,
          quantity: c.quantity,
          usedQty: c.usedQty,
          availableQty: o,
          processCode: c.location || void 0,
          // location을 processCode로 활용
          location: c.location,
          receivedAt: c.receivedAt
        });
      }
    return { success: !0, data: a };
  } catch (e) {
    return console.error("stock:getAllStocks 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:registerProcessStock", async (r, t) => {
  try {
    const { prisma: e } = await Promise.resolve().then(() => w), a = await e.materialStock.findFirst({
      where: {
        materialId: t.materialId,
        lotNumber: t.lotNumber,
        location: t.processCode
        // processCode를 location에 저장
      }
    });
    if (a) {
      const c = await e.materialStock.update({
        where: { id: a.id },
        data: { quantity: a.quantity + t.quantity }
      });
      return {
        success: !0,
        data: {
          id: c.id,
          isNewEntry: !1,
          stock: {
            id: c.id,
            materialId: c.materialId,
            lotNumber: c.lotNumber,
            quantity: c.quantity,
            usedQty: c.usedQty,
            availableQty: c.quantity - c.usedQty,
            processCode: c.location
          }
        }
      };
    }
    const s = await e.materialStock.create({
      data: {
        materialId: t.materialId,
        lotNumber: t.lotNumber,
        quantity: t.quantity,
        usedQty: 0,
        location: t.processCode,
        // processCode를 location에 저장
        receivedAt: /* @__PURE__ */ new Date()
      }
    });
    return {
      success: !0,
      data: {
        id: s.id,
        isNewEntry: !0,
        stock: {
          id: s.id,
          materialId: s.materialId,
          lotNumber: s.lotNumber,
          quantity: s.quantity,
          usedQty: s.usedQty,
          availableQty: s.quantity - s.usedQty,
          processCode: s.location
        }
      }
    };
  } catch (e) {
    return console.error("stock:registerProcessStock 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:getStocksByProcess", async (r, t, e) => {
  try {
    const { prisma: a } = await Promise.resolve().then(() => w);
    return { success: !0, data: (await a.materialStock.findMany({
      where: {
        location: t,
        ...e?.materialCode ? {
          material: { code: { contains: e.materialCode } }
        } : {}
      },
      include: {
        material: { select: { code: !0, name: !0 } }
      },
      orderBy: { receivedAt: "asc" }
    })).map((o) => ({
      id: o.id,
      materialId: o.materialId,
      materialCode: o.material.code,
      materialName: o.material.name,
      lotNumber: o.lotNumber,
      quantity: o.quantity,
      usedQty: o.usedQty,
      availableQty: o.quantity - o.usedQty,
      processCode: o.location,
      location: o.location,
      receivedAt: o.receivedAt
    })).filter((o) => e?.showZero || o.availableQty > 0) };
  } catch (a) {
    return console.error("stock:getStocksByProcess 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("stock:checkProcessStockStatus", async (r, t, e) => {
  try {
    const { prisma: a } = await Promise.resolve().then(() => w), s = await a.materialStock.findFirst({
      where: {
        location: t,
        lotNumber: e
      }
    });
    if (!s)
      return {
        success: !0,
        data: {
          exists: !1,
          lotNumber: e,
          processCode: t,
          quantity: 0,
          usedQty: 0,
          availableQty: 0,
          isExhausted: !1,
          canRegister: !0
        }
      };
    const c = s.quantity - s.usedQty, o = c <= 0;
    return {
      success: !0,
      data: {
        exists: !0,
        lotNumber: e,
        processCode: t,
        quantity: s.quantity,
        usedQty: s.usedQty,
        availableQty: c,
        isExhausted: o,
        canRegister: !o
      }
    };
  } catch (a) {
    return console.error("stock:checkProcessStockStatus 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("stock:consumeProcessStock", async (r, t, e, a, s, c) => {
  try {
    const { prisma: o } = await Promise.resolve().then(() => w), u = await o.materialStock.findMany({
      where: {
        materialId: e,
        location: t
      },
      orderBy: { receivedAt: "asc" }
    });
    let d = a;
    const l = [];
    let y = 0;
    for (const f of u) {
      if (d <= 0) break;
      const p = f.quantity - f.usedQty;
      if (p <= 0) continue;
      const m = Math.min(p, d);
      await o.materialStock.update({
        where: { id: f.id },
        data: { usedQty: f.usedQty + m }
      }), s && await o.lotMaterial.create({
        data: {
          productionLotId: s,
          materialId: e,
          materialLotNo: f.lotNumber,
          quantity: m
        }
      }), l.push({ lotNumber: f.lotNumber, usedQty: m }), y += m, d -= m;
    }
    if (d > 0 && c && u.length > 0) {
      const f = u[u.length - 1];
      await o.materialStock.update({
        where: { id: f.id },
        data: { usedQty: f.usedQty + d }
      });
      const p = l.find((m) => m.lotNumber === f.lotNumber);
      p ? p.usedQty += d : l.push({ lotNumber: f.lotNumber, usedQty: d }), y += d, d = 0;
    }
    return {
      success: !0,
      data: {
        lots: l,
        deductedQty: y,
        remainingQty: d
      }
    };
  } catch (o) {
    return console.error("stock:consumeProcessStock 오류:", o), { success: !1, error: String(o) };
  }
});
i.handle("stock:getProcessStockSummary", async (r, t) => {
  try {
    const { prisma: e } = await Promise.resolve().then(() => w), a = await e.materialStock.findMany({
      where: { location: t }
    }), s = new Set(a.map((o) => o.materialId));
    return { success: !0, data: {
      totalLots: a.length,
      totalQuantity: a.reduce((o, u) => o + u.quantity, 0),
      totalUsed: a.reduce((o, u) => o + u.usedQty, 0),
      totalAvailable: a.reduce((o, u) => o + (u.quantity - u.usedQty), 0),
      materialCount: s.size
    } };
  } catch (e) {
    return console.error("stock:getProcessStockSummary 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:getProcessAvailableQty", async (r, t, e) => {
  try {
    const { prisma: a } = await Promise.resolve().then(() => w), s = await a.materialStock.aggregate({
      where: {
        materialId: e,
        location: t
      },
      _sum: {
        quantity: !0,
        usedQty: !0
      }
    }), c = s._sum.quantity || 0, o = s._sum.usedQty || 0;
    return { success: !0, data: c - o };
  } catch (a) {
    return console.error("stock:getProcessAvailableQty 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("stock:getTodayProcessReceivings", async (r, t) => {
  try {
    const { prisma: e } = await Promise.resolve().then(() => w), a = /* @__PURE__ */ new Date();
    return a.setHours(0, 0, 0, 0), { success: !0, data: (await e.materialStock.findMany({
      where: {
        receivedAt: { gte: a },
        ...t ? { location: t } : {}
      },
      include: {
        material: { select: { code: !0, name: !0 } }
      },
      orderBy: { receivedAt: "desc" }
    })).map((o) => ({
      id: o.id,
      processCode: o.location || "",
      materialCode: o.material.code,
      materialName: o.material.name,
      lotNumber: o.lotNumber,
      quantity: o.quantity,
      receivedAt: o.receivedAt
    })) };
  } catch (e) {
    return console.error("stock:getTodayProcessReceivings 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:deleteStockItems", async (r, t) => {
  try {
    const { prisma: e } = await Promise.resolve().then(() => w);
    return { success: !0, data: (await e.materialStock.deleteMany({
      where: { id: { in: t } }
    })).count };
  } catch (e) {
    return console.error("stock:deleteStockItems 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("stock:resetAllStockData", async () => {
  try {
    const { prisma: r } = await Promise.resolve().then(() => w), t = await r.lotMaterial.deleteMany({});
    return {
      success: !0,
      data: {
        stocks: (await r.materialStock.deleteMany({})).count,
        receivings: 0,
        lotMaterials: t.count
      }
    };
  } catch (r) {
    return console.error("stock:resetAllStockData 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("bom:createBOMItem", async (r, t) => {
  try {
    return { success: !0, data: await ue(t) };
  } catch (e) {
    return console.error("bom:createBOMItem 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bom:updateBOMItem", async (r, t, e) => {
  try {
    return { success: !0, data: await ie(t, e) };
  } catch (a) {
    return console.error("bom:updateBOMItem 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("bom:deleteBOMItem", async (r, t) => {
  try {
    return { success: !0, data: await de(t) };
  } catch (e) {
    return console.error("bom:deleteBOMItem 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bom:getBOMByProduct", async (r, t) => {
  try {
    return { success: !0, data: await le(t) };
  } catch (e) {
    return console.error("bom:getBOMByProduct 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("material:create", async (r, t) => {
  try {
    return { success: !0, data: await be(t) };
  } catch (e) {
    return console.error("material:create 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("material:getById", async (r, t) => {
  try {
    return { success: !0, data: await ve(t) };
  } catch (e) {
    return console.error("material:getById 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("material:update", async (r, t, e) => {
  try {
    return { success: !0, data: await Ne(t, e) };
  } catch (a) {
    return console.error("material:update 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("material:delete", async (r, t) => {
  try {
    return { success: !0, data: await ke(t) };
  } catch (e) {
    return console.error("material:delete 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("material:getAll", async () => {
  try {
    return { success: !0, data: await Le() };
  } catch (r) {
    return console.error("material:getAll 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("lotTrace:traceForward", async (r, t) => {
  try {
    return { success: !0, data: await I(t) };
  } catch (e) {
    return console.error("lotTrace:traceForward 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("lotTrace:traceBackward", async (r, t) => {
  try {
    return { success: !0, data: await Q(t) };
  } catch (e) {
    return console.error("lotTrace:traceBackward 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("lotTrace:buildTraceTree", async (r, t, e) => {
  try {
    return { success: !0, data: await Ie(t, e) };
  } catch (a) {
    return console.error("lotTrace:buildTraceTree 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("inspection:create", async (r, t) => {
  try {
    return { success: !0, data: await Qe(t) };
  } catch (e) {
    return console.error("inspection:create 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("inspection:getByLot", async (r, t) => {
  try {
    return { success: !0, data: await Ae(t) };
  } catch (e) {
    return console.error("inspection:getByLot 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("line:getAll", async () => {
  try {
    return { success: !0, data: await W() };
  } catch (r) {
    return console.error("line:getAll 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("line:getByProcess", async (r, t) => {
  try {
    return { success: !0, data: await qe(t) };
  } catch (e) {
    return console.error("line:getByProcess 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("sequence:getNext", async (r, t) => {
  try {
    return { success: !0, data: await q(t) };
  } catch (e) {
    return console.error("sequence:getNext 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("sequence:getNextBundle", async (r, t) => {
  try {
    return { success: !0, data: await M(t) };
  } catch (e) {
    return console.error("sequence:getNextBundle 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:create", async (r, t) => {
  try {
    return { success: !0, data: await Me(t) };
  } catch (e) {
    return console.error("bundle:create 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:addToBundle", async (r, t) => {
  try {
    return { success: !0, data: await Ce(t) };
  } catch (e) {
    return console.error("bundle:addToBundle 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:removeFromBundle", async (r, t) => {
  try {
    return { success: !0, data: await Be(t) };
  } catch (e) {
    return console.error("bundle:removeFromBundle 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:complete", async (r, t) => {
  try {
    return { success: !0, data: await _e(t) };
  } catch (e) {
    return console.error("bundle:complete 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:unbundle", async (r, t) => {
  try {
    return await Pe(t), { success: !0 };
  } catch (e) {
    return console.error("bundle:unbundle 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:delete", async (r, t) => {
  try {
    return await Te(t), { success: !0 };
  } catch (e) {
    return console.error("bundle:delete 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:getById", async (r, t) => {
  try {
    return { success: !0, data: await v(t) };
  } catch (e) {
    return console.error("bundle:getById 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:getByNo", async (r, t) => {
  try {
    return { success: !0, data: await Ee(t) };
  } catch (e) {
    return console.error("bundle:getByNo 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:getActive", async () => {
  try {
    return { success: !0, data: await De() };
  } catch (r) {
    return console.error("bundle:getActive 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("bundle:getAvailableLots", async (r, t) => {
  try {
    return { success: !0, data: await Oe(t) };
  } catch (e) {
    return console.error("bundle:getAvailableLots 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:createSet", async (r, t) => {
  try {
    return { success: !0, data: await Ue(t) };
  } catch (e) {
    return console.error("bundle:createSet 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("bundle:shipEntire", async (r, t) => {
  try {
    return { success: !0, data: await Re(t) };
  } catch (e) {
    return console.error("bundle:shipEntire 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("product:getAll", async () => {
  try {
    return { success: !0, data: await We() };
  } catch (r) {
    return console.error("product:getAll 오류:", r), { success: !1, error: String(r) };
  }
});
i.handle("product:getById", async (r, t) => {
  try {
    return { success: !0, data: await $e(t) };
  } catch (e) {
    return console.error("product:getById 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("product:create", async (r, t) => {
  try {
    return { success: !0, data: await Fe(t) };
  } catch (e) {
    return console.error("product:create 오류:", e), { success: !1, error: String(e) };
  }
});
i.handle("product:update", async (r, t, e) => {
  try {
    return { success: !0, data: await xe(t, e) };
  } catch (a) {
    return console.error("product:update 오류:", a), { success: !1, error: String(a) };
  }
});
i.handle("product:delete", async (r, t) => {
  try {
    return { success: !0, data: await Ve(t) };
  } catch (e) {
    return console.error("product:delete 오류:", e), { success: !1, error: String(e) };
  }
});
