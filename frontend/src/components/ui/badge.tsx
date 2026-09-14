import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('marq-ui mq:inline-flex mq:items-center mq:gap-1 mq:rounded-md mq:border mq:px-1.5 mq:py-0 mq:text-[11px] mq:font-medium mq:leading-[18px] mq:whitespace-nowrap', {
  variants: {
    variant: {
      default: 'mq:border-transparent mq:bg-primary mq:text-primary-foreground',
      secondary: 'mq:border-transparent mq:bg-secondary mq:text-secondary-foreground',
      outline: 'mq:border-border mq:text-foreground',
      warning: 'mq:border-transparent mq:bg-amber-100 mq:text-amber-800',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
