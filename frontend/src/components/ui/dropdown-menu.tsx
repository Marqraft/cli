import * as React from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content sideOffset={sideOffset} className={cn('marq-ui mq:z-[2147483000] mq:min-w-44 mq:overflow-hidden mq:rounded-md mq:border mq:border-border mq:bg-popover mq:p-1 mq:text-popover-foreground mq:shadow-lg', className)} {...props} />
    </MenuPrimitive.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn('mq:relative mq:flex mq:cursor-default mq:select-none mq:items-center mq:gap-2 mq:rounded-sm mq:px-2 mq:py-1.5 mq:text-sm mq:outline-none mq:data-[highlighted]:bg-accent mq:data-[disabled]:pointer-events-none mq:data-[disabled]:opacity-50 mq:[&_svg]:size-4 mq:[&_svg]:text-muted-foreground', className)} {...props} />;
}
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('mq:-mx-1 mq:my-1 mq:h-px mq:bg-border', className)} {...props} />;
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('mq:px-2 mq:py-1.5 mq:text-xs mq:font-medium mq:text-muted-foreground', className)} {...props} />;
}
