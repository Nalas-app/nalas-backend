const LEGACY_PLACEHOLDER_UNIT_PRICE = 500;
const MAX_SANE_UNIT_COST = 5000;

function toFiniteNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Math.round((toFiniteNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Computes deterministic per-base-unit ingredient cost from DB recipe rows.
 * Guards against corrupted unscaled batch imports (e.g. gram quantities priced as kg).
 */
function computeRecipeUnitCost(recipeRows = []) {
  if (!Array.isArray(recipeRows) || recipeRows.length === 0) {
    return 0;
  }

  let total = 0;
  for (const row of recipeRows) {
    const qty = toFiniteNumber(row.quantity_per_base_unit, 0);
    const wastage = toFiniteNumber(row.wastage_factor, 1.0) || 1.0;
    const unitPrice = toFiniteNumber(row.current_price_per_unit ?? row.cost_per_unit, 0);
    if (qty > 0 && unitPrice > 0) {
      total += qty * wastage * unitPrice;
    }
  }

  if (total <= 0 || total > MAX_SANE_UNIT_COST) {
    return 0;
  }

  return roundCurrency(total);
}

/**
 * Estimates realistic per-portion catering food cost when a menu item
 * has no priced recipe mapped in the database yet.
 */
function estimateDishUnitCost(item = {}) {
  const name = String(item.name || item.menu_item_name || '').toLowerCase();
  const category = String(item.category_name || item.category || '').toLowerCase();

  // 1. Non-veg & Biryani / Pulav / Fried Rice / Manchurian (check specific dish keywords first)
  if (name.includes('mutton') || name.includes('m varuval')) {
    if (name.includes('biryani') || name.includes('biriyani')) return 320;
    return 280;
  }
  if (name.includes('prawn') || name.includes('fish')) {
    return 260;
  }
  if (
    name.includes('chicken') ||
    name.includes('chi ') ||
    name.includes('chi&') ||
    name === 'kcf' ||
    name === 'c curry'
  ) {
    if (name.includes('biryani') || name.includes('biriyani')) return 220;
    return 180;
  }

  if (name.includes('biryani') || name.includes('biriyani') || category.includes('biryani')) {
    if (name.includes('paneer') || name.includes('mushroom') || name.includes('kaju')) return 165;
    return 140;
  }

  if (name.includes('pulav') || name.includes('pulao') || category.includes('pulav')) {
    if (
      name.includes('paneer') ||
      name.includes('nuts') ||
      name.includes('kashmiri') ||
      name.includes('navaratan') ||
      name.includes('mushroom')
    ) {
      return 145;
    }
    return 115;
  }

  if (name.includes('fried rice') || category.includes('fried rice')) {
    if (name.includes('paneer') || name.includes('schezwan') || name.includes('mushroom')) {
      return 135;
    }
    return 110;
  }

  if (name.includes('manchurian') || category.includes('manchurian')) {
    if (name.includes('paneer') || name.includes('mushroom') || name.includes('babycorn')) {
      return 135;
    }
    return 115;
  }

  // 2. Rich gravies / curries
  if (name.includes('paneer butter') || name.includes('panner butter') || name.includes('changezhi')) {
    return 150;
  }
  if (name.includes('ghee rice')) {
    return 110;
  }

  // 3. Sweets & Desserts
  if (
    category.includes('sweet') ||
    name.includes('kesari') ||
    name.includes('halwa') ||
    name.includes('jamun') ||
    name.includes('jelabi') ||
    name.includes('mysurpak') ||
    name.includes('laddu') ||
    name.includes('rasamalai') ||
    name.includes('rasmalai') ||
    name.includes('payasam') ||
    name.includes('rabadi') ||
    name.includes('katli') ||
    name.includes('peda') ||
    name.includes('sandesh') ||
    name.includes('bashandi') ||
    name.includes('malpuva')
  ) {
    if (
      name.includes('badam') ||
      name.includes('kaju') ||
      name.includes('pista') ||
      name.includes('mundri') ||
      name.includes('rasamalai') ||
      name.includes('rasmalai') ||
      name.includes('rabadi') ||
      name.includes('sandesh') ||
      name.includes('bashandi') ||
      name.includes('malai') ||
      name.includes('kavaniarisi')
    ) {
      return 60;
    }
    if (name.includes('halwa') || name.includes('mysurpak') || name.includes('laddu') || name.includes('payasam')) {
      return 40;
    }
    return 30;
  }

  // 4. Snacks (Vadai, Bonda, Cutlet)
  if (category.includes('snack') || name.includes('vadai') || name.includes('bonda') || name.includes('cutlet')) {
    if (name.includes('paneer')) return 55;
    if (name.includes('cutlet')) return 40;
    return 25;
  }

  // 5. Idli & Iddiyappam
  if (category.includes('idli') || name.includes('idli') || name.includes('iddiyappam')) {
    if (
      name.includes('elaneer') ||
      name.includes('sambar') ||
      name.includes('podi') ||
      name.includes('rava') ||
      name.includes('veg') ||
      name.includes('pepper') ||
      name.includes('curry leaf')
    ) {
      return 40;
    }
    return 30;
  }

  // 6. Dosa & Uthappam
  if (
    category.includes('dosa') ||
    category.includes('uthappam') ||
    name.includes('dosa') ||
    name.includes('uthappam')
  ) {
    if (name.includes('paneer') || name.includes('mushroom') || name.includes('butter')) {
      return 80;
    }
    if (name.includes('plain dosa')) {
      return 45;
    }
    return 60;
  }

  // 7. Chapati, Poori, Parotta
  if (category.includes('parotta') || name.includes('parotta')) {
    if (name.includes('chili') || name.includes('kothu')) return 95;
    return 45;
  }
  if (
    category.includes('chapati') ||
    category.includes('poori') ||
    name.includes('chapathi') ||
    name.includes('chapati') ||
    name.includes('poori')
  ) {
    if (name.includes('stuffed') || name.includes('masala') || name.includes('chola') || name.includes('palak')) {
      return 50;
    }
    return 40;
  }

  // 8. Pongal, Sevai, Upma, Kichadi
  if (
    category.includes('pongal') ||
    category.includes('sevai') ||
    name.includes('pongal') ||
    name.includes('sevai') ||
    name.includes('upma') ||
    name.includes('kichadi')
  ) {
    if (name.includes('sweet') || name.includes('kaalkandu') || name.includes('seeraka') || name.includes('ainthu')) {
      return 60;
    }
    return 45;
  }

  // 9. Variety Rice & Curd Rice
  if (category.includes('variety rice') || category.includes('curd rice') || name.includes('rice') || name.includes('semiya')) {
    if (name.includes('kalkandu') || name.includes('mango') || name.includes('peas') || name.includes('varagu') || name.includes('samai') || name.includes('kambu') || name.includes('kuthiraivali')) {
      return 80;
    }
    return 70;
  }

  // 10. Beverages, Chutneys, Sambar, Accompaniments
  if (name.includes('coffee') || name.includes('tea') || name.includes('chai') || name.includes('sukku') || name.includes('soda')) {
    return 25;
  }
  if (name.includes('chatni') || name.includes('chutney') || name.includes('rasam')) {
    return 20;
  }
  if (
    name.includes('sambar') ||
    name.includes('kuzhambu') ||
    name.includes('kuzhabu') ||
    name.includes('kulambhu') ||
    name.includes('poriyal') ||
    name.includes('kootu') ||
    name.includes('paruppu') ||
    name.includes('curry')
  ) {
    return 45;
  }

  return 100;
}

/**
 * Resolves the unit food cost for a menu/order item:
 * 1. Valid DB recipe unit cost (> 0 and <= MAX_SANE_UNIT_COST)
 * 2. Explicit client/stored unit_price (> 0, ignoring legacy 500 placeholder unless explicitly flagged)
 * 3. Category/item-based catering dish cost estimate
 */
function resolveDishUnitCost({
  item = {},
  recipeRows = [],
  explicitRequestPrice = undefined,
  ignoreLegacyPlaceholder = true
}) {
  const recipeUnitCost = computeRecipeUnitCost(recipeRows);
  if (recipeUnitCost > 0) {
    return { unitCost: recipeUnitCost, method: 'recipe_calculation' };
  }

  if (explicitRequestPrice !== undefined && explicitRequestPrice !== null) {
    const reqPrice = toFiniteNumber(explicitRequestPrice, 0);
    if (reqPrice > 0) {
      return { unitCost: roundCurrency(reqPrice), method: 'item_unit_price' };
    }
  }

  const storedPrice = toFiniteNumber(item.unit_price, 0);
  if (
    storedPrice > 0 &&
    (!ignoreLegacyPlaceholder || storedPrice !== LEGACY_PLACEHOLDER_UNIT_PRICE)
  ) {
    return { unitCost: roundCurrency(storedPrice), method: 'item_unit_price' };
  }

  return {
    unitCost: roundCurrency(estimateDishUnitCost(item)),
    method: 'dish_estimate'
  };
}

module.exports = {
  LEGACY_PLACEHOLDER_UNIT_PRICE,
  MAX_SANE_UNIT_COST,
  toFiniteNumber,
  roundCurrency,
  computeRecipeUnitCost,
  estimateDishUnitCost,
  resolveDishUnitCost
};
