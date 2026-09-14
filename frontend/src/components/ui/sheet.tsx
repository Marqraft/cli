import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;

/* A non-modal side sheet: the page stays visible and interactive for live preview. */
export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Content data-slot="sheet-content" onInteractOutside={event => event.preventDefault()} className={cn('marq-ui mq:fixed mq:inset-y-0 mq:right-0 mq:top-12 mq:z-[2147482000] mq:flex mq:w-80 mq:max-w-full mq:flex-col mq:gap-4 mq:overflow-auto mq:border-l mq:border-border mq:bg-background mq:p-5 mq:shadow-xl mq:outline-none', className)} {...props}>
        {children}
        <SheetPrimitive.Close className="mq:absolute mq:right-4 mq:top-4 mq:rounded-sm mq:opacity-70 mq:hover:opacity-100" aria-label="Close panel"><X className="mq:size-4" /></SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('mq:text-base mq:font-semibold', className)} {...props} />;
}
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('mq:text-xs mq:text-muted-foreground', className)} {...props} />;
}
