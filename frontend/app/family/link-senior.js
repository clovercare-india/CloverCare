import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ActivityIndicator } from 'react-native-paper';
import '../../global.css';
import { useAuth } from '../../contexts/AuthContext';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { linkSeniorByCode } from '../../services/auth';
import { colors } from '../../theme/colors';

export default function LinkSeniorScreen() {
  const { user } = useAuth();

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];
  const [linkingCode, setLinkingCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  const handleLinkSenior = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not logged in. Please try again.');
      return;
    }

    if (!linkingCode || linkingCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character linking code');
      return;
    }

    setLoading(true);

    try {
      const result = await linkSeniorByCode(user.uid, linkingCode);

      if (result.success) {
        
        Alert.alert(
          'Success!',
          `Successfully linked to ${result.senior.fullName || 'Unknown Senior'}!`,
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/family/dashboard')
            }
          ]
        );
      } else {
        let errorMessage = result.error;
        if (result.error === 'Invalid linking code') {
          errorMessage = translations.invalidCode;
        } else if (result.error === 'Linking code has expired') {
          errorMessage = translations.codeExpired;
        } else if (result.error === 'Already linked to this senior') {
          errorMessage = translations.alreadyLinked;
        }
        
        Alert.alert('Error', errorMessage);
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to link senior. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View className="px-4 py-3 mt-10 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/family/dashboard');
              }
            }}>
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-slate-900">
              {translations.linkExistingSenior}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        <View className="items-center mt-12">
          {/* Icon */}
          <View className="w-24 h-24 rounded-full items-center justify-center mb-6" style={{ backgroundColor: colors.background.lighter }}>
            <MaterialIcons name="link" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-slate-900 mb-2 text-center">
            {translations.linkExistingSenior}
          </Text>

          {/* Subtitle */}
          <Text className="text-base text-slate-600 mb-8 text-center px-4">
            {translations.enterLinkingCode}
          </Text>

          {/* Code Input */}
          <View className="w-full mb-8">
            <TextInput
              className="border-2 border-gray-300 rounded-lg p-4 text-center text-2xl font-bold tracking-widest uppercase"
              placeholder={translations.linkingCodePlaceholder}
              value={linkingCode}
              onChangeText={(text) => setLinkingCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
            />
          </View>

          {/* Link Button */}
          <View className="w-full mb-4">
            <Button
              mode="contained"
              onPress={handleLinkSenior}
              disabled={loading || linkingCode.length !== 6}
              className="bg-primary"
              buttonColor={colors.primary}
              contentStyle={{ paddingVertical: 8 }}
            >
              {loading ? translations.linkingSenior : translations.linkSenior}
            </Button>
          </View>

          {loading && (
            <View className="mt-4">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-sm text-slate-600 mt-2 text-center">
                {translations.linkingSenior}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
