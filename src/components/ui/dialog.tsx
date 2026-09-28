'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);
    return <dialog ref={dialogRef} className="ui-dialog" aria-labelledby={titleId} onClose={onClose}>
        <h2 id={titleId}>{title}</h2>
        {children}
    </dialog>;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onCancel, onConfirm }: { open: boolean; title: string; message: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) {
    return <Modal open={open} title={title} onClose={onCancel}>
        <p>{message}</p>
        <div className="ui-dialog-actions">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
    </Modal>;
}