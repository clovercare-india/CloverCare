import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
import { colors } from "../../theme/colors";
import "../../global.css";
import { translations as translationData, loadLanguage, addLanguageChangeListener } from "../../utils/i18n";
import { sendOTP, checkUserRoleByPhone } from "../../services/auth";
import { useAuth } from "../../contexts/AuthContext";

export default function SeniorLoginScreen() {
  const { user, userProfile, loading: authLoading } = useAuth();
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
    if (!authLoading && user && userProfile && userProfile.role === 'senior') {
      router.replace('/senior/dashboard');
    }
  }, [authLoading, user, userProfile]);


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
        'Invalid Phone Number',
        'Please enter a valid 10-digit phone number',
        [{ text: 'OK' }]
      );
      return;
    }

    // Build full phone number
    const fullPhoneNumber = `+${callingCode}${phoneNumber.trim()}`;

    // Set loading state
    setLoading(true);

    try {
      // 1. Check if user exists and their role
      const roleCheck = await checkUserRoleByPhone(fullPhoneNumber);
      
      if (roleCheck.success && roleCheck.exists) {
        if (roleCheck.role !== 'senior') {
          Alert.alert(
            translations.accessDenied || 'Access Denied',
            translations.notASeniorAccount || 'This phone number is registered with a different role.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      }

      // 2. Send OTP using Firebase
      const result = await sendOTP(fullPhoneNumber);

      if (result.success) {
        // Navigate to OTP verification screen
        router.push({
          pathname: "/senior/verify-otp",
          params: {
            phoneNumber: phoneNumber.trim(),
            callingCode: callingCode,
            confirmationResult: JSON.stringify({
              verificationId: result.confirmationResult.verificationId
            })
          },
        });
      } else {
        let errorMessage = result.error || 'Failed to send OTP. Please try again.';
        
        // More descriptive error handling
        if (result.errorCode === 'auth/too-many-requests') {
          errorMessage = 'Too many attempts. Please try again later.';
        } else if (result.errorCode === 'auth/invalid-phone-number') {
          errorMessage = 'The phone number entered is invalid.';
        } else if (result.errorCode === 'auth/network-request-failed') {
          errorMessage = 'Network error. Please check your internet connection.';
        }

        Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      }
    } catch (_error) {
      Alert.alert(
        'Error',
        'Something went wrong. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4" style={{color: colors.primary}} >Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 justify-between">
            {/* Header */}
            <View className="flex-row justify-between items-center pt-4 mt-6">
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/senior/dashboard');
                  }
                }}
                className="active:bg-gray-100 rounded-lg "
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.text.muted} />
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
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#5B718A' }}>
                  Clover
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#8DAAA5', marginLeft: 6 }}>
                  Care
                </Text>
              </View>

              {/* Subtitle */}
              <Text className="text-base text-slate-600 mb-8 text-center">
                {translations.loginWithMobile}
              </Text>

              {/* Phone Number Input */}
              <View className="w-full max-w-md">
                <View className="relative">
                  <TextInput
                    className="w-full h-16 pl-28 text-lg bg-white border border-gray-200 rounded-lg "
                     style={{color: colors.primary}}
                    placeholder={translations.mobileNumberPlaceholder}
                    placeholderTextColor={colors.text.muted}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    maxLength={15}
                  />

                  {/* Country Code Prefix */}
                  <TouchableOpacity
                    onPress={() => setShowCountryPicker(true)}
                    className="absolute left-4 top-0 bottom-0 flex-row items-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-2xl mr-1">{countryCode === 'IN' ? '🇮🇳' : '🌍'}</Text>
                    <Text className="text-base text-slate-600">
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
                </View>

                {/* Send OTP Button */}
                <TouchableOpacity
                  onPress={handleSendOTP}
                  disabled={loading}
                  className="w-full h-14 bg-primary rounded-lg items-center justify-center mt-6 active:opacity-90"
                  style={{
                    shadowColor: colors.shadow,
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
            <View className="h-12" />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
