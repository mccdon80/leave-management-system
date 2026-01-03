// components/admin/AdminModal.tsx
"use client";

import { useEffect } from "react";

export default function AdminModal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close modal" />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white shadow-xl overflow-hidden">
        <div className="p-4 border-b">
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-neutral-500 mt-1">{subtitle}</div> : null}
        </div>

        <div className="p-4">{children}</div>

        {footer ? <div className="p-4 border-t flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
