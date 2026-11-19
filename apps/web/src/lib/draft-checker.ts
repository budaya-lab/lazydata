export type CheckState = { pending: boolean; issues: string[] };
type Defer = (callback: () => void, delay: number) => () => void;

const defer: Defer = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

export function createDraftChecker<T>(
  check: (draft: T) => string[],
  publish: (state: CheckState) => void,
  later: Defer = defer,
) {
  let cancel: (() => void) | undefined;
  let sequence = 0;
  let disposed = false;

  function invalidate() {
    sequence++;
    cancel?.();
    cancel = undefined;
  }

  return {
    schedule(draft: T) {
      if (disposed) return;
      invalidate();
      const token = sequence;
      publish({ pending: true, issues: [] });
      cancel = later(() => {
        if (disposed || token !== sequence) return;
        cancel = undefined;
        const issues = check(draft);
        if (!disposed && token === sequence) publish({ pending: false, issues });
      }, 500);
    },
    flush(draft: T): string[] {
      if (disposed) throw new Error('Cannot check a disposed form.');
      invalidate();
      const issues = check(draft);
      publish({ pending: false, issues });
      return issues;
    },
    dispose() {
      disposed = true;
      invalidate();
    },
  };
}
