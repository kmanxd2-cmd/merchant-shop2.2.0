/**
 * Merchant Shop v2.2.0 - Standalone
 * Foundry VTT v14 + D&D 5e 5.3.3
 *
 * No external module dependencies.
 * The shop owns its own pricing, stock, currency and transfer logic.
 */

const MODULE_ID = "merchant-shop";
const MODULE_VERSION = "2.2.0";
const FLAG_MERCHANT = "merchant";
const FLAG_FOR_SALE = "forSale";
const SELLABLE_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
const DEFAULT_CURRENCY = "gp";

let currentShopDialog = null;

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing v${MODULE_VERSION} (standalone)`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready v${MODULE_VERSION}`, {
    foundry: game.version,
    system: game.system.id,
    systemVersion: game.system.version
  });

  if (game.system.id !== "dnd5e") {
    ui.notifications.error("Merchant Shop ต้องใช้กับระบบ D&D 5e");
  }
});

Hooks.on("renderTokenHUD", (app, html) => {
  if (!game.user.isGM) return;

  const token = app.object;
  const actor = token?.actor;
  if (!actor) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  const rightCol = root?.querySelector(".col.right");
  if (!rightCol || rightCol.querySelector(".merchant-shop-toggle")) return;

  const merchantBtn = document.createElement("div");
  merchantBtn.className = "control-icon merchant-shop-toggle";
  merchantBtn.dataset.tooltip = "ตั้ง/ยกเลิกพ่อค้า";
  merchantBtn.innerHTML = `<i class="fas fa-store"></i>`;
  merchantBtn.classList.toggle("active", !!actor.getFlag(MODULE_ID, FLAG_MERCHANT));
  merchantBtn.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const enabled = !actor.getFlag(MODULE_ID, FLAG_MERCHANT);
      await actor.setFlag(MODULE_ID, FLAG_MERCHANT, enabled);
      merchantBtn.classList.toggle("active", enabled);
      ui.notifications.info(`${actor.name}: ${enabled ? "เปิดเป็นร้านค้าแล้ว" : "ยกเลิกสถานะร้านค้าแล้ว"}`);
    } catch (error) {
      console.error(`${MODULE_ID} | Merchant flag update failed`, error);
      ui.notifications.error(`เปลี่ยนสถานะร้านค้าไม่สำเร็จ: ${friendlyError(error)}`);
    }
  });

  const manageBtn = document.createElement("div");
  manageBtn.className = "control-icon merchant-shop-manage";
  manageBtn.dataset.tooltip = "จัดการสินค้าในร้าน";
  manageBtn.innerHTML = `<i class="fas fa-boxes-stacked"></i>`;
  manageBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openManageShop(actor);
  });

  rightCol.append(merchantBtn, manageBtn);
});

Hooks.on("controlToken", (token, controlled) => {
  if (!controlled) return;

  const actor = token?.actor;
  if (!actor?.getFlag(MODULE_ID, FLAG_MERCHANT)) return;
  if (game.user.isGM && isShiftDown()) return;

  openShop(actor);
});

function isShiftDown() {
  return !!game.keyboard?.isModifierActive?.("SHIFT");
}

function resolveBuyerActor() {
  const user = game.user;
  if (!user) return null;
  if (user.character) return user.character;

  const owned = game.actors?.contents?.filter(actor => actor.type === "character" && actor.isOwner) ?? [];
  return owned.find(actor => actor.getActiveTokens?.(true, true)?.length) ?? owned[0] ?? null;
}

function resolveActorDocument(actorOrToken) {
  if (!actorOrToken) return null;
  if (actorOrToken.documentName === "Actor") return actorOrToken;
  if (actorOrToken.actor?.documentName === "Actor") return actorOrToken.actor;
  if (actorOrToken.object?.documentName === "Actor") return actorOrToken.object;
  return actorOrToken;
}

