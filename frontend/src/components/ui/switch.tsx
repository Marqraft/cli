import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root data-slot="switch" className={cn('marq-ui mq:peer mq:inline-flex mq:h-[18px] mq:w-8 mq:shrink-0 mq:cursor-pointer mq:items-center mq:rounded-full mq:border mq:border-transparent mq:shadow-xs mq:outline-none mq:transition-all mq:focus-visible:ring-2 mq:focus-visible:ring-ring/50 mq:disabled:opacity-50 mq:data-[state=checked]:bg-primary mq:data-[state=unchecked]:bg-input', className)} {...props}>
      <SwitchPrimitive.Thumb className="mq:pointer-events-none mq:block mq:size-4 mq:rounded-full mq:bg-background mq:ring-0 mq:transition-transform mq:data-[state=checked]:translate-x-[14px] mq:data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}
