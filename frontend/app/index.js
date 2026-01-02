import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar, Text as RNText, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import '../global.css';
import { translations as translationData, loadLanguage, toggleLanguage } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';

export default function RoleSelectionScreen() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  const translations = translationData[currentLanguage];

  // Load saved language preference on mount
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
      setIsLoading(false);
    };
    initLanguage();
  }, []);

  // Check if user is already logged in and redirect to dashboard
  useEffect(() => {
    if (!authLoading) {
      if (user && userProfile) {
        const role = userProfile.role;
        
        if (role === 'senior') {
          router.replace('/senior/dashboard');
        } else if (role === 'family') {
          router.replace('/family/dashboard');
        } else if (role === 'caremanager') {
          router.replace('/caremanager/dashboard');
        }
      }
    }
  }, [authLoading, user, userProfile]);

  // Handle language toggle
  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
  };

  // Handle role selection
  const handleRoleSelect = (role) => {
    if (role === 'senior') {
      router.push('/senior');
    } else if (role === 'family') {
      router.push('/family');
    }
  };

  // Handle care manager login
  const handleCareManagerLogin = () => {
    router.push('/caremanager');
  };

  if (isLoading || authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#5B718A" />
          <RNText className="text-gray-500 mt-4">Loading...</RNText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f8" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 pt-12">
        {/* Logo + App Name */}
        <View className="flex-row items-center gap-2">
          <Image
            source={require('../assets/logo.png')}
            style={{ width: 28, height: 28, resizeMode: 'contain' }}
          />
          <View className="flex-row items-center">
            <RNText style={{ fontSize: 18, fontWeight: 'bold', color: '#5B718A' }}>
              Clover
            </RNText>
            <RNText style={{ fontSize: 18, fontWeight: 'bold', color: '#8DAAA5', marginLeft: 4 }}>
              Care
            </RNText>
          </View>
        </View>

        {/* Language Toggle Button */}
        <TouchableOpacity
          onPress={handleLanguageToggle}
          className="flex-row items-center gap-1 px-3 py-2 rounded-lg active:bg-gray-100"
          activeOpacity={0.7}
        >
          <MaterialIcons name="language" size={18} color="#475569" />
          <RNText className="text-sm font-medium text-slate-600">
            {translations.languageToggle}
          </RNText>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View className="flex-1 justify-center items-center px-4">
        {/* Title */}
        <RNText className="text-2xl font-bold text-slate-800 mb-2 text-center">
          {translations.chooseRole}
        </RNText>
        
        {/* Description */}
        <RNText className="text-base text-slate-600 mb-12 text-center">
          {translations.chooseRoleDesc}
        </RNText>

        {/* Role Cards Container */}
        <View className="w-full max-w-md gap-6">
          
          {/* Senior Card */}
          <TouchableOpacity
            onPress={() => handleRoleSelect('senior')}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm active:scale-95"
            activeOpacity={0.9}
          >
            <View className="flex-row items-center gap-4">
              {/* Icon Circle */}
              <View className="bg-primary/10 p-3 rounded-full">
                <MaterialIcons name="person" size={32} color="#5B718A" />
              </View>
              
              {/* Text Content */}
              <View className="flex-1">
                <RNText className="text-lg font-bold text-slate-800 mb-1">
                  {translations.senior}
                </RNText>
                <RNText className="text-sm text-slate-600">
                  {translations.seniorDesc}
                </RNText>
              </View>
            </View>
          </TouchableOpacity>

          {/* Family Member Card */}
          <TouchableOpacity
            onPress={() => handleRoleSelect('family')}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm active:scale-95"
            activeOpacity={0.9}
          >
            <View className="flex-row items-center gap-4">
              {/* Icon Circle */}
              <View className="bg-primary/10 p-3 rounded-full">
                <MaterialIcons name="people" size={32} color="#5B718A" />
              </View>
              
              {/* Text Content */}
              <View className="flex-1">
                <RNText className="text-lg font-bold text-slate-800 mb-1">
                  {translations.familyMember}
                </RNText>
                <RNText className="text-sm text-slate-600">
                  {translations.familyMemberDesc}
                </RNText>
              </View>
            </View>
          </TouchableOpacity>

        </View>
      </View>

      {/* Footer */}
      <View className="items-center pb-6">
        <TouchableOpacity
          onPress={handleCareManagerLogin}
          className="py-2 active:opacity-70"
          activeOpacity={0.7}
        >
          <RNText className="text-sm text-slate-600 underline">
            {translations.careManagerLogin}
          </RNText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
