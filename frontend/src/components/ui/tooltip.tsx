import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

/* Carries its own provider: node views mount separate React roots. */
export function Tooltip({ label, children, side = 'bottom' }: { label: string; children: React.ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className={cn('marq-ui mq:z-[2147483600] mq:rounded-md mq:bg-primary mq:px-2 mq:py-1 mq:text-xs mq:text-primary-foreground mq:shadow-md')}>{label}</TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