async function openManageShop(merchant) {
  const seller = resolveActorDocument(merchant);
  if (!seller) return;

  const items = seller.items.contents.filter(item => SELLABLE_TYPES.includes(item.type));
  const rows = items.map(item => {
    const price = getPrice(item);
    const forSale = item.getFlag(MODULE_ID, FLAG_FOR_SALE) !== false;

    return `<label class="ms-manage-item">
      <input type="checkbox" class="ms-manage-check" data-item-id="${escapeAttr(item.id)}" ${forSale ? "checked" : ""}>
      <img src="${escapeAttr(item.img || "icons/svg/item-bag.svg")}" alt="">
      <div class="ms-item-main">
        <div class="ms-item-name">${escapeHtml(item.name)}</div>
        <div class="ms-item-meta">${escapeHtml(price.text)} · ${formatStock(item)}</div>
      </div>
    </label>`;
  }).join("");

  const content = `<div class="merchant-shop merchant-shop-manage-dialog">
    <p>ติ๊กถูก = ขายในร้าน, ติ๊กออก = ไม่ขาย</p>
    <div class="ms-items">${rows || '<div class="ms-empty">ยังไม่มีสินค้าที่รองรับ</div>'}</div>
  </div>`;

  const { DialogV2 } = foundry.applications.api;
  const dialog = new DialogV2({
    window: { title: `${seller.name} — จัดการสินค้า`, frame: true },
    classes: ["merchant-shop-dialog"],
    content,
    buttons: [{ action: "close", label: "ปิด", icon: "fas fa-times" }]
  });

  await dialog.render({ force: true });
  const root = getDialogContentRoot(dialog);
  if (!root) return;

  root.addEventListener("change", async event => {
    const checkbox = event.target?.closest?.(".ms-manage-check");
    if (!checkbox) return;

    try {
      const liveSeller = resolveActorDocument(seller);
      const item = liveSeller?.items.get(checkbox.dataset.itemId);
      if (!item) throw new Error("ไม่พบสินค้า");
      await item.setFlag(MODULE_ID, FLAG_FOR_SALE, checkbox.checked);
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      console.error(`${MODULE_ID} | forSale flag update failed`, error);
      ui.notifications.error(`บันทึกสถานะสินค้าไม่สำเร็จ: ${friendlyError(error)}`);
    }
  });
}

async function openShop(merchant) {
  const seller = resolveActorDocument(merchant);
  if (!seller) return;

  if (currentShopDialog) {
    await currentShopDialog.close({ animate: false }).catch(() => {});
    currentShopDialog = null;
  }

  const content = `<div class="merchant-shop" data-merchant-uuid="${escapeAttr(seller.uuid)}">
    <div class="ms-header">
      <div>
        <h2>${escapeHtml(seller.name)}</h2>
        <p>รายการสินค้าของพ่อค้า</p>
      </div>
      <div class="ms-wallet"><i class="fas fa-wallet"></i> ${escapeHtml(formatBuyerFunds())}</div>
    </div>
    <div class="ms-search-wrap">
      <input type="search" class="ms-search" placeholder="ค้นหาสินค้า..." autocomplete="off">
    </div>
    <div class="ms-items">${renderShopItems(seller)}</div>
  </div>`;

  const { DialogV2 } = foundry.applications.api;
  const dialog = new DialogV2({
    window: { title: `${seller.name} — ร้านค้า`, frame: true },
    classes: ["merchant-shop-dialog"],
    content,
    buttons: [{ action: "close", label: "ปิด", icon: "fas fa-times" }]
  });

  currentShopDialog = dialog;
  await dialog.render({ force: true });
  bindShopEvents(dialog, seller);
}

