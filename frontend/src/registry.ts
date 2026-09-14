import type { Field, Project, ThemeBlock } from './types';

/** Theme data node views need but cannot receive through ProseMirror attributes. */
export const registry: { blocks: ThemeBlock[]; project?: Project; authoring: boolean } = { blocks: [], authoring: true };

export function blockDefinition(id: string): ThemeBlock | undefined {
  return registry.blocks.find(block => block.id === id);
}

export function defaults(fields: Field[]): Record<string, string> {
  return Object.fromEntries(fields.map(field => [field.name, field.default ?? '']));
}
