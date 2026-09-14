import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="marq-ui mq:fixed mq:inset-0 mq:z-[2147483000] mq:bg-black/40" />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn('marq-ui mq:fixed mq:left-1/2 mq:top-1/2 mq:z-[2147483001] mq:grid mq:max-h-[90vh] mq:w-[min(960px,calc(100vw-32px))] mq:-translate-x-1/2 mq:-translate-y-1/2 mq:gap-4 mq:overflow-auto mq:rounded-xl mq:border mq:border-border mq:bg-background mq:p-6 mq:shadow-2xl mq:outline-none', className)} {...props}>
        {children}
        <DialogPrimitive.Close className="mq:absolute mq:right-4 mq:top-4 mq:rounded-sm mq:opacity-70 mq:hover:opacity-100" aria-label="Close"><X className="mq:size-4" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mq:flex mq:flex-col mq:gap-1.5', className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mq:flex mq:flex-wrap mq:justify-end mq:gap-2', className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('mq:text-lg mq:font-semibold', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('mq:text-sm mq:text-muted-foreground', className)} {...props} />;
}
