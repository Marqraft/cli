import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset} className={cn('marq-ui mq:z-[2147483000] mq:w-72 mq:rounded-lg mq:border mq:border-border mq:bg-popover mq:p-4 mq:text-popover-foreground mq:shadow-lg mq:outline-none', className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}
