import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data for a screen and tracks loading and error state, so a failed request shows an
 * error with a retry button instead of a spinner that never ends.
 *
 *   const { data, loading, error, reload } = useResource(() => api.entities.Document.list(), [userId]);
 */
export default function useResource(load, deps) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function () {
      let active = true;
      setState(function (previous) {
        return { data: previous.data, loading: true, error: null };
      });
      Promise.resolve()
        .then(load)
        .then(function (data) {
          if (active) setState({ data, loading: false, error: null });
        })
        .catch(function (error) {
          console.error('Could not load data', error);
          if (active) {
            setState(function (previous) {
              return { data: previous.data, loading: false, error };
            });
          }
        });
      return function () {
        active = false;
      };
    },
    // The caller lists what the request depends on; `load` itself changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps.concat([attempt]),
  );

  const reload = useCallback(function () {
    setAttempt(function (value) {
      return value + 1;
    });
  }, []);

  return { ...state, reload };
}
