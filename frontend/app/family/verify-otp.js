import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { colors } from '../../theme/colors';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parsePhoneNumber } from 'libphonenumber-js';
import { auth } from '../../config/firebase';
import { PhoneAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { sendOTP, getUserProfile, signOut } from '../../services/auth';
import { setTempData, clearTempData } from '../../utils/tempStorage';
import logger from '../../utils/logger';

export default function VerifyOTPScreen() {
  const params = useLocalSearchParams();
  const { phoneNumber, callingCode, confirmationResult } = params;

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(translationData.en);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits for Firebase
  const [resendTimer, setResendTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  
  // Refs for OTP inputs (6 inputs)
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Load saved language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();

    // Listen for language changes
    const removeListener = addLanguageChangeListener((newLang) => {
      setCurrentLanguage(newLang);
    });

    return removeListener;
  }, []);

  // Parse verification ID from confirmation result
  useEffect(() => {
    if (confirmationResult) {
      try {
        const parsed = JSON.parse(confirmationResult);
        setVerificationId(parsed.verificationId);
      } catch (_error) {
        // Error parsing confirmation result
      }
    }
  }, [confirmationResult]);

  // Update translations when language changes
  useEffect(() => {
    setTranslations(translationData[currentLanguage]);
  }, [currentLanguage]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Handle OTP input change
  const handleOtpChange = (value, index) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOTP(fullOtp);
      }
    }
  };

  // Handle backspace
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (otpCode) => {
    const fullOtp = otpCode || otp.join('');
    
    if (fullOtp.length !== 6) {
      Alert.alert(
        'Invalid OTP',
        'Please enter the complete 6-digit OTP',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!verificationId) {
      Alert.alert(
        'Error',
        'Verification session expired. Please request a new OTP.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);

    try {
      // Create credential with verification ID and OTP
      const credential = PhoneAuthProvider.credential(verificationId, fullOtp);
      
      // Sign in with the credential
      const result = await signInWithCredential(auth, credential);
      
      // Store family member's auth credentials temporarily for senior registration flow
      // This allows re-authentication after senior profile creation
      setTempData('familyAuthPhone', phoneNumber);
      setTempData('familyAuthVerificationId', verificationId);
      setTempData('familyAuthOtp', fullOtp);
      
      // Check if user profile exists
      const profileResult = await getUserProfile(result.user.uid);
      
      if (profileResult.success && profileResult.exists) {
        if (profileResult.profile.role === 'family') {
          router.replace('/family/dashboard');
        } else {
          // Block non-family users and sign them out
          // Clear stored credentials since this is not a valid family account
          clearTempData('familyAuthPhone');
          clearTempData('familyAuthVerificationId');
          clearTempData('familyAuthOtp');
          Alert.alert(
            translations.accessDenied || 'Access Denied',
            translations.notAFamilyAccount || 'This account is not a family account.',
            [{ text: 'OK', onPress: () => signOut().then(() => router.replace('/')) }]
          );
        }
      } else {
        // New user - redirect to profile setup
        let phoneParams = { userId: result.user.uid };
        
        try {
          // Try to parse phone number
          const parsed = parsePhoneNumber(result.user.phoneNumber);
          if (parsed) {
            phoneParams.phoneNumber = parsed.nationalNumber.toString();
            phoneParams.callingCode = parsed.countryCallingCode.toString();
          } else {
            phoneParams.fullPhoneNumber = result.user.phoneNumber;
          }
        } catch (_parseError) {
          // Fallback to full phone number
          phoneParams.fullPhoneNumber = result.user.phoneNumber;
        }
        
        router.replace({
          pathname: '/family/profile-setup',
          params: phoneParams,
        });
      }
      
    } catch (error) {
      let errorMessage = translations.invalidOtpCheckAndTryAgain || 'Invalid OTP. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = translations.invalidOtpCheckAndTryAgain || 'Invalid OTP. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = translations.otpExpired || 'OTP has expired. Please request a new one.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = translations.networkError || 'Network error. Please check your connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = translations.tooManyRequests || 'Too many attempts. Please try again later.';
      } else {
        logger.error('familyVerifyOTP', 'Unexpected error during OTP verification', error);
      }
      
      Alert.alert(
        translations.verificationFailed || 'Verification Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    const fullPhoneNumber = `+${callingCode}${phoneNumber}`;
    
    setLoading(true);
    
    try {
      const result = await sendOTP(fullPhoneNumber);
      
      if (result.success) {
        // Update verification ID
        if (result.confirmationResult && result.confirmationResult.verificationId) {
          setVerificationId(result.confirmationResult.verificationId);
        }
        
        // Reset timer and OTP inputs
        setResendTimer(30);
        setOtp(['', '', '', '', '', '']);
        inputRefs[0].current?.focus();
        
        Alert.alert(
          'OTP Sent',
          'A new OTP has been sent to your phone',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to resend OTP',
          [{ text: 'OK' }]
        );
      }
    } catch (_error) {
      Alert.alert(
        'Error',
        'Failed to resend OTP. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 justify-between">
            
            {/* Header */}
            <View className="flex-row justify-between items-center pt-4 mt-8">
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/family/dashboard');
                  }
                }}
                className="p-2 active:bg-gray-100 rounded-lg"
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View className="flex-1 justify-center items-center">
              
              {/* Logo */}
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 80, height: 80, marginBottom: 24, resizeMode: 'contain' }}
              />

              {/* Title */}
              <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                {translations.verifyOTP}
              </Text>

              {/* Subtitle */}
              <Text className="text-base text-slate-600 mb-2 text-center">
                {translations.otpSentTo}
              </Text>
              <Text className="text-base font-semibold text-gray-900 mb-8">
                +{callingCode} {phoneNumber}
              </Text>

              {/* OTP Input */}
              <View className="w-full max-w-md mb-6">
                <Text className="text-sm text-slate-600 mb-4 text-center">
                  {translations.enterOTP}
                </Text>
                
                <View className="flex-row justify-center gap-2">
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={inputRefs[index]}
                      className="w-12 h-14 text-center text-2xl font-bold bg-white border border-gray-200 rounded-lg text-gray-900"
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      selectTextOnFocus
                      editable={!loading}
                    />
                  ))}
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  onPress={() => handleVerifyOTP()}
                  disabled={loading}
                  className="w-full h-14 bg-primary rounded-lg items-center justify-center mt-6 active:opacity-90"
                  style={{
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                    opacity: loading ? 0.6 : 1,
                  }}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text className="text-white text-lg font-bold">
                      {translations.verifyAndContinue}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View className="items-center mb-32">
              <Text className="text-sm text-slate-600 mb-2">
                {translations.didntReceiveCode}
              </Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendTimer > 0}
                className="py-2"
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    resendTimer > 0 ? 'text-slate-400' : 'text-primary underline'
                  }`}
                >
                  {resendTimer > 0
                    ? `${translations.resendOTP} (${resendTimer}s)`
                    : translations.resendOTP}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
