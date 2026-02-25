/**
 * TabNavigator — three-tab bottom navigation (Home / Chat / Settings).
 *
 * Architecture: replaces the two-mode crossfade from story 2-5.
 * Instant tab switching, no animation.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '@/screens/HomeScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { CustomTabBar } from '@/navigation/TabBar';

export type TabParamList = {
  Home: { highlightModuleId?: string } | undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
