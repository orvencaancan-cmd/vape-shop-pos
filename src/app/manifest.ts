import type { MetadataRoute } from "next";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Reading the session here (via cookies) makes this manifest
  // request-time/dynamic rather than statically cached, which is what
  // lets a logged-in shop's own logo become their "Add to Home Screen"
  // icon instead of everyone getting the same default icon.
  const profile = await getCurrentProfile();

  const name = profile?.shop.name ?? "VapeStock";
  const themeColor = profile?.shop.primaryColor || "#1f5c96";

  const icons: MetadataRoute.Manifest["icons"] = profile?.shop.logoUrl
    ? [
        { src: profile.shop.logoUrl, sizes: "192x192", type: "image/png" },
        { src: profile.shop.logoUrl, sizes: "512x512", type: "image/png" },
      ]
    : [{ src: "/icon-default.svg", sizes: "any", type: "image/svg+xml" }];

  return {
    name: `${name} — POS & Inventory`,
    short_name: name,
    description: "Point of sale and inventory management.",
    start_url: profile ? "/sell" : "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: themeColor,
    icons,
  };
}