function renderShopItems(seller) {
  const buyer = resolveBuyerActor();
  // แสดงสินค้าทั้งหมดที่เปิดขายและยังมี stock โดยไม่กรองตามจำนวนเงินของผู้ซื้อ
  // ผู้เล่นควรเห็นราคาเพื่อรวมเงิน/แบ่งกันซื้อได้ และระบบจะตรวจยอดเงินจริงอีกครั้งตอนกดซื้อ
  const items = seller.items.contents.filter(item => {
    if (!SELLABLE_TYPES.includes(item.type)) return false;
    if (item.getFlag(MODULE_ID, FLAG_FOR_SALE) === false) return false;
    return getStockQuantity(item) > 0;
  });

  return items.length ? items.map(item => itemRow(item, buyer)).join("") : '<div class="ms-empty">ร้านค้านี้ยังไม่มีสินค้าที่ซื้อได้</div>';
}

function itemRow(item, buyer) {
  const price = getPrice(item);
  const stock = getStockQuantity(item);
  // อย่าปิดปุ่มเพราะเงินไม่พอ: ให้ผู้เล่นเห็นและลองซื้อได้ ระบบจะตรวจเงินจริงใน transaction อีกครั้ง
  const canBuy = stock > 0;
  const insufficientFunds = !!buyer && !price.free && !canAfford(buyer, price);
  const reason = !buyer ? "ไม่พบตัวละครผู้ซื้อ" : stock < 1 ? "สินค้าหมด" : (insufficientFunds ? "เงินไม่พอ — สามารถรวมเงินกันแล้วซื้อได้" : "");
  const buttonClass = insufficientFunds ? "ms-buy ms-buy-funds-low" : "ms-buy";
  const label = insufficientFunds ? "ซื้อ (เงินไม่พอ)" : "ซื้อ";

  return `<div class="ms-item" data-item-id="${escapeAttr(item.id)}">
    <img src="${escapeAttr(item.img || "icons/svg/item-bag.svg")}" alt="">
    <div class="ms-item-main">
      <div class="ms-item-name">${escapeHtml(item.name)}</div>
      <div class="ms-item-meta">${escapeHtml(price.text)} · ${escapeHtml(formatStock(item))}</div>
    </div>
    <button type="button" class="${buttonClass}" data-item-id="${escapeAttr(item.id)}" ${canBuy ? "" : "disabled"} title="${escapeAttr(reason)}">
      <i class="fas fa-shopping-cart"></i> ${label}
    </button>
  </div>`;
}

