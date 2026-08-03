import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { DirectShareScreen } from './screens/DirectShareScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LogsScreen } from './screens/LogsScreen';
import { PlatformsScreen } from './screens/PlatformsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { SheetScreen } from './screens/SheetScreen';
import { ShowcaseProvider } from './state/ShowcaseProvider';
import { useShowcase } from './state/useShowcase';

const rootStyle = { flex: 1 };

function ExampleRouter() {
  const { state } = useShowcase();

  if (state.setup.phase !== 'initialized') {
    return <SetupScreen />;
  }

  const route =
    state.navigation.stack[state.navigation.stack.length - 1] ?? 'home';
  switch (route) {
    case 'setup':
    case 'home':
      return <HomeScreen />;
    case 'platforms':
      return <PlatformsScreen />;
    case 'sheet':
      return <SheetScreen />;
    case 'direct':
      return <DirectShareScreen />;
    case 'analytics':
      return <AnalyticsScreen />;
    case 'logs':
      return <LogsScreen />;
  }
}

export default function App() {
  return (
    <GestureHandlerRootView style={rootStyle}>
      <ThemeProvider>
        <ShowcaseProvider>
          <ExampleRouter />
          <ShareSheetHost />
        </ShowcaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
