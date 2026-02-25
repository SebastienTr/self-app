/**
 * useKeyboardVisible — pure utility hook for keyboard visibility + height.
 *
 * Listens to keyboardWillShow/keyboardWillHide (iOS) and
 * keyboardDidShow/keyboardDidHide (Android) events.
 *
 * Returns { keyboardVisible: boolean, keyboardHeight: number }.
 *
 * PURE hook — no store dependencies, no side effects beyond keyboard listening.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import type { KeyboardEvent } from 'react-native';

export function useKeyboardVisible(): { keyboardVisible: boolean; keyboardHeight: number } {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardVisible, keyboardHeight };
}
