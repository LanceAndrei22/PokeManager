/**
 * Accessible native <dialog> wrapper following modern-web-guidance:
 * - Uses native showModal() / close() without redundant role="dialog" or aria-modal.
 * - Supports closedby="any" light dismiss plus a getBoundingClientRect() pointer fallback
 *   when closedBy is unsupported in older browsers or jsdom.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface CozyDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  allowLightDismiss?: boolean;
  children: ReactNode;
}

export function CozyDialog({
  open,
  onClose,
  title,
  allowLightDismiss = true,
  children,
}: CozyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      // Clear stale returnValue per modern dialog guidance
      dialog.returnValue = '';
      if (open) {
        onClose();
      }
    };

    const handleCancel = (event: Event) => {
      if (!allowLightDismiss) {
        event.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [allowLightDismiss, onClose, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !allowLightDismiss) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (event: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      pressedOutsideRef.current = isOutside(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pressedOutsideRef.current && isOutside(event)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [allowLightDismiss]);

  if (!open) return null;

  const closedByProp = allowLightDismiss ? { closedby: 'any' } : { closedby: 'none' };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="cozy-dialog"
      {...(closedByProp as Record<string, string>)}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between border-b-2 border-wood-300 bg-cream-100 px-4 py-3">
          <h1 id={titleId} className="text-lg font-bold text-wood-900">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border-2 border-wood-700 bg-cream-50 px-2.5 py-1 text-xs font-bold text-wood-900 hover:bg-cream-200 focus-visible:outline-2 focus-visible:outline-sage-600"
          >
            Close
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
