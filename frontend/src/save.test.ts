import { describe, it, expect, vi } from 'vitest';
import { SaveQueue } from './save';

describe('revision-checked save queue', () => {
  it('serializes requests and does not mark a newer edit saved by an older response', async () => {
    let finish!: (value: { revision: string }) => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ revision: 'r3' });
    const update = vi.fn(), recovery = vi.fn(), clear = vi.fn();
    const queue = new SaveQueue('a', 'r1', write, update, recovery, clear);
    queue.edit('b'); const running = queue.flush(); queue.edit('c');
    expect(write).toHaveBeenCalledTimes(1);
    finish({ revision: 'r2' }); await running;
    expect(write.mock.calls).toEqual([['b', 'r1'], ['c', 'r2']]);
    expect(queue.source).toBe('c'); expect(queue.state).toBe('saved'); expect(clear).toHaveBeenCalledTimes(1);
    queue.dispose();
  });
  it('retains recovery and pauses after a stale write', async () => {
    const write = vi.fn().mockRejectedValue(Object.assign(new Error('changed'), { status: 409 }));
    const recovery = vi.fn(), clear = vi.fn();
    const queue = new SaveQueue('a', 'r1', write, vi.fn(), recovery, clear);
    queue.edit('b'); await queue.flush(); queue.edit('c'); await queue.flush();
    expect(queue.state).toBe('conflict'); expect(write).toHaveBeenCalledTimes(1); expect(clear).not.toHaveBeenCalled(); expect(recovery).toHaveBeenLastCalledWith('c', 'r1');
    queue.dispose();
  });
  it('does not erase an external conflict while a save is in flight', async () => {
    let finish!: (value: { revision: string }) => void;
    const queue = new SaveQueue('a', 'r1', () => new Promise(resolve => { finish = resolve; }), vi.fn(), vi.fn(), vi.fn());
    queue.edit('b'); const running = queue.flush(); queue.conflict(); finish({ revision: 'r2' }); await running;
    expect(queue.state).toBe('conflict'); queue.dispose();
  });
});
