import * as React from 'react';
import { cn } from '../../lib/utils';

export const inputClass = 'marq-ui mq:flex mq:h-8 mq:w-full mq:min-w-0 mq:rounded-md mq:border mq:border-input mq:bg-background mq:px-2.5 mq:py-1 mq:text-sm mq:text-foreground mq:shadow-xs mq:outline-none mq:transition-shadow mq:placeholder:text-muted-foreground mq:focus-visible:border-ring mq:focus-visible:ring-2 mq:focus-visible:ring-ring/40 mq:disabled:opacity-50 mq:aria-invalid:border-destructive';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(inputClass, 'mq:h-auto mq:min-h-20 mq:py-2', className)} {...props} />;
}
