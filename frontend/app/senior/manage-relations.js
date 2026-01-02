import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  List,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import SeniorBottomNav from "../../components/SeniorBottomNav";
import CloverCareNavbar from "../../components/CloverCareNavbar";
import { colors } from "../../theme/colors";
import "../../global.css";
import { translations as translationData, loadLanguage, addLanguageChangeListener } from "../../utils/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { getCareManager } from "../../firestore/caremanagerFirestore";
import { getFamilyMembers } from "../../firestore/familyFirestore";

export default function ManageRelationsScreen() {
  const { userProfile, refreshProfile } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [careManager, setCareManager] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch care manager and family members
  useEffect(() => {
    const fetchRelations = async () => {
      if (!userProfile?.userId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch care manager
        if (userProfile.careManagerId) {
          const cmResult = await getCareManager(userProfile.careManagerId);
          if (cmResult.success) {
            setCareManager(cmResult.careManager);
          } else {
            setCareManager(null);
          }
        } else {
          setCareManager(null);
        }

        // Fetch family members
        if (userProfile.linkedFamily && userProfile.linkedFamily.length > 0) {
          const familyResult = await getFamilyMembers(userProfile.linkedFamily);
          if (familyResult.success) {
            setFamilyMembers(familyResult.familyMembers);
            familyResult.familyMembers.forEach(member => {
            });
          } else {
            setFamilyMembers([]);
          }
        } else {
          setFamilyMembers([]);
        }

        setLoading(false);
      } catch (_error) {
        setLoading(false);
      }
    };

    fetchRelations();
  }, [userProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Refresh the profile from Firestore
    await refreshProfile();
    
    setRefreshing(false);
  };

  const handleCall = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessage = (phone) => {
    Linking.openURL(`sms:${phone}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header with CloverCareNavbar */}
      <View className="bg-white border-b border-gray-100">
        <CloverCareNavbar
          showLogo={true}
          logoSize={32}
          appName="Clover Care"
          backgroundColor="white"
          showBackButton={true}
          onBackPress={() => router.replace('/senior/dashboard')}
        />
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Loading State */}
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-500 mt-4">{translations.loadingRelations}</Text>
          </View>
        ) : (
          <>
        {/* Care Manager Section */}
        {careManager && (
        <View className="px-5 py-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            {translations.careManager || "Care Manager"}
          </Text>

          <Card style={{ 
            backgroundColor: colors.white, 
            borderWidth: 1, 
            borderColor: colors.border.light,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <Card.Content className="py-4">
              <View className="items-center">
                <Avatar.Text
                  size={80}
                  label={careManager.name?.substring(0, 2).toUpperCase() || 'CM'}
                  style={{ backgroundColor: colors.primary }}
                />
                <Text className="text-xl font-bold text-gray-900 mt-3">
                  {careManager.name}
                </Text>
                <Text className="text-base text-gray-600 mt-1">
                  {translations.careManager || 'Care Manager'}: {careManager.phone}
                </Text>

                {/* Action Buttons */}
                <View className="flex-row gap-3 mt-4 w-full justify-center">
                  <Button
                    mode="contained"
                    icon="phone"
                    onPress={() => handleCall(careManager.phone)}
                    className="flex-1"
                    buttonColor={colors.primary}
                    contentStyle={{ paddingVertical: 4 }}
                    labelStyle={{ fontSize: 15, fontWeight: "600" }}
                  >
                    {translations.call || "Call"}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="message"
                    onPress={() => handleMessage(careManager.phone)}
                    className="flex-1"
                    textColor={colors.primary}
                    style={{ borderColor: colors.primary }}
                    contentStyle={{ paddingVertical: 4 }}
                    labelStyle={{ fontSize: 15, fontWeight: "600" }}
                  >
                    {translations.message || "Message"}
                  </Button>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
        )}

        {/* Family Members Section */}
        <View className="px-5 py-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            {translations.familyMembers || "Family Members"}
          </Text>

          {familyMembers.length === 0 ? (
            <Card style={{ 
              backgroundColor: colors.white, 
              borderWidth: 1, 
              borderColor: colors.border.light,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 3,
            }}>
              <Card.Content className="py-6 items-center">
                <MaterialIcons name="family-restroom" size={48} color="#cbd5e1" />
                <Text className="text-gray-500 mt-2 text-center">{translations.noFamilyMembersLinkedYet}</Text>
              </Card.Content>
            </Card>
          ) : (
          <Card style={{ 
            backgroundColor: colors.white, 
            borderWidth: 1, 
            borderColor: colors.border.light,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <Card.Content className="py-2">
              {familyMembers.map((member, index) => (
                <View key={member.userId}>
                  <List.Item
                    title={member.name}
                    description={`${member.role || 'Family'} · ${member.phone}`}
                    left={(props) => (
                      <Avatar.Text
                        size={48}
                        label={member.name?.substring(0, 2).toUpperCase() || 'FM'}
                        style={{ backgroundColor: colors.primary }}
                      />
                    )}
                    right={(props) => (
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => handleCall(member.phone)}
                          className="rounded-full p-2"
                          style={{ backgroundColor: colors.background.lighter }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="phone" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleMessage(member.phone)}
                          className="rounded-full p-2"
                          style={{ backgroundColor: colors.background.lighter }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="message" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {index < familyMembers.length - 1 && (
                    <View className="ml-16 mr-4">
                      <View className="border-b border-gray-200" />
                    </View>
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
          )}
        </View>

        <View className="h-24" />
        </>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <SeniorBottomNav />
    </SafeAreaView>
  );
}
