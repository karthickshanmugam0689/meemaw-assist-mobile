import { Paths } from "expo-file-system";

/**
 * Auto-diagnosis helpers. Two checks are shippable without a native-module
 * rebuild:
 *   - "diskSpace"      → via expo-file-system Paths.availableDiskSpace
 *   - "internetSpeed"  → download a 1 MB Cloudflare test file and time it
 *
 * Network type (WiFi/cellular) and battery level would need expo-network /
 * expo-battery and thus an EAS rebuild. Not in this pass.
 */

export type DiagnosticKey = "diskSpace" | "internetSpeed";

export const DIAGNOSTIC_KEYS: readonly DiagnosticKey[] = [
  "diskSpace",
  "internetSpeed",
];

export type DiskSpaceResult = {
  freeMB: number;
  totalMB: number;
  usedPct: number;
};

export type InternetSpeedResult = {
  mbps: number | null;
  error?: string;
};

export type DiagnosticResults = {
  diskSpace?: DiskSpaceResult;
  internetSpeed?: InternetSpeedResult;
};

/** Runtime toggle — set EXPO_PUBLIC_DIAGNOSTICS_ENABLED=0 to fully disable
 *  the feature without removing the schema field. */
export function isDiagnosticsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DIAGNOSTICS_ENABLED !== "0";
}

/** Simple text heuristic — fires when the user's own words make the intent
 *  obvious but the LLM forgot to set `diagnose`. Safety net only. */
const TRIGGER_RE =
  /\b(check my phone|whats wrong (with )?my phone|what'?s wrong (with )?my phone|diagnose|phone.*(slow|broken|hot|full|lagg|crash)|slow phone|phone.*slow)\b/i;

export function matchesDiagnosticTrigger(userText: string): boolean {
  if (!userText) return false;
  return TRIGGER_RE.test(userText.trim().toLowerCase());
}

export async function runDiagnostic(keys: DiagnosticKey[]): Promise<DiagnosticResults> {
  const out: DiagnosticResults = {};
  await Promise.all(
    keys.map(async (key) => {
      try {
        if (key === "diskSpace") out.diskSpace = checkDiskSpace();
        else if (key === "internetSpeed") out.internetSpeed = await checkInternetSpeed();
      } catch (err) {
        console.warn(`[diagnostic] ${key} failed`, err);
      }
    })
  );
  return out;
}

function checkDiskSpace(): DiskSpaceResult {
  const totalBytes = Paths.totalDiskSpace ?? 0;
  const freeBytes = Paths.availableDiskSpace ?? 0;
  return {
    freeMB: Math.round(freeBytes / 1024 / 1024),
    totalMB: Math.round(totalBytes / 1024 / 1024),
    usedPct:
      totalBytes > 0 ? Math.round((1 - freeBytes / totalBytes) * 100) : 0,
  };
}

async function checkInternetSpeed(): Promise<InternetSpeedResult> {
  // Cloudflare's speed test endpoint — unmetered, no key, CORS-friendly.
  const url = "https://speed.cloudflare.com/__down?bytes=1048576";
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const seconds = Math.max(0.05, (Date.now() - start) / 1000);
    const mbps = (blob.size * 8) / 1_000_000 / seconds;
    return { mbps: Math.round(mbps * 10) / 10 };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      mbps: null,
      error: err instanceof Error ? err.message : "speed test failed",
    };
  }
}

/** Format the diagnostic results as a readable chat message (posted as a
 *  user turn). The LLM sees this and responds in plain English. Humans
 *  reading the chat later also see it as a sensible record. */
export function formatDiagnosticsAsMessage(results: DiagnosticResults): string {
  const parts: string[] = ["🩺 Here's what my phone says:"];
  if (results.diskSpace) {
    const { freeMB, totalMB, usedPct } = results.diskSpace;
    const freeGB = (freeMB / 1024).toFixed(1);
    const totalGB = (totalMB / 1024).toFixed(1);
    parts.push(
      `Storage: ${usedPct}% used (${freeGB} GB free of ${totalGB} GB).`
    );
  }
  if (results.internetSpeed) {
    if (results.internetSpeed.mbps !== null) {
      parts.push(`Internet speed: ${results.internetSpeed.mbps} Mbps.`);
    } else {
      parts.push(
        `Internet speed: couldn't measure (${
          results.internetSpeed.error ?? "unknown"
        }).`
      );
    }
  }
  if (parts.length === 1) parts.push("(no data captured)");
  return parts.join(" ");
}
