import * as React from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root decorative orientation={orientation} className={cn('mq:shrink-0 mq:bg-border', orientation === 'horizontal' ? 'mq:h-px mq:w-full' : 'mq:mx-1 mq:h-5 mq:w-px', className)} {...props} />;
}
