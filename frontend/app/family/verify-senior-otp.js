import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { colors } from '../../theme/colors';
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
import { loadLanguage, translations as translationData } from '../../utils/i18n';
import { verifySeniorOTPAndCreateProfile } from '../../services/auth';
import { getTempData, clearTempData } from '../../utils/tempStorage';
import { useAuth } from '../../contexts/AuthContext';

export default function VerifySeniorOTPScreen() {
  const params = useLocalSearchParams();
  const { user, userProfile } = useAuth();
  const {
    familyUID,
    seniorName,
    seniorPhone,
    seniorCallingCode,
    seniorAge,
    seniorGender,
    seniorFullAddress,
    seniorCity,
    seniorState,
    seniorCountry,
    seniorPinCode,
    seniorEmploymentStatus,
    seniorLivingStatus,
    seniorPreferredLang,
  } = params;

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const translations = translationData[currentLanguage];

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      // Get confirmationResult from temp storage
      const confirmationResult = getTempData('seniorConfirmationResult');
      
      if (!confirmationResult) {
        Alert.alert('Error', 'Session expired. Please go back and try again.');
        setLoading(false);
        return;
      }

      // Get family member UID - use from params or fallback to current user
      const actualFamilyUID = familyUID || user?.uid || userProfile?.userId;

      if (!actualFamilyUID) {
        Alert.alert('Error', 'Unable to identify family member. Please log in again.');
        setLoading(false);
        return;
      }

      // Prepare senior data
      const seniorData = {
        name: seniorName,
        phone: `+${seniorCallingCode}${seniorPhone}`,
        age: parseInt(seniorAge),
        gender: seniorGender,
        addressLine1: seniorFullAddress || null,
        addressArea: null,
        addressCity: seniorCity || null,
        addressState: seniorState || null,
        addressCountry: seniorCountry || null,
        addressPincode: seniorPinCode || null,
        employmentStatus: seniorEmploymentStatus || null,
        livingStatus: seniorLivingStatus || null,
        preferredLanguage: seniorPreferredLang || currentLanguage,
        language: currentLanguage
      };

      const result = await verifySeniorOTPAndCreateProfile(
        confirmationResult,
        otp,
        seniorData,
        actualFamilyUID
      );

      if (result.success) {
        // Clear temp data after successful registration
        clearTempData('seniorConfirmationResult');
        
        // Check if family member was successfully re-authenticated
        if (result.familyReAuthenticated) {
          Alert.alert(
            'Success! 🎉',
            `${seniorName} has been registered successfully!\n\nLinking Code: ${result.linkingCode}\n\nYou remain logged in and can continue managing seniors.`,
            [
              {
                text: 'Go to Dashboard',
                onPress: () => router.replace('/family/dashboard')
              }
            ]
          );
        } else if (result.requiresFamilyReAuth && result.familyPhone) {
          // If automatic re-auth failed, ask family member to log in again
          
          Alert.alert(
            'Success! 🎉',
            `${seniorName} has been registered successfully!\n\nLinking Code: ${result.linkingCode}\n\nPlease sign in again to continue.`,
            [
              {
                text: 'Sign In',
                onPress: () => {
                  router.replace({
                    pathname: '/family',
                    params: {
                      message: 'Senior registered successfully! Please log in to continue.',
                      linkingCode: result.linkingCode,
                      seniorName: seniorName
                    }
                  });
                }
              }
            ]
          );
        } else {
          // Fallback - shouldn't happen but just in case
          Alert.alert(
            'Success! 🎉',
            `${seniorName} has been registered and linked successfully!\n\nLinking Code: ${result.linkingCode}\n\nThis code can be used by other family members to link to ${seniorName}'s account.`,
            [
              {
                text: 'Go to Dashboard',
                onPress: () => router.replace('/family/dashboard')
              }
            ]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to register senior');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
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
              {translations.verifySeniorOTP}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        <View className="items-center mt-12">
          {/* Icon */}
          <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-6">
            <MaterialIcons name="phone-android" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-slate-900 mb-2 text-center">
            {translations.verifySeniorOTP}
          </Text>

          {/* Subtitle */}
          <Text className="text-base text-slate-600 mb-8 text-center px-4">
            {translations.otpSentToSenior}
          </Text>
          <Text className="text-lg font-semibold text-primary mb-8">
            +{seniorCallingCode} {seniorPhone}
          </Text>

          {/* OTP Input */}
          <View className="w-full mb-8">
            <TextInput
              className="border-2 border-gray-300 rounded-lg p-4 text-center text-2xl font-bold tracking-widest"
              placeholder="000000"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          {/* Verify Button */}
          <View className="w-full mb-4">
            <Button
              mode="contained"
              onPress={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="bg-primary"
              buttonColor={colors.primary}
              contentStyle={{ paddingVertical: 8 }}
            >
              {loading ? translations.creatingProfile : translations.verifyAndContinue}
            </Button>
          </View>

          {loading && (
            <View className="mt-4">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-sm text-slate-600 mt-2 text-center">
                {translations.creatingProfile}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
