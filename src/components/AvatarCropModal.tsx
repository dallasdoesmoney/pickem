"use client";

import { useState, useRef } from "react";

const VIEWPORT = 280;

type Props = {
  file: File;
  outputSize: number;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

// Drag-to-reposition cropper, fixed zoom (no pinch/scroll) - the image is
// scaled so its SHORTER side exactly fills the square viewport (same math
// as CSS `background-size: cover`), then can be dragged within that
// overflow to choose which part shows. Confirm re-draws the same crop
// window at full resolution from the original image, not the scaled-down
// preview, so output quality doesn't depend on VIEWPORT's on-screen size.
export function AvatarCropModal({ file, outputSize, onCancel, onConfirm }: Props) {
  const [imgUrl] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const scale = natural ? VIEWPORT / Math.min(natural.w, natural.h) : 1;
  const displayW = natural ? natural.w * scale : VIEWPORT;
  const displayH = natural ? natural.h * scale : VIEWPORT;

  function clamp(x: number, y: number) {
    const minX = VIEWPORT - displayW;
    const minY = VIEWPORT - displayH;
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
  }

  function handleImgLoad() {
    if (!imgRef.current) return;
    const w = imgRef.current.naturalWidth;
    const h = imgRef.current.naturalHeight;
    const s = VIEWPORT / Math.min(w, h);
    setNatural({ w, h });
    setOffset({ x: (VIEWPORT - w * s) / 2, y: (VIEWPORT - h * s) / 2 });
  }

  function handlePointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp(dragRef.current.originX + dx, dragRef.current.originY + dy));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleClose(cancel: () => void) {
    URL.revokeObjectURL(imgUrl);
    cancel();
  }

  function handleConfirm() {
    if (!natural || !imgRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    const srcSide = VIEWPORT / scale;
    ctx.drawImage(imgRef.current, srcX, srcY, srcSide, srcSide, 0, 0, outputSize, outputSize);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    URL.revokeObjectURL(imgUrl);
    onConfirm(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={() => handleClose(onCancel)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
          POSITION YOUR PHOTO
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-5">Drag to reframe.</p>

        <div
          className="relative mx-auto rounded-full overflow-hidden border-2 border-white/20 touch-none select-none cursor-grab active:cursor-grabbing bg-black/30"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={imgUrl}
            alt=""
            onLoad={handleImgLoad}
            draggable={false}
            className="absolute pointer-events-none max-w-none"
            style={{ left: offset.x, top: offset.y, width: displayW, height: displayH }}
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={() => handleClose(onCancel)}
            className="rounded-full px-5 py-2 text-xs text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={!natural}
            className="rounded-full px-5 py-2 text-xs active:scale-95 transition-transform duration-150 disabled:opacity-50"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            USE PHOTO
          </button>
        </div>
      </div>
    </div>
  );
}
