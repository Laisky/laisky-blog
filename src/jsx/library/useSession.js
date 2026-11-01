import { useEffect, useState } from 'react';
import { getSession } from './session.js';
import { kvSubscribeRecovery } from './storage.js';

/**
 * useSession keeps a component in step with the session, reading it again whenever storage finishes late work, because
 * a read that failed or a delete that seemed to fail may have a different answer by then.
 *
 * @returns {{status: string, username?: string}|null} The current session, or null until the first read finishes.
 */
export const useSession = () => {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let latestRead = 0;
    /** load reads the session and keeps the result only if no newer read has started. */
    const load = async () => {
      latestRead += 1;
      const read = latestRead;
      const next = await getSession();
      if (read === latestRead) setSession(next);
    };
    load();
    const unsubscribe = kvSubscribeRecovery(load);
    return () => {
      latestRead = Number.NaN;
      unsubscribe();
    };
  }, []);

  return session;
};
