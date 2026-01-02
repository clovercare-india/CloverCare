// Initialize Firebase first - MUST be before any other Firebase imports
import '@react-native-firebase/app';
import { Slot } from 'expo-router';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import './global.css';
import logger from './utils/logger';

// Register background handler - MUST be outside component and at app entry
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  logger.debug('BackgroundMessageHandler', 'Background message received', remoteMessage);
});

export default function RootLayout() {
  return <Slot />;
}