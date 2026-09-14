import React, { useId, useRef } from 'react';
import { ImageUp } from 'lucide-react';
import type { Field } from '../types';
import { upload } from '../api';
import { Input, Textarea } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';

/** Controls generated from a theme settings schema. */
export function Fields({ fields, value, change, onError }: { fields: Field[]; value: Record<string, string>; change: (key: string, value: string) => void; onError?: (message: string) => void }) {
  return <div className="mq:flex mq:flex-col mq:gap-4">{fields.map(field => <FieldControl key={field.name} field={field} value={value[field.name] ?? field.default ?? ''} change={next => change(field.name, next)} onError={onError} />)}</div>;
}

function FieldControl({ field, value, change, onError }: { field: Field; value: string; change: (value: string) => void; onError?: (message: string) => void }) {
  const id = useId();
  const file = useRef<HTMLInputElement>(null);
  if (field.type === 'toggle') {
    return <div className="mq:flex mq:items-center mq:justify-between mq:gap-3"><Label htmlFor={id}>{field.label}</Label><Switch id={id} aria-label={field.label} checked={value === 'true'} onCheckedChange={checked => change(String(checked))} /></div>;
  }
  let control: React.ReactNode;
  if (field.type === 'enum') {
    control = <Select value={value} onValueChange={change}><SelectTrigger id={id} aria-label={field.label}><SelectValue /></SelectTrigger><SelectContent>{(field.options ?? []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
  } else if (field.type === 'multiline') {
    control = <Textarea id={id} aria-label={field.label} value={value} onChange={event => change(event.target.value)} />;
  } else if (field.type === 'color') {
    control = <div className="mq:flex mq:gap-2"><input type="color" aria-label={`${field.label} picker`} className="mq:h-8 mq:w-10 mq:cursor-pointer mq:rounded-md mq:border mq:border-input mq:bg-background mq:p-0.5" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={event => change(event.target.value)} /><Input id={id} aria-label={field.label} value={value} onChange={event => change(event.target.value)} className="mq:font-mono" /></div>;
  } else if (field.type === 'number') {
    control = <div className="mq:flex mq:items-center mq:gap-3"><input type="range" aria-hidden tabIndex={-1} className="mq:flex-1 mq:accent-primary" min={field.min} max={field.max} value={value} onChange={event => change(event.target.value)} /><Input id={id} aria-label={field.label} type="number" min={field.min} max={field.max} value={value} onChange={event => change(event.target.value)} className="mq:w-20" /></div>;
  } else if (field.type === 'image') {
    control = <div className="mq:flex mq:flex-col mq:gap-2">
      {value && <img src={value} alt="" className="mq:max-h-20 mq:w-fit mq:rounded-md mq:border mq:border-border mq:object-contain" />}
      <div className="mq:flex mq:gap-2"><Input id={id} aria-label={field.label} placeholder="/path/to/image.png" value={value} onChange={event => change(event.target.value)} />
        <Button variant="outline" size="icon" aria-label={`Upload ${field.label}`} onClick={() => file.current?.click()}><ImageUp /></Button></div>
      <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const chosen = event.target.files?.[0]; if (chosen) void upload(chosen).then(change).catch(error => onError?.(String(error.message ?? error))); event.target.value = ''; }} />
    </div>;
  } else {
    control = <Input id={id} aria-label={field.label} value={value} onChange={event => change(event.target.value)} />;
  }
  return <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor={id}>{field.label}{field.unit && <span className="mq:font-normal mq:text-muted-foreground">({field.unit})</span>}</Label>{control}</div>;
}
