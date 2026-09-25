import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Focus mode hides navigation and page chrome, e.g. during a learning session. */
const FocusModeContext = createContext<{ focus: boolean; setFocus: (focus: boolean) => void }>({
  focus: false,
  setFocus: () => {},
});

export function FocusModeProvider({ children }: { children: (focus: boolean) => ReactNode }) {
  const [focus, setFocus] = useState(false);
  return <FocusModeContext.Provider value={{ focus, setFocus }}>{children(focus)}</FocusModeContext.Provider>;
}

/** Turns focus mode on while the calling component is mounted. */
export function useFocusMode(): void {
  const { setFocus } = useContext(FocusModeContext);
  useEffect(() => {
    setFocus(true);
    return () => setFocus(false);
  }, [setFocus]);
}