function bindShopEvents(dialog, merchant) {
  const root = getDialogContentRoot(dialog);
  if (!root) return;

  root.addEventListener("click", async event => {
    const button = event.target?.closest?.(".ms-buy");
    if (!button || !root.contains(button) || button.disabled || button.dataset.busy === "true") return;

    event.preventDefault();
    event.stopPropagation();

    const itemId = button.dataset.itemId;
    const seller = resolveActorDocument(merchant);
    const item = seller?.items.get(itemId);
    if (!item) {
      ui.notifications.error("ไม่พบสินค้าในร้านแล้ว — ลองเปิดร้านใหม่");
      return;
    }

    button.dataset.busy = "true";
    button.disabled = true;
    button.classList.add("is-busy");

    try {
      const purchased = await purchaseItem(seller, item);
      if (!purchased) return;

      ui.notifications.info(`ซื้อ ${item.name} สำเร็จ`);
      await dialog.close({ animate: false }).catch(() => {});
      if (currentShopDialog === dialog) currentShopDialog = null;
      await openShop(resolveActorDocument(seller) ?? seller);
    } catch (error) {
      console.error(`${MODULE_ID} | Purchase failed`, error);
      ui.notifications.error(`ซื้อ ${item.name} ไม่สำเร็จ: ${friendlyError(error)}`);
    } finally {
      if (button.isConnected) {
        button.dataset.busy = "false";
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    }
  });

  root.addEventListener("input", event => {
    const search = event.target?.closest?.(".ms-search");
    if (!search || !root.contains(search)) return;

    const query = String(search.value ?? "").trim().toLowerCase();
    root.querySelectorAll(".ms-item").forEach(row => {
      const name = row.querySelector(".ms-item-name")?.textContent?.toLowerCase() ?? "";
      row.hidden = !!query && !name.includes(query);
    });
  });
}

async function purchaseItem(seller, item) {
  const liveSeller = resolveActorDocument(seller);
  const buyer = resolveBuyerActor();
  if (!liveSeller) throw new Error("ไม่พบ Actor ของพ่อค้า");
  if (!buyer) throw new Error("ไม่พบตัวละครของผู้ซื้อ — ตั้ง User > Character ก่อน");

  const liveItem = liveSeller.items.get(item.id);
  if (!liveItem) throw new Error("สินค้านี้ถูกขายหมดหรือถูกลบไปแล้ว");
  if (liveItem.getFlag(MODULE_ID, FLAG_FOR_SALE) === false) throw new Error("สินค้านี้ไม่ได้เปิดขายแล้ว");

  const quantity = 1;
  const price = getPrice(liveItem);
  const stock = getStockQuantity(liveItem);

  if (stock < quantity) throw new Error("สินค้าหมดแล้ว");
  if (!price.free && !canAfford(buyer, price)) {
    throw new Error(`เงินไม่พอ: ต้องใช้ ${price.total} ${price.denomination.toUpperCase()}`);
  }

  const confirmed = await confirmPurchase(liveItem, price, quantity);
  if (confirmed !== true) return false;

  return executeStandaloneTransaction(liveSeller, buyer, liveItem, price, quantity);
}

async function executeStandaloneTransaction(seller, buyer, item, price, quantity) {
  const denom = price.denomination;
  const buyerBefore = getCurrencyAmount(buyer, denom);
  const sellerBefore = getCurrencyAmount(seller, denom);
  const total = price.free ? 0 : price.total * quantity;

  if (buyerBefore < total) throw new Error("เงินของผู้ซื้อไม่เพียงพอ");

  const sourceQuantity = getStockQuantity(item);
  if (sourceQuantity < quantity) throw new Error("สินค้าของพ่อค้าไม่เพียงพอ");

  const existing = findMergeTarget(buyer, item);
  const oldBuyerQuantity = existing ? getItemQuantity(existing) : null;
  const oldSellerQuantity = getItemQuantity(item);
  const buyerWasCreated = !existing;
  let createdBuyerItem = null;
  let buyerCurrencyChanged = false;
  let sellerCurrencyChanged = false;
  let sellerItemChanged = false;

  try {
    if (existing) {
      await existing.update({ "system.quantity": oldBuyerQuantity + quantity });
    } else {
      const data = item.toObject();
      delete data._id;
      if (hasQuantityField(data)) data.system.quantity = quantity;
      createdBuyerItem = (await buyer.createEmbeddedDocuments("Item", [data]))?.[0] ?? null;
      if (!createdBuyerItem) throw new Error("สร้างไอเทมให้ผู้ซื้อไม่สำเร็จ");
    }

    if (oldSellerQuantity <= quantity) {
      await seller.deleteEmbeddedDocuments("Item", [item.id]);
    } else {
      await item.update({ "system.quantity": oldSellerQuantity - quantity });
    }
    sellerItemChanged = true;

    if (total > 0) {
      await buyer.update({ [`system.currency.${denom}`]: buyerBefore - total });
      buyerCurrencyChanged = true;
      await seller.update({ [`system.currency.${denom}`]: sellerBefore + total });
      sellerCurrencyChanged = true;
    }

    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Transaction failed, attempting rollback`, error);

    if (sellerCurrencyChanged) {
      try { await seller.update({ [`system.currency.${denom}`]: sellerBefore }); } catch (rollbackError) { console.error(`${MODULE_ID} | Seller currency rollback failed`, rollbackError); }
    }
    if (buyerCurrencyChanged) {
      try { await buyer.update({ [`system.currency.${denom}`]: buyerBefore }); } catch (rollbackError) { console.error(`${MODULE_ID} | Buyer currency rollback failed`, rollbackError); }
    }
    if (sellerItemChanged) {
      try {
        const refreshedSellerItem = seller.items.get(item.id);
        if (refreshedSellerItem) {
          await refreshedSellerItem.update({ "system.quantity": oldSellerQuantity });
        } else {
          const restored = item.toObject();
          restored._id = item.id;
          if (hasQuantityField(restored)) restored.system.quantity = oldSellerQuantity;
          await seller.createEmbeddedDocuments("Item", [restored]);
        }
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Seller item rollback failed`, rollbackError);
      }
    }
    if (createdBuyerItem) {
      try { await buyer.deleteEmbeddedDocuments("Item", [createdBuyerItem.id]); } catch (rollbackError) { console.error(`${MODULE_ID} | Buyer item rollback failed`, rollbackError); }
    } else if (existing && oldBuyerQuantity !== null) {
      try { await existing.update({ "system.quantity": oldBuyerQuantity }); } catch (rollbackError) { console.error(`${MODULE_ID} | Buyer quantity rollback failed`, rollbackError); }
    }

    throw error;
  }
}

