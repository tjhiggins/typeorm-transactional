import { EventEmitter } from 'events';
import { Namespace } from 'cls-hooked';

import { getHookInContext, getTransactionalContext, setHookInContext } from '../common';

export const getTransactionalContextHook = () => {
  const context = getTransactionalContext();

  const emitter = getHookInContext(context);
  if (!emitter) {
    throw new Error('No hook manager found in context. Are you using @Transactional()?');
  }

  return emitter;
};

export const runAndTriggerHooks = async (hook: EventEmitter, cb: () => unknown) => {
  try {
    const result = await Promise.resolve(cb());

    setImmediate(() => {
      hook.emit('commit');

      hook.emit('end', undefined);
      hook.removeAllListeners();
    });

    return result;
  } catch (err) {
    setImmediate(() => {
      hook.emit('rollback', err);

      hook.emit('end', err);
      hook.removeAllListeners();
    });

    throw err;
  }
};

export const createEventEmitterInNewContext = (context: Namespace) => {
  return context.runAndReturn(() => {
    const emitter = new EventEmitter();
    context.bindEmitter(emitter);
    return emitter;
  });
};

export const runInNewHookContext = async (context: Namespace, cb: () => unknown) => {
  const hook = createEventEmitterInNewContext(context);

  return await context.runAndReturn(() => {
    setHookInContext(context, hook);

    return runAndTriggerHooks(hook, cb);
  });
};

export const runOnTransactionCommit = (cb: () => void) => {
  getTransactionalContextHook().once('commit', cb);
};

export const runOnTransactionRollback = (cb: (e: Error) => void) => {
  getTransactionalContextHook().once('rollback', cb);
};

export const runOnTransactionComplete = (cb: (e: Error | undefined) => void) => {
  getTransactionalContextHook().once('end', cb);
};
