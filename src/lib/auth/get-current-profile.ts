import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_SHOP_COOKIE = "active_shop_id";

export type ShopMembership = {
  profileId: string;
  shopId: string;
  shopName: string;
  role: "owner" | "staff";
};

export type CurrentProfile = {
  id: string;
  shopId: string;
  role: "owner" | "staff";
  platformAdmin: boolean;
  displayName: string | null;
  shop: {
    id: string;
    name: string;
    subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
    logoUrl: string | null;
    primaryColor: string | null;
    suspended: boolean;
    isPlatformShop: boolean;
  };
  /** Every shop this login has a membership at — for the shop switcher. */
  shops: ShopMembership[];
};

/**
 * Server-side only: current user's active profile + shop, or null if not
 * signed in / no membership yet. A login can belong to more than one
 * shop; the "active" one is resolved from the active_shop_id cookie
 * (falling back to the oldest membership if unset/stale) rather than
 * derived from a single row, since profiles is now a membership table.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("profiles")
    .select(
      "id, shop_id, role, platform_admin, display_name, shops(id, name, subscription_status, logo_url, primary_color, suspended_at, is_platform_shop)",
    )
    .eq("user_id", user.id)
    .order("created_at");

  if (!memberships || memberships.length === 0) return null;

  const cookieStore = await cookies();
  const activeShopId = cookieStore.get(ACTIVE_SHOP_COOKIE)?.value;

  const active = memberships.find((m) => m.shop_id === activeShopId) ?? memberships[0];
  if (!active.shops) return null;

  const activeShop = Array.isArray(active.shops) ? active.shops[0] : active.shops;

  const shops: ShopMembership[] = memberships.map((m) => {
    const s = Array.isArray(m.shops) ? m.shops[0] : m.shops;
    return {
      profileId: m.id,
      shopId: m.shop_id,
      shopName: s?.name ?? "",
      role: m.role,
    };
  });

  return {
    id: active.id,
    shopId: active.shop_id,
    role: active.role,
    platformAdmin: memberships.some((m) => m.platform_admin),
    displayName: active.display_name,
    shop: {
      id: activeShop.id,
      name: activeShop.name,
      subscriptionStatus: activeShop.subscription_status,
      logoUrl: activeShop.logo_url,
      primaryColor: activeShop.primary_color,
      suspended: activeShop.suspended_at != null,
      isPlatformShop: activeShop.is_platform_shop,
    },
    shops,
  };
}
