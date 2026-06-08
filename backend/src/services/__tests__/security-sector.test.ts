import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InvestmentPosition } from "../holdings-mapper.js";
import {
  computePortfolioAnalytics,
} from "../portfolio-analytics.js";
import {
  isOptionMetadataSector,
  buildPortfolioSectorHints,
  resolveGicsSector,
  resolveUnderlyingTicker,
} from "../security-sector.js";

function position(
  partial: Partial<InvestmentPosition> & Pick<InvestmentPosition, "ticker" | "value">,
): InvestmentPosition {
  return {
    holdingId: "h1",
    accountId: "a1",
    accountName: "Brokerage",
    institutionName: "Webull",
    accountMask: null,
    name: partial.ticker,
    sector: null,
    assetType: "equity",
    quantity: 1,
    costBasis: "100",
    currentPrice: "100",
    gainLoss: "0",
    gainLossPercent: 0,
    ...partial,
  };
}

describe("security-sector", () => {
  it("detects option metadata stored in sector", () => {
    assert.equal(
      isOptionMetadataSector("Call · AAPL · exp Jun 20, 2026"),
      true,
    );
    assert.equal(isOptionMetadataSector("Information Technology"), false);
  });

  it("maps equity tickers to GICS sectors", () => {
    const aapl = position({ ticker: "AAPL", value: "1000", assetType: "equity" });
    assert.equal(resolveGicsSector(aapl, new Map()), "Information Technology");
  });

  it("attributes options to underlying via sector metadata or OCC ticker", () => {
    const opt = position({
      ticker: "AAPL  260620C00220000",
      value: "500",
      assetType: "option",
      sector: "Call · AAPL · exp Jun 20, 2026",
      underlyingTicker: "AAPL",
      optionType: "Call",
    });
    assert.equal(resolveGicsSector(opt, new Map()), "Information Technology");
    assert.equal(resolveUnderlyingTicker(opt), "AAPL");
  });

  it("inherits sector from equity sibling in the same portfolio", () => {
    const equity = position({
      ticker: "HIMS",
      value: "1000",
      assetType: "equity",
    });
    const opt = position({
      ticker: "HIMS  270115C00020000",
      value: "200",
      assetType: "option",
      sector: "Call · HIMS · exp Jan 15, 2027",
    });
    const hints = buildPortfolioSectorHints([equity, opt], new Map());
    assert.equal(resolveGicsSector(opt, new Map(), hints), "Health Care");
  });

  it("classifies money market sweep funds", () => {
    const spaxx = position({ ticker: "SPAXX", value: "5000", assetType: "equity" });
    assert.equal(resolveGicsSector(spaxx, new Map()), "Cash & Money Market");
  });

  it("rolls up sector allocation by GICS, not option metadata", () => {
    const positions = [
      position({ ticker: "AAPL", value: "1000", assetType: "equity" }),
      position({
        ticker: "AAPL  260620C00220000",
        value: "200",
        assetType: "option",
        sector: "Call · AAPL · exp Jun 20, 2026",
        underlyingTicker: "AAPL",
      }),
      position({ ticker: "XOM", value: "800", assetType: "equity" }),
    ];
    const analytics = computePortfolioAnalytics(positions, 2000);
    const sectors = Object.fromEntries(
      analytics.sectorAllocation.map((s) => [s.sector, s.sharePercent]),
    );
    assert.equal(sectors["Information Technology"], 60);
    assert.equal(sectors["Energy"], 40);
    assert.equal(analytics.sectorAllocation.some((s) => s.sector.includes("Call ·")), false);
  });
});
