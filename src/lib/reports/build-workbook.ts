import ExcelJS from "exceljs";
import type { RangePreset } from "./date-range";
import type { SingleShopReportData } from "./fetch-single-shop";
import type { AdminReportData } from "./fetch-admin";

const CURRENCY_FMT = '"₱"#,##0.00';
const INT_FMT = "#,##0";

export type WorkbookContext = {
  scopeLabel: string;
  from: Date;
  to: Date;
  preset: RangePreset;
  generatedAt: Date;
};

/** The subset of report data shared between the single-shop and admin
 * (combined/per-branch) reports -- everything except the inventory-side
 * metrics, which are structured differently between the two (single object
 * vs. one per branch). */
type SalesSideReportData = Pick<
  SingleShopReportData,
  | "salesSummary"
  | "paymentBreakdown"
  | "discounts"
  | "saleDiscounts"
  | "loyaltySummary"
  | "salesDetail"
  | "revenueProfit"
  | "bestSellers"
  | "byCategory"
  | "byNicotine"
  | "supplierActivity"
  | "staffActivity"
  | "expenses"
  | "expenseSummary"
>;

function formatRangeLabel(from: Date, to: Date): string {
  const lastIncluded = new Date(to.getTime() - 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(from)} to ${fmt(lastIncluded)}`;
}

function addOverviewSheet(wb: ExcelJS.Workbook, ctx: WorkbookContext) {
  const sheet = wb.addWorksheet("Overview");
  sheet.columns = [{ width: 18 }, { width: 40 }];
  sheet.addRow(["Scope", ctx.scopeLabel]);
  sheet.addRow(["Date range", formatRangeLabel(ctx.from, ctx.to)]);
  sheet.addRow(["Generated at", ctx.generatedAt.toISOString()]);
  sheet.getColumn(1).font = { bold: true };
}

function addKeyValueSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: [string, number, "currency" | "int"][],
) {
  const sheet = wb.addWorksheet(name);
  sheet.columns = [{ header: "Metric", width: 24 }, { header: "Value", width: 20 }];
  sheet.getRow(1).font = { bold: true };
  for (const [label, value, kind] of rows) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = kind === "currency" ? CURRENCY_FMT : INT_FMT;
  }
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; width: number; numFmt?: string }[],
  rows: (string | number)[][],
) {
  const sheet = wb.addWorksheet(name);
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(rows);
  columns.forEach((c, i) => {
    if (c.numFmt) sheet.getColumn(i + 1).numFmt = c.numFmt;
  });
}

function addSalesByCategorySheet(wb: ExcelJS.Workbook, data: SalesSideReportData) {
  const sheet = wb.addWorksheet("Sales by Category");
  sheet.columns = [{ header: "Category", width: 20 }, { header: "Revenue", width: 16 }];
  sheet.getRow(1).font = { bold: true };
  for (const c of data.byCategory) {
    sheet.addRow([c.category, c.revenue]).getCell(2).numFmt = CURRENCY_FMT;
  }
  if (data.byNicotine.length > 0) {
    sheet.addRow([]);
    sheet.addRow(["E-juice by Nicotine Strength"]).font = { bold: true };
    sheet.addRow(["Strength", "Revenue"]).font = { bold: true };
    for (const n of data.byNicotine) {
      sheet.addRow([n.mg, n.revenue]).getCell(2).numFmt = CURRENCY_FMT;
    }
  }
}

function addSalesSheets(wb: ExcelJS.Workbook, data: SalesSideReportData) {
  addKeyValueSheet(wb, "Sales Summary", [
    ["Sales count", data.salesSummary.count, "int"],
    ["Cash", data.paymentBreakdown.cash, "currency"],
    ["GCash", data.paymentBreakdown.gcash, "currency"],
    ["Total", data.salesSummary.revenue, "currency"],
  ]);

  addKeyValueSheet(wb, "Revenue & Profit", [
    ["Revenue", data.revenueProfit.revenue, "currency"],
    ["Discounts", data.discounts.total, "currency"],
    ["Discount promo", data.saleDiscounts.total, "currency"],
    ["Cost of goods", data.revenueProfit.cost, "currency"],
    ["Expenses", data.expenseSummary.total, "currency"],
    [
      "Profit",
      data.revenueProfit.revenue -
        data.discounts.total -
        data.saleDiscounts.total -
        data.revenueProfit.cost -
        data.expenseSummary.total,
      "currency",
    ],
  ]);

  addKeyValueSheet(wb, "Loyalty", [
    ["Credit earned", data.loyaltySummary.earned, "currency"],
    ["Credit redeemed", data.loyaltySummary.redeemed, "currency"],
    ["Credit forfeited", data.loyaltySummary.forfeited, "currency"],
  ]);

  addTableSheet(
    wb,
    "Best Sellers",
    [
      { header: "Product", width: 30 },
      { header: "Variant", width: 26 },
      { header: "Quantity Sold", width: 14, numFmt: INT_FMT },
      { header: "Revenue", width: 16, numFmt: CURRENCY_FMT },
    ],
    data.bestSellers.map((b) => [b.productName, b.label, b.quantity, b.revenue]),
  );

  addTableSheet(
    wb,
    "Sales Detail",
    [
      { header: "Date/Time", width: 20 },
      { header: "Payment Method", width: 14 },
      { header: "Brand", width: 20 },
      { header: "Product", width: 26 },
      { header: "Variant", width: 26 },
      { header: "Quantity", width: 10, numFmt: INT_FMT },
      { header: "Unit Price", width: 14, numFmt: CURRENCY_FMT },
      { header: "Line Total", width: 14, numFmt: CURRENCY_FMT },
      { header: "Sale Total", width: 14, numFmt: CURRENCY_FMT },
      { header: "Notes", width: 30 },
    ],
    data.salesDetail.flatMap((s) =>
      s.lines.map((line) => [
        new Date(s.createdAt).toLocaleString(),
        s.paymentMethod,
        line.brand ?? "",
        line.productName,
        line.label,
        line.quantity,
        line.unitPrice,
        line.lineTotal,
        s.total,
        s.note,
      ]),
    ),
  );

  addSalesByCategorySheet(wb, data);

  addTableSheet(
    wb,
    "Supplier Activity",
    [
      { header: "Supplier", width: 26 },
      { header: "Quantity Received", width: 18, numFmt: INT_FMT },
      { header: "Cost", width: 16, numFmt: CURRENCY_FMT },
    ],
    data.supplierActivity.map((s) => [s.name, s.quantity, s.cost]),
  );

  addTableSheet(
    wb,
    "Expenses",
    [
      { header: "Date", width: 14 },
      { header: "Category", width: 22 },
      { header: "Note", width: 30 },
      { header: "Amount", width: 16, numFmt: CURRENCY_FMT },
    ],
    data.expenses.map((e) => [
      new Date(e.createdAt).toLocaleDateString(),
      e.category,
      e.note ?? "",
      e.amount,
    ]),
  );

  addTableSheet(
    wb,
    "Staff Activity",
    [
      { header: "Staff", width: 22 },
      { header: "Sales", width: 10, numFmt: INT_FMT },
      { header: "Voided", width: 10, numFmt: INT_FMT },
      { header: "Average Sale", width: 14, numFmt: CURRENCY_FMT },
      { header: "Revenue", width: 16, numFmt: CURRENCY_FMT },
    ],
    data.staffActivity.map((s) => [s.name, s.count, s.voidedCount, s.averageSale, s.revenue]),
  );
}

export async function buildSingleShopWorkbook(
  data: SingleShopReportData,
  ctx: WorkbookContext,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VapeStock";
  wb.created = ctx.generatedAt;

  addOverviewSheet(wb, ctx);
  addSalesSheets(wb, data);

  addTableSheet(
    wb,
    "Low Stock",
    [
      { header: "Product", width: 30 },
      { header: "Variant", width: 26 },
      { header: "Stock Qty", width: 12, numFmt: INT_FMT },
      { header: "Threshold", width: 12, numFmt: INT_FMT },
    ],
    data.lowStock.map((v) => [v.productName, v.label, v.stockQty, v.threshold]),
  );

  addTableSheet(
    wb,
    "Slow Movers",
    [
      { header: "Product", width: 30 },
      { header: "Variant", width: 26 },
      { header: "Quantity Sold", width: 14, numFmt: INT_FMT },
      { header: "Stock Qty", width: 12, numFmt: INT_FMT },
    ],
    data.slowMovers.map((v) => [v.productName, v.label, v.quantitySold, v.stockQty]),
  );

  const invSheet = wb.addWorksheet("Inventory Value");
  invSheet.columns = [{ header: "Category", width: 20 }, { header: "Value", width: 16 }];
  invSheet.getRow(1).font = { bold: true };
  const totalRow = invSheet.addRow(["Total", data.inventoryValue.total]);
  totalRow.font = { bold: true };
  totalRow.getCell(2).numFmt = CURRENCY_FMT;
  for (const c of data.inventoryValue.byCategory) {
    invSheet.addRow([c.category, c.value]).getCell(2).numFmt = CURRENCY_FMT;
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function buildAdminWorkbook(
  data: AdminReportData,
  ctx: WorkbookContext,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VapeStock";
  wb.created = ctx.generatedAt;

  addOverviewSheet(wb, ctx);
  addSalesSheets(wb, data);

  // Inventory sheets are never blended across branches -- every row still
  // traces to exactly one branch with exactly the number compute.ts
  // produced for it. One sheet per metric with a Branch column (rather
  // than one sheet per branch) keeps the tab count fixed regardless of how
  // many branches the owner has, and lets a bookkeeper filter/sort a
  // single sheet by branch instead of hunting across many similarly-named
  // tabs.
  addTableSheet(
    wb,
    "Low Stock",
    [
      { header: "Branch", width: 22 },
      { header: "Product", width: 30 },
      { header: "Variant", width: 26 },
      { header: "Stock Qty", width: 12, numFmt: INT_FMT },
      { header: "Threshold", width: 12, numFmt: INT_FMT },
    ],
    data.inventoryPerBranch.flatMap((b) =>
      b.lowStock.map((v) => [b.shopName, v.productName, v.label, v.stockQty, v.threshold]),
    ),
  );

  addTableSheet(
    wb,
    "Slow Movers",
    [
      { header: "Branch", width: 22 },
      { header: "Product", width: 30 },
      { header: "Variant", width: 26 },
      { header: "Quantity Sold", width: 14, numFmt: INT_FMT },
      { header: "Stock Qty", width: 12, numFmt: INT_FMT },
    ],
    data.inventoryPerBranch.flatMap((b) =>
      b.slowMovers.map((v) => [b.shopName, v.productName, v.label, v.quantitySold, v.stockQty]),
    ),
  );

  const invSheet = wb.addWorksheet("Inventory Value");
  invSheet.columns = [
    { header: "Branch", width: 22 },
    { header: "Category", width: 20 },
    { header: "Value", width: 16 },
  ];
  invSheet.getRow(1).font = { bold: true };
  for (const b of data.inventoryPerBranch) {
    const totalRow = invSheet.addRow([b.shopName, "Total", b.inventoryValue.total]);
    totalRow.font = { bold: true };
    totalRow.getCell(3).numFmt = CURRENCY_FMT;
    for (const c of b.inventoryValue.byCategory) {
      invSheet.addRow([b.shopName, c.category, c.value]).getCell(3).numFmt = CURRENCY_FMT;
    }
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
