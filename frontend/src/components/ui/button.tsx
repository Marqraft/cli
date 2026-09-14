import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'marq-ui mq:inline-flex mq:shrink-0 mq:cursor-pointer mq:select-none mq:items-center mq:justify-center mq:gap-1.5 mq:whitespace-nowrap mq:rounded-md mq:text-sm mq:font-medium mq:leading-none mq:no-underline mq:transition-colors mq:outline-none mq:focus-visible:ring-2 mq:focus-visible:ring-ring/60 mq:disabled:pointer-events-none mq:disabled:opacity-50 mq:[&_svg]:pointer-events-none mq:[&_svg]:size-4 mq:[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'mq:bg-primary mq:text-primary-foreground mq:shadow-xs mq:hover:bg-primary/90',
        destructive: 'mq:bg-destructive mq:text-white mq:shadow-xs mq:hover:bg-destructive/90',
        outline: 'mq:border mq:border-border mq:bg-background mq:text-foreground mq:shadow-xs mq:hover:bg-accent mq:hover:text-accent-foreground',
        secondary: 'mq:bg-secondary mq:text-secondary-foreground mq:hover:bg-secondary/80',
        ghost: 'mq:text-foreground mq:hover:bg-accent mq:hover:text-accent-foreground mq:data-[active=true]:bg-accent',
        link: 'mq:text-primary mq:underline-offset-4 mq:hover:underline',
      },
      size: {
        default: 'mq:h-8 mq:px-3',
        sm: 'mq:h-7 mq:px-2.5 mq:text-xs',
        lg: 'mq:h-9 mq:px-4',
        icon: 'mq:size-8',
        'icon-sm': 'mq:size-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';
  return <Component data-slot="button" type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
