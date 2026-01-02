import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, ActivityIndicator } from "react-native-paper";
import FamilyBottomNav from "../../components/FamilyBottomNav";
import CloverCareNavbar from "../../components/CloverCareNavbar";
import { colors } from "../../theme/colors";
import "../../global.css";
import {
  translations as translationData,
  loadLanguage,
  toggleLanguage,
} from "../../utils/i18n";
import { useAuth } from "../../contexts/AuthContext";
import {
  getUserProfile,
} from "../../firestore/sharedFirestore";
import {
  getLinkedSeniorsWithDetails,
  getLatestCheckIn,
} from "../../firestore/familyFirestore";
import { firestore } from '../../config/firebase';
import { collection, doc, onSnapshot, query, where } from '@react-native-firebase/firestore';

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [userProfile, setUserProfile] = useState(null);
  const [linkedSeniors, setLinkedSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettingsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setUserProfile(profile);
      }

      // Fetch linked seniors
      const seniorsResult = await getLinkedSeniorsWithDetails(user.uid);
      if (seniorsResult.success) {
        // For each senior, get latest check-in to show last alert time
        const seniorsWithDetails = await Promise.all(
          seniorsResult.data.map(async (senior) => {
            const checkInResult = await getLatestCheckIn(senior.userId);
            let lastAlert = "Never checked in";
            if (checkInResult.success && checkInResult.data) {
              const checkInTime = checkInResult.data.createdAt.toDate();
              const now = new Date();
              const diffMs = now - checkInTime;
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffHours / 24);

              if (diffHours < 1) {
                lastAlert = "Less than 1 hour ago";
              } else if (diffHours < 24) {
                lastAlert = `${diffHours} hours ago`;
              } else {
                lastAlert = `${diffDays} days ago`;
              }
            }
            return {
              ...senior,
              lastAlert,
            };
          })
        );
        setLinkedSeniors(seniorsWithDetails);
      }
    } catch (err) {
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  useEffect(() => {
    if (user?.uid) {
      loadSettingsData();
    }
  }, [user, loadSettingsData]);

  useEffect(() => {
    if (!user?.uid) return;

    // Listener for user profile updates
    const unsubscribeUser = onSnapshot(doc(firestore, 'users', user.uid), (docSnap) => {
      if (docSnap.exists) {
        setUserProfile(docSnap.data());
      }
    });

    // Listener for linked seniors updates
    const unsubscribeSeniors = onSnapshot(
      query(
        collection(firestore, 'users'),
        where('linkedFamily', 'array-contains', user.uid),
        where('role', '==', 'senior')
      ),
      async (snapshot) => {
        const seniors = snapshot.docs.map((doc) => ({
          ...doc.data(),
          userId: doc.id,
        }));
        // Update last alert for each senior
        const seniorsWithDetails = await Promise.all(
          seniors.map(async (senior) => {
            const checkInResult = await getLatestCheckIn(senior.userId);
            let lastAlert = "Never checked in";
            if (checkInResult.success && checkInResult.data) {
              const checkInTime = checkInResult.data.createdAt.toDate();
              const now = new Date();
              const diffMs = now - checkInTime;
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffHours / 24);

              if (diffHours < 1) {
                lastAlert = "Less than 1 hour ago";
              } else if (diffHours < 24) {
                lastAlert = `${diffHours} hours ago`;
              } else {
                lastAlert = `${diffDays} days ago`;
              }
            }
            return {
              ...senior,
              lastAlert,
            };
          })
        );
        setLinkedSeniors(seniorsWithDetails);
      });

    return () => {
      unsubscribeUser();
      unsubscribeSeniors();
    };
  }, [user]);

  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
  };

  const handleSeniorPress = (seniorId) => {
    router.push(`/family/seniordetails/${seniorId}`);
  };

  const handleAddSenior = () => {
    Alert.alert("Add Senior", "Choose how to add a senior", [
      {
        text: "Register New Senior",
        onPress: () => router.replace("/family/register-senior"),
      },
      {
        text: "Link Existing Senior",
        onPress: () => router.replace("/family/link-senior"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          const result = await logout();
          if (result.success) {
            // Let AuthContext handle navigation
          } else {
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

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

      <ScrollView className="flex-1 bg-white" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-600 mt-4">{translations.loadingSettings || 'Loading settings...'}</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center py-20 px-4">
            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="error-outline" size={48} color={colors.status.error} />
            </View>
            <Text className="text-lg font-bold text-gray-900">{translations.errorLoadingData || 'Error Loading Data'}</Text>
            <Text className="text-red-600 mt-2 text-center">{error}</Text>
            <Button
              mode="contained"
              onPress={loadSettingsData}
              className="mt-6"
              buttonColor={colors.primary}
              contentStyle={{ paddingVertical: 8 }}
            >
              Retry
            </Button>
          </View>
        ) : (
          <>
            {/* Profile Section - Simple without card */}
            <View className="items-center pt-8 pb-6 px-4">
              <View className="w-24 h-24 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.primary }}>
                <MaterialIcons name="account-circle" size={48} color={colors.white} />
              </View>
              <Text className="text-3xl font-extrabold text-gray-900 text-center">
                {userProfile?.name || "Family Member"}
              </Text>
              <Text className="text-base font-bold text-gray-500 text-center mt-2">
                {userProfile?.role || "Family"}
              </Text>
            </View>

            {/* Linked Seniors Section */}
            <View className="px-6 pt-4 pb-2 bg-white">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center mr-3">
                    <MaterialIcons name="people" size={22} color={colors.status.success} />
                  </View>
                  <Text className="text-base font-bold text-gray-900">
                    {translations.linkedSeniors}
                  </Text>
                </View>
                <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                  <Text className="text-sm font-bold text-white">{linkedSeniors.length}</Text>
                </View>
              </View>

              {linkedSeniors.length === 0 ? (
                <View className="items-center py-8">
                  <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                    <MaterialIcons name="person-outline" size={32} color={colors.text.muted} />
                  </View>
                  <Text className="text-gray-500 text-center">{translations.noLinkedSeniorsYet || 'No linked seniors yet'}</Text>
                  <Text className="text-xs text-gray-400 text-center mt-1">{translations.addSeniorToGetStarted || 'Add a senior to get started'}</Text>
                </View>
              ) : (
                <View>
                  {linkedSeniors.map((senior, index) => (
                    <TouchableOpacity
                      key={senior.userId}
                      onPress={() => handleSeniorPress(senior.userId)}
                      className="flex-row items-center py-3 px-0 mb-3 bg-white rounded-xl border border-gray-100"
                      activeOpacity={0.7}
                    >
                      <View className="w-12 h-12 bg-gray-300 rounded-full items-center justify-center ml-3">
                        <Text className="text-white text-lg font-bold">
                          {(senior.name || senior.fullName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-base font-semibold text-gray-900 mb-1">
                          {senior.name || senior.fullName || "Unknown Senior"}
                        </Text>
                        <View className="flex-row items-center">
                          {senior.lastAlert !== "Never checked in" && (
                            <View className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                          )}
                          <Text className="text-xs text-gray-500">
                            {senior.lastAlert}
                          </Text>
                        </View>
                      </View>
                      <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.background.lighter }}>
                        <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Add Senior Button */}
              <View className="mt-2 pt-2">
                <Button
                  mode="contained"
                  onPress={handleAddSenior}
                  buttonColor={colors.primary}
                  icon="account-plus"
                  contentStyle={{ paddingVertical: 8 }}
                  labelStyle={{ fontSize: 15, fontWeight: '600' }}
                >
                  Add Senior
                </Button>
              </View>
            </View>

            {/* Preferences Section */}
            <View className="px-6 pt-6 pb-2 bg-white">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center mr-3">
                  <MaterialIcons name="tune" size={22} color={colors.secondary} />
                </View>
                <Text className="text-base font-bold text-gray-900">
                  {translations.preferences}
                </Text>
              </View>

              {/* Language Setting */}
              <TouchableOpacity
                onPress={handleLanguageToggle}
                className="bg-white rounded-xl p-4 mb-2 border border-gray-100"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="language" size={20} color={colors.text.muted} />
                    <Text className="text-base font-medium text-gray-900 ml-3">
                      {translations.language || 'Language'}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-500 mr-2">
                      {currentLanguage === "en" ? translations.english || "English" : translations.tamil || "தமிழ்"}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View className="px-6 pt-6 pb-32">
              <TouchableOpacity
                onPress={handleLogout}
                className="bg-white rounded-xl py-4 border-2 border-red-500"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="logout" size={20} color={colors.status.error} />
                  <Text className="text-red-500 font-bold text-base ml-2">{translations.logout || 'Logout'}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <FamilyBottomNav />
    </SafeAreaView>
  );
}
