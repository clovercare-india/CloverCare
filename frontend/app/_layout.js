import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold 
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import '../global.css';
import { AuthProvider } from '../contexts/AuthContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Custom theme with Senior module color palette
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5B718A',
    primaryContainer: '#dbeafe',
    secondary: '#8DAAA5',
    secondaryContainer: '#e0f2f1',
    tertiary: '#F7BC20',
    tertiaryContainer: '#fff9e6',
  },
};

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Hide navigation bar and status bar for full-screen mode
    const hideNavigationBar = async () => {
      try {
        await NavigationBar.setVisibilityAsync('hidden');
      } catch (error) {
        // Silently fail if activity is not available
        console.warn('Failed to hide navigation bar:', error);
      }
    };

    const showNavigationBar = async () => {
      try {
        await NavigationBar.setVisibilityAsync('visible');
      } catch (error) {
        // Silently fail if activity is not available
        console.warn('Failed to show navigation bar:', error);
      }
    };

    hideNavigationBar();
    StatusBar.setHidden(true);

    // Optional: Restore on unmount (cleanup)
    return () => {
      showNavigationBar();
      StatusBar.setHidden(false);
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PaperProvider theme={theme}>
          <Stack 
            screenOptions={{ 
              headerShown: false,
              animation: 'fade',
              animationDuration: 200
            }} 
          />
        </PaperProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}