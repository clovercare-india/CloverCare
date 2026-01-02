import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect,  useState } from "react";
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
  loadLanguage
} from "../../utils/i18n";
import { sendOTP, signOut } from "../../services/auth";
import { firestore } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs } from "@react-native-firebase/firestore";

export default function CareManagerLoginScreen() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [callingCode, setCallingCode] = useState("91");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const translations = translationData[currentLanguage];

  // Load saved language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Check if user is already logged in and redirect
  useEffect(() => {
    if (!authLoading && user && userProfile) {
      if (userProfile.role === 'caremanager') {
        router.replace('/caremanager/dashboard');
      } else {
        // Sign out if not a care manager
        signOut();
      }
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
    if (phoneNumber.length < 10 || phoneNumber.length > 10) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid 10-digit phone number'
      );
      return;
    }

    // Build full phone number
    const fullPhoneNumber = `+${callingCode}${phoneNumber}`;

    // Validate if phone is registered as care manager
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(
        usersRef,
        where('phone', '==', fullPhoneNumber),
        where('role', '==', 'caremanager')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        Alert.alert(
          'Access Denied',
          'This phone number is not registered as a Care Manager. Please contact your administrator.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to validate care manager status. Please try again.');
      return;
    }

    setLoading(true);

    try {
      // Send OTP using Firebase
      const result = await sendOTP(fullPhoneNumber);

      if (result.success) {
        // Navigate to OTP verification screen with verification ID
        router.replace({
          pathname: "/caremanager/verify-otp",
          params: {
            phoneNumber: phoneNumber,
            callingCode: callingCode,
            confirmationResult: JSON.stringify({
              verificationId: result.confirmationResult.verificationId,
            }),
          },
        });
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to send OTP. Please try again.'
        );
      }
    } catch (_error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1193d4" />
          <Text className="text-gray-500 mt-4">{translations.loading || 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f8" />

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
                    router.replace('/caremanager/dashboard');
                  }
                }}
                className="active:bg-gray-100 rounded-lg "
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color="#475569" />
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
                    className="w-full h-16 pl-28 text-lg bg-white border border-gray-200 rounded-lg text-gray-900"
                    placeholder={translations.mobileNumberPlaceholder}
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    maxLength={10}
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
                    shadowColor: "#5B718A",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                    opacity: loading ? 0.6 : 1,
                  }}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
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
