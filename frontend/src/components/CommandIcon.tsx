import React from 'react';
import { Blocks, Braces, Code, Heading2, Heading3, Image, List, ListOrdered, Megaphone, Minus, PanelTop, Quote, Table, Type } from 'lucide-react';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type, heading2: Heading2, heading3: Heading3, list: List, listOrdered: ListOrdered, quote: Quote, code: Code,
  image: Image, table: Table, minus: Minus, braces: Braces, tabs: PanelTop, callout: Megaphone, blocks: Blocks,
};

export function CommandIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Blocks;
  return <Icon className={className} />;
}
