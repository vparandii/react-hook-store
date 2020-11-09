/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import pick from 'lodash/pick';
import omitBy from 'lodash/omitBy';
import get from 'lodash/get';
import omit from 'lodash/omit';
import isUndefined from 'lodash/isUndefined';

const withDevTools =
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  window.__REDUX_DEVTOOLS_EXTENSION__;

const savePersist = (store, persist) => {
  const persistStore = pick(store, persist);
  localStorage.setItem('persisted_react_hook_store', JSON.stringify(persistStore));
};

const getPersist = () => {
  const persistStoreString = localStorage.getItem('persisted_react_hook_store');
  return persistStoreString && JSON.parse(persistStoreString);
};

const reducer = (state, { type, payload: { key, path, value } }) => {
  const exists = Object.prototype.hasOwnProperty.call(state, key);
  const count = get(state, ['_registered', key], 0);
  const newState = { ...state, _updatedBy: `${type}_${path.toUpperCase()}` };
  switch (type) {
    case 'REGISTER':
      return {
        ...newState,
        [key]: exists ? state[key] : null,
        _registered: { ...get(state, '_registered'), [key]: count + 1 },
      };
    case 'UNREGISTER':
      return {
        ...(count === 1 ? omit(newState, [key]) : newState),
        _registered: { ...get(state, '_registered'), [key]: count - 1 },
      };
    case 'SET':
      return { ...newState, [key]: value };
    case 'RESET':
      return { ...newState, [key]: null };
    default:
      return state;
  }
};

const defaultStore = getPersist() || {};

const storeContext = createContext();

export const StoreProvider = ({ children, persist }) => {
  const [state, dispatch] = useReducer(reducer, defaultStore);
  const devTools = useMemo(
    () =>
      withDevTools &&
      window.__REDUX_DEVTOOLS_EXTENSION__.connect({
        name: 'BrandResponse Dashboard',
        actionsBlacklist: ['REGISTER_', 'UNREGISTER_'],
      }),
    []
  );

  useEffect(() => {
    return () => window.__REDUX_DEVTOOLS_EXTENSION__.disconnect();
  }, []);

  useEffect(() => {
    if (persist) savePersist(state, persist);
    if (withDevTools) {
      devTools.send(
        get(state, '_updatedBy', ''),
        omitBy(state, (_, path) => RegExp(/^_/).test(path))
      );
    }
  }, [state, devTools]);
  return <storeContext.Provider value={[state, dispatch]}>{children}</storeContext.Provider>;
};

export const useStore = (storePath, defaultValue) => {
  const [state, dispatch] = useContext(storeContext);
  const path = useMemo(() => storePath || 'UNDEFINED', [storePath]);
  const key = useMemo(() => storePath || Symbol(), [storePath]);
  useEffect(() => {
    dispatch({ type: `REGISTER`, payload: { key, path } });
    return () => dispatch({ type: `UNREGISTER`, payload: { key, path } });
  }, [path]);
  const set = useCallback((value) => dispatch({ type: `SET`, payload: { key, path, value } }), [
    path,
  ]);
  const reset = useCallback(() => dispatch({ type: `RESET`, payload: { key, path } }), [path]);
  return useMemo(() => [isUndefined(state[key]) ? defaultValue : state[key], set, reset], [
    state[key],
    set,
    reset,
  ]);
};
