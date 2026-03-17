import { useEffect } from "react";
import { useLocation } from "wouter";

export function usePageTracking() {
  const [location] = useLocation();

  useEffect(() => {
    // Skip tracking for auth pages and static assets
    if (location.startsWith("/login") || location.startsWith("/auth")) return;

    const pageTitle = document.title?.replace(" | Córtex", "").trim() || "";

    fetch("/api/track/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path: location, pageTitle }),
    }).catch(() => {}); // fire-and-forget
  }, [location]);
}
