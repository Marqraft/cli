import React, { useEffect, useRef } from 'react';
import type { SlashItem } from '../commands';
import { CommandIcon } from './CommandIcon';
import { cn } from '../lib/utils';

export type SlashState = { from: number; to: number; query: string; left: number; top: number; index: number };

/** Caret-anchored block menu opened by typing "/"; keyboard handling lives in the editor. */
export function SlashMenu({ state, items, choose, hover }: { state: SlashState; items: SlashItem[]; choose: (item: SlashItem) => void; hover: (index: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.querySelector('[data-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [state.index]);
  const below = state.top + 320 < window.innerHeight;
  let group = '';
  return (
    <div ref={list} role="listbox" aria-label="Insert block" data-marq-chrome
      className="marq-ui mq:fixed mq:z-[2147483000] mq:max-h-80 mq:w-64 mq:overflow-auto mq:rounded-lg mq:border mq:border-border mq:bg-popover mq:p-1 mq:shadow-xl"
      style={{ left: Math.min(state.left, window.innerWidth - 272), top: below ? state.top + 24 : undefined, bottom: below ? undefined : window.innerHeight - state.top + 4 }}
      onMouseDown={event => event.preventDefault()}>
      {items.length === 0 && <div className="mq:px-2 mq:py-3 mq:text-center mq:text-sm mq:text-muted-foreground">No matching blocks</div>}
      {items.map((item, index) => {
        const heading = item.group !== group ? (group = item.group) : '';
        return <React.Fragment key={item.id}>
          {heading && <div className="mq:px-2 mq:pb-1 mq:pt-2 mq:text-[11px] mq:font-medium mq:uppercase mq:tracking-wide mq:text-muted-foreground">{heading}</div>}
          <button type="button" role="option" aria-selected={index === state.index} data-selected={index === state.index}
            className={cn('mq:flex mq:w-full mq:items-center mq:gap-2.5 mq:rounded-md mq:px-2 mq:py-1.5 mq:text-left', index === state.index && 'mq:bg-accent')}
            onMouseEnter={() => hover(index)} onClick={() => choose(item)}>
            <span className="mq:flex mq:size-8 mq:shrink-0 mq:items-center mq:justify-center mq:rounded-md mq:border mq:border-border mq:bg-background"><CommandIcon name={item.icon} className="mq:size-4" /></span>
            <span className="mq:min-w-0"><span className="mq:block mq:text-sm mq:font-medium">{item.label}</span><span className="mq:block mq:truncate mq:text-xs mq:text-muted-foreground">{item.description}</span></span>
          </button>
        </React.Fragment>;
      })}
    </div>
  );
}
