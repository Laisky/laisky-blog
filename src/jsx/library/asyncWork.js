/** localError creates a static named error without retaining request, URL, response, DOM, or account data. */
function localError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** runAsyncWork owns a task's completion, cancellation and deadline while consuming any late settlement. */
export function runAsyncWork(start, { signal, timeoutMs = 15000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) {
    return Promise.reject(new RangeError('Invalid operation deadline'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    /** finish settles this owner once and removes its timer and cancellation listener. */
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      settle(value);
    };
    /** cancel rejects only this consumer; late shared or noncancelable work remains observed. */
    const cancel = () => finish(reject, localError('AbortError', 'Operation canceled'));
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => finish(reject, localError('TimeoutError', 'Operation timed out')), timeoutMs);
    Promise.resolve()
      .then(() => (settled ? undefined : start()))
      .then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error)
      );
  });
}