function findMergeTarget(buyer, item) {
  return buyer.items.find(existing => existing.type === item.type && existing.name === item.name) ?? null;
}

function getItemQuantity(item) {
  const value = Number(item?.system?.quantity);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function hasQuantityField(data) {
  return Object.prototype.hasOwnProperty.call(data?.system ?? {}, "quantity");
}

function getStockQuantity(item) {
  return getItemQuantity(item);
}

function formatStock(item) {
  const quantity = getStockQuantity(item);
  return quantity === 1 ? "เหลือ 1" : `เหลือ ${formatNumber(quantity)}`;
}

function getPrice(item) {
  const raw = item?.system?.price ?? {};
  const value = Number(raw.value ?? 0);
  const denomination = normalizeDenomination(raw.denomination ?? DEFAULT_CURRENCY);
  const total = Number.isFinite(value) && value >= 0 ? value : 0;
  const free = total === 0;

  return {
    total,
    denomination,
    free,
    text: free ? "ฟรี" : `${formatNumber(total)} ${denomination.toUpperCase()}`
  };
}

function normalizeDenomination(value) {
  const raw = String(value ?? DEFAULT_CURRENCY).toLowerCase().trim();
  return ["cp", "sp", "ep", "gp", "pp"].includes(raw) ? raw : DEFAULT_CURRENCY;
}

function getCurrencyAmount(actor, denomination) {
  const value = Number(actor?.system?.currency?.[normalizeDenomination(denomination)] ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function canAfford(actor, price) {
  return price.free || getCurrencyAmount(actor, price.denomination) >= price.total;
}

function formatBuyerFunds() {
  const buyer = resolveBuyerActor();
  if (!buyer) return "ไม่พบผู้ซื้อ";
  const order = ["gp", "sp", "cp"];
  const parts = order
    .map(denom => `${formatNumber(getCurrencyAmount(buyer, denom))} ${denom.toUpperCase()}`)
    .filter(Boolean);
  return parts.join(" · ");
}

async function confirmPurchase(item, price, quantity) {
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.confirm({
    window: { title: "ยืนยันการซื้อ" },
    content: `<div class="ms-confirm">
      <img src="${escapeAttr(item.img || "icons/svg/item-bag.svg")}" alt="">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <div>จำนวน: ${quantity}</div>
        <div>ราคารวม: <b>${escapeHtml(price.text)}</b></div>
      </div>
    </div>`,
    yes: { label: "ซื้อ", icon: "fas fa-shopping-cart" },
    no: { label: "ยกเลิก", icon: "fas fa-times" }
  });
}

function getDialogContentRoot(dialog) {
  if (!dialog?.element) return null;
  return dialog.element.querySelector?.(".merchant-shop") ?? dialog.element;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function friendlyError(error) {
  return String(error?.message ?? error ?? "ไม่ทราบสาเหตุ");
}
