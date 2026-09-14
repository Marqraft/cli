import * as React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { inputClass } from './input';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger className={cn(inputClass, 'mq:items-center mq:justify-between mq:gap-2 mq:cursor-pointer mq:[&>span]:truncate', className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="mq:size-4 mq:opacity-50" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
export function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position={position} sideOffset={4} className={cn('marq-ui mq:relative mq:z-[2147483600] mq:max-h-80 mq:min-w-[var(--radix-select-trigger-width)] mq:overflow-hidden mq:rounded-md mq:border mq:border-border mq:bg-popover mq:text-popover-foreground mq:shadow-lg', className)} {...props}>
        <SelectPrimitive.Viewport className="mq:p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cn('mq:relative mq:flex mq:w-full mq:cursor-default mq:select-none mq:items-center mq:rounded-sm mq:py-1.5 mq:pl-2 mq:pr-8 mq:text-sm mq:outline-none mq:data-[highlighted]:bg-accent', className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="mq:absolute mq:right-2 mq:flex mq:items-center"><Check className="mq:size-4" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
