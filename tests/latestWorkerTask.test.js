import { describe, expect, it } from 'vitest';
import { createLatestWorkerTask } from '../src/lib/latestWorkerTask.js';

class FakeWorker {
  static instances = [];

  constructor() {
    this.listeners = { message: [], error: [] };
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  postMessage(message) {
    this.message = message;
  }

  emit(type, data) {
    for (const listener of this.listeners[type]) listener({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

describe('latest Worker task', () => {
  it('terminates and rejects a superseded calculation', async () => {
    FakeWorker.instances = [];
    const runner = createLatestWorkerTask('/worker.js', { WorkerCtor: FakeWorker });
    const first = runner.run('one', { value: 1 });
    const firstWorker = FakeWorker.instances[0];
    const second = runner.run('two', { value: 2 });
    const secondWorker = FakeWorker.instances[1];

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(firstWorker.terminated).toBe(true);
    secondWorker.emit('message', {
      id: secondWorker.message.id,
      ok: true,
      value: 42,
    });
    await expect(second).resolves.toBe(42);
    expect(secondWorker.terminated).toBe(true);
  });

  it('ignores stale messages and cancels active work on destroy', async () => {
    FakeWorker.instances = [];
    const runner = createLatestWorkerTask('/worker.js', { WorkerCtor: FakeWorker });
    const pending = runner.run('one', {});
    const worker = FakeWorker.instances[0];
    worker.emit('message', { id: worker.message.id + 1, ok: true, value: 'stale' });
    expect(runner.active).toBe(true);
    runner.destroy();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
    await expect(runner.run('two', {})).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('can run fresh work after a lifecycle cancellation', async () => {
    FakeWorker.instances = [];
    const runner = createLatestWorkerTask('/worker.js', { WorkerCtor: FakeWorker });
    const first = runner.run('one', {});
    expect(runner.cancel('page-hidden')).toBe(true);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });

    const second = runner.run('two', {});
    const worker = FakeWorker.instances.at(-1);
    worker.emit('message', {
      id: worker.message.id,
      ok: true,
      value: 'restored',
    });

    await expect(second).resolves.toBe('restored');
  });
});
