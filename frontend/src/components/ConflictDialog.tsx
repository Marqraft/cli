import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/input';

type Props = {
  open: boolean; recovering: boolean; local: string; disk: string;
  editLocal: (source: string) => void; useDisk: () => void; saveLocal: () => void; download: () => void;
};

export function ConflictDialog({ open, recovering, local, disk, editLocal, useDisk, saveLocal, download }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{recovering ? 'Recover interrupted work' : 'This page changed on disk'}</DialogTitle>
          <DialogDescription>Autosave is paused. Nothing has been overwritten; review both versions and choose what to keep.</DialogDescription>
        </DialogHeader>
        <div className="mq:grid mq:gap-4 mq:md:grid-cols-2">
          <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-local">Your version</Label>
            <Textarea id="marq-local" aria-label="Your version" className="mq:h-[45vh] mq:font-mono mq:text-xs" value={local} onChange={event => editLocal(event.target.value)} /></div>
          <div className="mq:flex mq:flex-col mq:gap-1.5"><Label htmlFor="marq-disk">Disk version</Label>
            <Textarea id="marq-disk" aria-label="Disk version" readOnly className="mq:h-[45vh] mq:bg-muted mq:font-mono mq:text-xs" value={disk} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={download}>Download local copy</Button>
          <Button variant="outline" onClick={useDisk}>Use disk version</Button>
          <Button onClick={saveLocal}>Save reviewed local version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
