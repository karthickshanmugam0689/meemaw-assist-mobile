"use client";

import type { Status } from "./StatusIndicator";

export function VoiceButton({
  status,
  onPress,
}: {
  status: Status;
  onPress: () => void;
}) {
  const isListening = status === "listening";
  const disabled = status === "thinking" || status === "speaking";

  const label = isListening ? "Stop" : "Tap to talk";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={[
        "relative flex items-center justify-center",
        "w-48 h-48 rounded-full",
        "text-white text-2xl font-semibold",
        "shadow-xl transition-all duration-200",
        "active:scale-95",
        disabled
          ? "bg-gray-400 cursor-not-allowed"
          : isListening
          ? "bg-meemaw-danger animate-pulse-slow"
          : "bg-meemaw-primary hover:bg-blue-700",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-20 h-20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isListening ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <>
            <rect x="9" y="2" width="6" height="13" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </>
        )}
      </svg>
    </button>
  );
}
