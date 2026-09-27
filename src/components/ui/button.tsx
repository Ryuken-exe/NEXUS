import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('button', {
    variants: {
        variant: { default: '', outline: 'secondary', lime: 'lime' }
    },
    defaultVariants: { variant: 'default' }
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, ...props }, ref) {
    return <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />;
});