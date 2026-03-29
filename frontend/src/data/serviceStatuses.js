import { useState, useEffect, useCallback } from "react";
import { Cloud, Radio, Globe, Shield, Server } from "lucide-react";
import API_BASE from "@/apiBase";

const ICON_MAP = {
  "Cloud & CDN Services": Cloud,
  "Cellular Carriers": Radio,
  "Communication & Email": Globe,
  "Security & Auth": Shield,
  "Internal Services": Server,
};

// Fallback static data (used before first fetch)
const FALLBACK_CATEGORIES = [
  { category: "Cloud & CDN Services", type: "external", icon: Cloud, services: [
    { name: "Cloudflare", status: "operational", url: "https://www.cloudflarestatus.com", description: "CDN, DDoS Protection, DNS" },
    { name: "AWS", status: "operational", url: "https://health.aws.amazon.com/health/status", description: "Cloud Infrastructure" },
    { name: "Microsoft Azure", status: "operational", url: "https://status.azure.com", description: "Cloud Platform" },
    { name: "Google Cloud", status: "operational", url: "https://status.cloud.google.com", description: "Cloud Services" },
    { name: "MongoDB Atlas", status: "operational", url: "https://status.cloud.mongodb.com", description: "Database Hosting" },
  ]},
  { category: "Cellular Carriers", type: "external", icon: Radio, services: [
    { name: "AT&T", status: "operational", url: "https://downdetector.com/status/att/", description: "Cellular Network" },
    { name: "Verizon", status: "operational", url: "https://downdetector.com/status/verizon/", description: "Cellular Network" },
    { name: "T-Mobile", status: "operational", url: "https://downdetector.com/status/t-mobile/", description: "Cellular Network" },
    { name: "US Cellular", status: "operational", url: "https://downdetector.com/status/us-cellular/", description: "Cellular Network" },
  ]},
  { category: "Communication & Email", type: "external", icon: Globe, services: [
    { name: "Twilio", status: "operational", url: "https://status.twilio.com", description: "SMS & Voice" },
    { name: "SendGrid", status: "operational", url: "https://status.sendgrid.com", description: "Email Delivery" },
    { name: "Resend", status: "operational", url: "https://resend-status.com", description: "Email API" },
  ]},
  { category: "Security & Auth", type: "external", icon: Shield, services: [
    { name: "Auth0", status: "operational", url: "https://status.auth0.com", description: "Identity & Auth" },
    { name: "Let's Encrypt", status: "operational", url: "https://letsencrypt.status.io", description: "SSL Certificates" },
  ]},
  { category: "Internal Services", type: "internal", icon: Server, services: [
    { name: "Cardiac Solutions API", status: "operational", url: null, description: "Backend API Server" },
    { name: "Camera Ingest Pipeline", status: "operational", url: null, description: "Camera Data Processing" },
    { name: "Notification Engine", status: "operational", url: null, description: "Alert Dispatch System" },
    { name: "SSO Gateway", status: "operational", url: null, description: "Cross-Domain Auth" },
  ]},
];

export function useServiceStatuses(refreshInterval = 60000) {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/services/status`);
      if (!res.ok) return;
      const data = await res.json();
      const cats = (data.categories || []).map((cat) => ({
        ...cat,
        icon: ICON_MAP[cat.category] || Server,
      }));
      if (cats.length > 0) setCategories(cats);
      if (data.last_checked) setLastChecked(data.last_checked);
    } catch {
      // Keep existing data on error
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStatuses, refreshInterval]);

  return { categories, lastChecked, refetch: fetchStatuses };
}

// Compute LED color from service statuses
export function getLedColor(categories, type) {
  const filtered = categories.filter((c) => c.type === type);
  const services = filtered.flatMap((c) => c.services);
  const hasOutage = services.some((s) => s.status === "outage");
  const hasDegraded = services.some((s) => s.status === "degraded");
  const hasMaintenance = services.some((s) => s.status === "maintenance");
  if (hasOutage) return "red";
  if (hasDegraded) return "orange";
  if (hasMaintenance) return "yellow";
  return "green";
}

export const LED_STYLES = {
  green:  { bg: "#39ff14", shadow: "0 0 10px #39ff14, 0 0 22px rgba(57,255,20,0.6), 0 0 40px rgba(57,255,20,0.25)" },
  yellow: { bg: "#fbbf24", shadow: "0 0 10px #fbbf24, 0 0 22px rgba(251,191,36,0.6), 0 0 40px rgba(251,191,36,0.25)" },
  orange: { bg: "#f97316", shadow: "0 0 10px #f97316, 0 0 22px rgba(249,115,22,0.6), 0 0 40px rgba(249,115,22,0.25)" },
  red:    { bg: "#ff2244", shadow: "0 0 10px #ff2244, 0 0 22px rgba(255,34,68,0.6), 0 0 40px rgba(255,34,68,0.25)" },
};
