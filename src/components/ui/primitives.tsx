import { useId, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type TableHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type FieldProps = { label: string; error?: string; className?: string };

export function Input({ label, error, className, id, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return <label className="ui-field-wrap" htmlFor={fieldId}>
        {label}
        <input {...props} id={fieldId} className={cn('field', className)} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} />
        {error && <span className="ui-field-error" id={`${fieldId}-error`}>{error}</span>}
    </label>;
}

export function Select({ label, error, className, id, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return <label className="ui-field-wrap" htmlFor={fieldId}>
        {label}
        <select {...props} id={fieldId} className={cn('field', className)} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined}>{children}</select>
        {error && <span className="ui-field-error" id={`${fieldId}-error`}>{error}</span>}
    </label>;
}

export function Textarea({ label, error, className, id, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return <label className="ui-field-wrap" htmlFor={fieldId}>
        {label}
        <textarea {...props} id={fieldId} className={cn('field', className)} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} />
        {error && <span className="ui-field-error" id={`${fieldId}-error`}>{error}</span>}
    </label>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
    return <section className={cn('ui-card', className)} {...props} />;
}

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
    return <div className="ui-table-wrap"><table className={cn('ui-table', className)} {...props} /></div>;
}

export function Badge({ status, tone = 'neutral' }: { status: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
    return <span className="ui-badge" data-tone={tone}>{status}</span>;
}

export function Toast({ message, kind = 'success' }: { message: string; kind?: 'success' | 'error' | 'info' }) {
    if (!message) return null;
    return <div className="status" data-kind={kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'info'} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'}>{message}</div>;
}

export function Tabs({ items, value, onChange, label }: { items: { value: string; label: string; content: ReactNode }[]; value: string; onChange: (value: string) => void; label: string }) {
    const id = useId();
    const active = items.find((item) => item.value === value) ?? items[0];
    if (!active) return null;
    return <div>
        <div role="tablist" aria-label={label}>
            {items.map((item) => <button key={item.value} type="button" role="tab" id={`${id}-${item.value}-tab`} aria-selected={item.value === active.value} aria-controls={`${id}-${item.value}-panel`} tabIndex={item.value === active.value ? 0 : -1} className={cn('button', item.value === active.value ? '' : 'secondary')} onClick={() => onChange(item.value)}>{item.label}</button>)}
        </div>
        <div role="tabpanel" id={`${id}-${active.value}-panel`} aria-labelledby={`${id}-${active.value}-tab`}>{active.content}</div>
    </div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
    return <header className="page-title">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
        {actions}
    </header>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="ui-empty"><h2>{title}</h2><p className="muted">{description}</p>{action}</div>;
}

export function Skeleton({ className, label = 'Loading' }: { className?: string; label?: string }) {
    return <div className={cn('ui-skeleton', className)} role="status" aria-label={label} />;
}