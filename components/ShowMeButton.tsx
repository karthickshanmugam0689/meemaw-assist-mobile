"use client";

import { useRef } from "react";

type Props = {
  onImage: (file: File) => void;
  disabled?: boolean;
};

/**
 * A secondary button that opens the camera on mobile (or the file picker
 * on desktop). We use a hidden <input type="file" capture="environment">
 * — this is the most reliable cross-browser way to trigger the rear camera
 * on iOS Safari and Android Chrome without asking for camera permissions
 * up front.
 */
export function ShowMeButton({ onImage, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Show me the problem — take a photo"
        className="flex items-center gap-2 px-5 py-3 rounded-full border-2 border-meemaw-primary/25 bg-white text-meemaw-primary text-base font-semibold shadow-sm active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CameraIcon />
        Show me the problem
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // reset so the same file can be picked again later
          e.target.value = "";
          if (file) onImage(file);
        }}
      />
    </>
  );
}

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
