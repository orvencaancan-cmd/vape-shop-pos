import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCY_FMT = '"₱"#,##0.00';

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  if (profile.shop.isPlatformShop) return NextResponse.redirect(new URL("/admin", request.url));
  if (!profile.inAdminOverview && profile.role !== "owner") {
    return NextResponse.redirect(new URL("/inventory", request.url));
  }

  const supabase = await createClient();
  // RLS (loyalty_customers_select -> is_member_of_owner_business) already
  // scopes this to the current login's own business -- no explicit
  // owner_user_id filter needed.
  const { data: customers } = await supabase
    .from("loyalty_customers")
    .select("name, phone, credit_balance")
    .order("name", { ascending: true, nullsFirst: false });

  const wb = new ExcelJS.Workbook();
  wb.creator = "VapeStock";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Customers");
  sheet.columns = [
    { header: "Name", width: 26 },
    { header: "Phone", width: 18 },
    { header: "Credit Balance", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of customers ?? []) {
    sheet.addRow([c.name ?? "", c.phone, Number(c.credit_balance)]).getCell(3).numFmt = CURRENCY_FMT;
  }

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customers_${day}.xlsx"`,
    },
  });
}
