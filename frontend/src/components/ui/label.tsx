import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn('marq-ui mq:flex mq:select-none mq:items-center mq:gap-2 mq:text-xs mq:font-medium mq:text-foreground', className)} {...props} />;
}
