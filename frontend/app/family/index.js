import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import CountrySelect from 'react-native-country-select';
import "../../global.css";
import {
  translations as translationData,
  loadLanguage,
  addLanguageChangeListener,
} from "../../utils/i18n";
import { sendOTP, checkUserRoleByPhone } from "../../services/auth";
import { useAuth } from "../../contexts/AuthContext";

export default function FamilyLoginScreen() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const params = useLocalSearchParams();
  const { message, linkingCode, seniorName } = params;
  
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [callingCode, setCallingCode] = useState("91");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // Check if user is already logged in and redirect
  useEffect(() => {
    if (!authLoading && user && userProfile && userProfile.role === 'family') {
      router.push('/family/dashboard');
    }
  }, [authLoading, user, userProfile]);

  // Show success message if coming from senior registration
  useEffect(() => {
    if (message) {
      setTimeout(() => {
        Alert.alert(
          'Registration Complete! 🎉',
          `${seniorName || 'Senior'} has been registered successfully!\n\nLinking Code: ${linkingCode}\n\nPlease log in to continue.`,
          [{ text: 'OK' }]
        );
      }, 500);
    }
  }, [message, linkingCode, seniorName]);

  // Handle country selection
  const onSelectCountry = (country) => {
    setCountryCode(country.cca2);
    // country.idd format: { root: "+1", suffixes: ["242", "246"] }
    // Extract just the root without the + sign
    const dialCode = country.idd?.root?.replace('+', '') || '1';
    setCallingCode(dialCode);
    setShowCountryPicker(false);
  };

  // Handle Send OTP
  const handleSendOTP = async () => {
    // Validate phone number
    if (phoneNumber.trim().length < 10) {
      Alert.alert(
        translations.invalidPhoneNumber || "Invalid Phone Number",
        translations.pleaseEnterValidPhone || "Please enter a valid 10-digit phone number"
      );
      return;
    }

    // Build full phone number
    const fullPhoneNumber = `+${callingCode}${phoneNumber.trim()}`;

    setLoading(true);

    try {
      // 1. Check if user exists and their role
      const roleCheck = await checkUserRoleByPhone(fullPhoneNumber);
      
      if (roleCheck.success && roleCheck.exists) {
        if (roleCheck.role !== 'family') {
          Alert.alert(
            translations.accessDenied || 'Access Denied',
            translations.notAFamilyAccount || 'This phone number is registered with a different role.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      }

      // 2. Send OTP using Firebase
      const result = await sendOTP(fullPhoneNumber);

      if (result.success) {
        // Navigate to OTP verification screen with verification ID
        router.push({
          pathname: "/family/verify-otp",
          params: {
            phoneNumber: phoneNumber.trim(),
            callingCode: callingCode,
            confirmationResult: JSON.stringify({
              verificationId: result.confirmationResult.verificationId,
            }),
          },
        });
      } else {
        let errorMessage = result.error || "Failed to send OTP. Please try again.";
        
        if (result.errorCode === 'auth/too-many-requests') {
          errorMessage = translations.tooManyRequests || 'Too many attempts. Please try again later.';
        } else if (result.errorCode === 'auth/network-request-failed') {
          errorMessage = translations.networkError || 'Network error. Please check your connection.';
        }

        Alert.alert("Error", errorMessage);
      }
    } catch (_error) {
      Alert.alert("Error", translations.somethingWentWrong || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-gray-500 mt-4">{translations.loading || 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row justify-between items-center pt-4 mt-6 px-4">
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/');
                  }
                }}
                className="active:bg-gray-100 rounded-lg"
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View className="flex-1 justify-center items-center mb-32">
              {/* Logo */}
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 80, height: 80, marginBottom: 24, resizeMode: 'contain' }}
              />

              {/* Title */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>
                  Clover
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.secondary, marginLeft: 6 }}>
                  Care
                </Text>
              </View>

              {/* Subtitle */}
              <Text className="text-base text-slate-600 mb-8 text-center">
                {translations.accessToElders}
              </Text>

              {/* Phone Number Input */}
              <View className="w-full max-w-md mb-4">
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg">
                  <TouchableOpacity
                    onPress={() => setShowCountryPicker(true)}
                    className="flex-row items-center px-4 py-3"
                    activeOpacity={0.7}
                  >
                    <Text className="text-2xl mr-2">{countryCode === 'IN' ? '🇮🇳' : '🌍'}</Text>
                    <Text className="text-base text-slate-600 ml-1">
                      +{callingCode}
                    </Text>
                    <View className="w-px h-6 bg-gray-200 ml-2" />
                  </TouchableOpacity>
                  <CountrySelect
                    visible={showCountryPicker}
                    onClose={() => setShowCountryPicker(false)}
                    onSelect={(country) => onSelectCountry(country)}
                    popularCountries={['IN', 'US', 'GB', 'CA']}
                    language="eng"
                    modalType="bottomSheet"
                    showSearchInput={true}
                  />
                  <TextInput
                    className="flex-1 h-14 text-lg text-gray-900"
                    placeholder={translations.mobileNumber}
                    placeholderTextColor={colors.text.muted}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    maxLength={15}
                  />
                </View>

                {/* Send OTP Button */}
                <TouchableOpacity
                  onPress={handleSendOTP}
                  disabled={loading}
                  className="w-full h-14 bg-primary rounded-lg items-center justify-center mt-4"
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
                      {translations.sendOTP}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer Spacer */}
            <View className="h-12" />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
