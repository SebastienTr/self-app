/**
 * useKeyboardVisible — pure utility hook for keyboard visibility.
 *
 * Listens to keyboardWillShow/keyboardWillHide (iOS) and
 * keyboardDidShow/keyboardDidHide (Android) events.
 *
 * Returns { keyboardVisible: boolean }.
 *
 * PURE hook — no store dependencies, no side effects beyond keyboard listening.
 * Transition logic lives in App.tsx, not here.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible(): { keyboardVisible: boolean } {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardVisible };
}
