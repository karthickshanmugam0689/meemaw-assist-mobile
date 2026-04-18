"use client";

import { useEffect, useRef, useState } from "react";

export type Region = {
  x: number; // 0..1 (fraction of image width)
  y: number; // 0..1 (fraction of image height)
  width: number; // 0..1
  height: number; // 0..1
  label?: string;
};

type Props = {
  src: string; // object URL or data URL
  regions: Region[];
  alt?: string;
};

/**
 * Draws the user's photo with a soft red circle/ellipse over each region
 * that Meemaw identified. The label is drawn in a cream pill below the circle.
 *
 * We use an HTML <canvas> so the annotation burns into the visible image — this
 * means screenshots look right and nothing shifts if the layout changes.
 */
export function AnnotatedImage({ src, regions, alt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Cap render size so we don't blow up the DOM on huge photos
      const maxW = 900;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      canvas.width = w;
      canvas.height = h;
      setDims({ w, h });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. draw the photo
      ctx.drawImage(img, 0, 0, w, h);

      // 2. draw each region
      regions.forEach((r, i) => {
        const rx = r.x * w;
        const ry = r.y * h;
        const rw = r.width * w;
        const rh = r.height * h;
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        // expand a touch — models undersize
        const radius = Math.max(rw, rh) * 0.65;

        // soft outer glow
        ctx.save();
        ctx.shadowColor = "rgba(231, 111, 81, 0.55)";
        ctx.shadowBlur = 28;
        ctx.strokeStyle = "rgba(231, 111, 81, 1)"; // meemaw coral
        ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.008);
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // tiny number badge (top-left of ellipse)
        const badgeR = Math.max(14, Math.min(w, h) * 0.022);
        const badgeX = cx - radius * 0.7;
        const badgeY = cy - radius * 0.6;
        ctx.beginPath();
        ctx.fillStyle = "rgba(231, 111, 81, 1)";
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFF8F0";
        ctx.font = `bold ${Math.round(badgeR * 1.1)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), badgeX, badgeY + 1);

        // label pill below the circle
        if (r.label) {
          const fontSize = Math.max(14, Math.min(w, h) * 0.025);
          ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
          const padX = fontSize * 0.7;
          const padY = fontSize * 0.45;
          const metrics = ctx.measureText(r.label);
          const pillW = metrics.width + padX * 2;
          const pillH = fontSize + padY * 2;
          const pillX = cx - pillW / 2;
          const pillY = cy + radius + fontSize * 0.4;

          // pill background
          ctx.fillStyle = "rgba(30, 39, 97, 0.92)"; // meemaw navy
          roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
          ctx.fill();

          // pill text
          ctx.fillStyle = "#FFF8F0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(r.label, cx, pillY + pillH / 2 + 1);
        }
      });
    };
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src, regions]);

  return (
    <figure className="w-full max-w-md mx-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-2xl shadow-lg bg-black/5"
        aria-label={alt ?? "Annotated photo from Meemaw"}
        style={{ maxWidth: dims?.w ?? undefined }}
      />
    </figure>
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
