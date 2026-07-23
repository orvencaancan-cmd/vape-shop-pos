import { createClient } from "@/lib/supabase/server";

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
};

/** Server-side only: current user's profile + shop, or null if not signed in / no profile yet. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, shop_id, role, platform_admin, display_name, shops(id, name, subscription_status, logo_url, primary_color, suspended_at, is_platform_shop)",
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.shops) return null;

  const shop = Array.isArray(profile.shops) ? profile.shops[0] : profile.shops;

  return {
    id: profile.id,
    shopId: profile.shop_id,
    role: profile.role,
    platformAdmin: profile.platform_admin,
    displayName: profile.display_name,
    shop: {
      id: shop.id,
      name: shop.name,
      subscriptionStatus: shop.subscription_status,
      logoUrl: shop.logo_url,
      primaryColor: shop.primary_color,
      suspended: shop.suspended_at != null,
      isPlatformShop: shop.is_platform_shop,
    },
  };
}
