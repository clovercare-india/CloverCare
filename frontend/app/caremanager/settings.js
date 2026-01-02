import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StatusBar, View, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import '../../global.css';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../firestore/sharedFirestore';
import {
  translations as translationData,
  loadLanguage,
  toggleLanguage,
} from '../../utils/i18n';

export default function CareManagerSettings() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState("en");

  const translations = translationData[currentLanguage];

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;
      
      setLoading(true);
      const profileData = await getUserProfile(user.uid);
      setProfile(profileData);
      setLoading(false);
    };

    fetchProfile();
  }, [user?.uid]);

  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
  };

  const handleLogout = () => {
    Alert.alert(
      translations.logout || 'Logout',
      translations.areYouSureLogout || 'Are you sure you want to logout?',
      [
        { text: translations.cancel || 'Cancel', style: 'cancel' },
        { 
          text: translations.logout || 'Logout', 
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              // Logout successful
            } else {
              Alert.alert(translations.error || 'Error', translations.failedToLogout || 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{translations.pleaseLoginToViewSettings || 'Please log in to view settings'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#5B718A" />
          <Text className="mt-4 text-gray-600">Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header with Navbar */}
      <View className="bg-white">
        <View className="px-4 py-3 flex-row justify-between items-center gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
            />
          </View>
        </View>
      </View>

      <View className="flex-1 bg-white">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#5B718A" />
            <Text className="mt-4 text-gray-600">{translations.loadingProfile || 'Loading profile...'}</Text>
          </View>
        ) : (
          <>
            {/* Profile Section */}
            <View className="items-center pt-8 pb-6 px-4">
              <View className="w-24 h-24 bg-primary rounded-full items-center justify-center mb-4">
                <MaterialIcons name="medical-services" size={48} color="#fff" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                {profile?.name || profile?.fullName || translations.careManager || "Care Manager"}
              </Text>
              <Text className="text-lg text-gray-600 text-center">
                {profile?.phone || translations.noPhoneNumber || "No phone number"}
              </Text>
            </View>

            {/* Language Toggle */}
            <View className="px-6 mb-6">
              <TouchableOpacity
                onPress={handleLanguageToggle}
                className="bg-white rounded-xl p-4 border border-gray-200"
                activeOpacity={0.7}
                style={{ elevation: 1 }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="language" size={24} color="#6b7280" />
                    <Text className="text-lg font-medium text-gray-900 ml-3">
                      {translations.language || 'Language'}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-base text-gray-500 mr-2">
                      {currentLanguage === "en" ? translations.english || "English" : translations.tamil || "தமிழ்"}
                    </Text>
                    <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View className="px-6 mb-32">
              <TouchableOpacity
                onPress={handleLogout}
                className="bg-white rounded-xl py-4 border-2 border-red-500"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="logout" size={24} color="#ef4444" />
                  <Text className="text-red-500 font-bold text-lg ml-2">{translations.logout || 'Logout'}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <CareManagerBottomNav />
    </SafeAreaView>
  );
}