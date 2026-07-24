import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/reports/date-range";
import { fetchSingleShopReportData } from "@/lib/reports/fetch-single-shop";
import { fetchAdminReportData, resolveSelectedBranch } from "@/lib/reports/fetch-admin";
import { buildSingleShopWorkbook, buildAdminWorkbook } from "@/lib/reports/build-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  if (profile.shop.isPlatformShop) return NextResponse.redirect(new URL("/admin", request.url));

  const sp = request.nextUrl.searchParams;
  const range = resolveRange({
    range: sp.get("range") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const supabase = await createClient();

  let buffer: ArrayBuffer;
  let scopeLabel: string;

  if (profile.inAdminOverview) {
    const ownedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    const selectedBranch = resolveSelectedBranch(sp.get("branch") ?? undefined, ownedShops);
    const data = await fetchAdminReportData(supabase, ownedShops, selectedBranch, range);
    scopeLabel =
      selectedBranch === "combined"
        ? "All branches (combined)"
        : (ownedShops.find((s) => s.shopId === selectedBranch)?.shopName ?? "Unknown branch");
    buffer = await buildAdminWorkbook(data, { scopeLabel, ...range, generatedAt: new Date() });
  } else {
    if (profile.role !== "owner") return NextResponse.redirect(new URL("/sell", request.url));
    const data = await fetchSingleShopReportData(supabase, profile.shopId, range);
    scopeLabel = profile.shop.name;
    buffer = await buildSingleShopWorkbook(data, { scopeLabel, ...range, generatedAt: new Date() });
  }

  const filename = buildExportFilename(scopeLabel, range);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function buildExportFilename(scopeLabel: string, range: { from: Date; to: Date }): string {
  const slug =
    scopeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "report";
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const lastIncluded = new Date(range.to.getTime() - 86400000);
  return `reports_${slug}_${day(range.from)}_to_${day(lastIncluded)}.xlsx`;
}
