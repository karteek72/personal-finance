const LONG_TERM_DAYS = 366;
const WASH_SALE_WINDOW_DAYS = 30;

export interface TaxLotInput {
  id: string;
  accountId: string;
  securityId: string;
  openDate: string;
  openTxnId?: string;
  quantityOpen: number;
  quantityRemaining: number;
  costPerUnit: number;
}

export interface TaxLotTxnInput {
  id: string;
  accountId: string;
  securityId: string;
  date: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  amount: number;
}

export interface RealizedLotMatch {
  lotId: string;
  openDate: string;
  quantity: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  isLongTerm: boolean;
}

export interface RealizedSaleResult {
  txnId: string;
  accountId: string;
  securityId: string;
  date: string;
  quantity: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  shortTermGain: number;
  longTermGain: number;
  matches: RealizedLotMatch[];
  washSale: boolean;
}

export interface FifoReplayResult {
  openLots: TaxLotInput[];
  realizedSales: RealizedSaleResult[];
}

export interface RealizedPlSummary {
  totalProceeds: number;
  totalCostBasis: number;
  totalGainLoss: number;
  shortTermGain: number;
  longTermGain: number;
  washSaleCount: number;
}

function daysBetween(from: string, to: string): number {
  const ms =
    Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

function lotKey(accountId: string, securityId: string): string {
  return `${accountId}:${securityId}`;
}

function sortTxns(a: TaxLotTxnInput, b: TaxLotTxnInput): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  if (a.type !== b.type) return a.type === "buy" ? -1 : 1;
  return a.id.localeCompare(b.id);
}

/** Replay buy/sell transactions with FIFO lot matching. */
export function replayFifoTaxLots(txns: TaxLotTxnInput[]): FifoReplayResult {
  const sorted = [...txns].sort(sortTxns);
  const openLotsByKey = new Map<string, TaxLotInput[]>();
  const realizedSales: RealizedSaleResult[] = [];
  let lotCounter = 0;

  for (const txn of sorted) {
    const key = lotKey(txn.accountId, txn.securityId);
    const lots = openLotsByKey.get(key) ?? [];

    if (txn.type === "buy") {
      const qty = Math.abs(txn.quantity);
      if (qty <= 0) continue;
      const costPerUnit =
        txn.price > 0 ? txn.price : Math.abs(txn.amount) / qty;
      lots.push({
        id: `lot-${(lotCounter += 1)}`,
        accountId: txn.accountId,
        securityId: txn.securityId,
        openDate: txn.date,
        openTxnId: txn.id,
        quantityOpen: qty,
        quantityRemaining: qty,
        costPerUnit,
      });
      openLotsByKey.set(key, lots);
      continue;
    }

    let remaining = Math.abs(txn.quantity);
    if (remaining <= 0) continue;

    const matches: RealizedLotMatch[] = [];
    let costBasis = 0;
    const sellPrice =
      txn.price > 0 ? txn.price : Math.abs(txn.amount) / remaining;

    while (remaining > 1e-8 && lots.length > 0) {
      const lot = lots[0];
      if (!lot) break;
      const consumed = Math.min(remaining, lot.quantityRemaining);
      const matchCost = consumed * lot.costPerUnit;
      const matchProceeds = consumed * sellPrice;
      const heldDays = daysBetween(lot.openDate, txn.date);
      matches.push({
        lotId: lot.id,
        openDate: lot.openDate,
        quantity: consumed,
        costBasis: matchCost,
        proceeds: matchProceeds,
        gainLoss: matchProceeds - matchCost,
        isLongTerm: heldDays >= LONG_TERM_DAYS,
      });
      costBasis += matchCost;
      lot.quantityRemaining -= consumed;
      remaining -= consumed;
      if (lot.quantityRemaining <= 1e-8) {
        lots.shift();
      }
    }

    const quantitySold = Math.abs(txn.quantity) - remaining;
    if (quantitySold <= 1e-8) continue;

    const proceeds = quantitySold * sellPrice;
    const gainLoss = proceeds - costBasis;
    let shortTermGain = 0;
    let longTermGain = 0;
    for (const match of matches) {
      if (match.isLongTerm) {
        longTermGain += match.gainLoss;
      } else {
        shortTermGain += match.gainLoss;
      }
    }

    realizedSales.push({
      txnId: txn.id,
      accountId: txn.accountId,
      securityId: txn.securityId,
      date: txn.date,
      quantity: quantitySold,
      proceeds,
      costBasis,
      gainLoss,
      shortTermGain,
      longTermGain,
      matches,
      washSale: false,
    });
    openLotsByKey.set(key, lots);
  }

  flagWashSales(sorted, realizedSales);

  const openLots = [...openLotsByKey.values()]
    .flat()
    .filter((lot) => lot.quantityRemaining > 1e-8);

  return { openLots, realizedSales };
}

function flagWashSales(
  txns: TaxLotTxnInput[],
  realizedSales: RealizedSaleResult[],
): void {
  const buysByKey = new Map<string, TaxLotTxnInput[]>();
  for (const txn of txns) {
    if (txn.type !== "buy") continue;
    const key = lotKey(txn.accountId, txn.securityId);
    const list = buysByKey.get(key) ?? [];
    list.push(txn);
    buysByKey.set(key, list);
  }

  for (const sale of realizedSales) {
    if (sale.gainLoss >= 0) continue;
    const key = lotKey(sale.accountId, sale.securityId);
    const buys = buysByKey.get(key) ?? [];
    const hasRepurchase = buys.some((buy) => {
      const delta = Math.abs(daysBetween(sale.date, buy.date));
      return delta <= WASH_SALE_WINDOW_DAYS && buy.date !== sale.date;
    });
    if (hasRepurchase) {
      sale.washSale = true;
    }
  }
}

/** Aggregate realized P/L for sales within [from, to]. */
export function summarizeRealizedPl(
  sales: RealizedSaleResult[],
  from: string,
  to: string,
): RealizedPlSummary {
  let totalProceeds = 0;
  let totalCostBasis = 0;
  let shortTermGain = 0;
  let longTermGain = 0;
  let washSaleCount = 0;

  for (const sale of sales) {
    if (sale.date < from || sale.date > to) continue;
    totalProceeds += sale.proceeds;
    totalCostBasis += sale.costBasis;
    shortTermGain += sale.shortTermGain;
    longTermGain += sale.longTermGain;
    if (sale.washSale) washSaleCount += 1;
  }

  return {
    totalProceeds,
    totalCostBasis,
    totalGainLoss: totalProceeds - totalCostBasis,
    shortTermGain,
    longTermGain,
    washSaleCount,
  };
}

/** Unrealized P/L from open lots and current prices. */
export function computeUnrealizedPl(
  lots: TaxLotInput[],
  currentPriceBySecurity: Map<string, number>,
): {
  totalCostBasis: number;
  totalMarketValue: number;
  totalUnrealizedGain: number;
} {
  let totalCostBasis = 0;
  let totalMarketValue = 0;

  for (const lot of lots) {
    const price = currentPriceBySecurity.get(lot.securityId) ?? lot.costPerUnit;
    const cost = lot.quantityRemaining * lot.costPerUnit;
    const market = lot.quantityRemaining * price;
    totalCostBasis += cost;
    totalMarketValue += market;
  }

  return {
    totalCostBasis,
    totalMarketValue,
    totalUnrealizedGain: totalMarketValue - totalCostBasis,
  };
}
