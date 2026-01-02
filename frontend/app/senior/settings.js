import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  View,
  Clipboard,
  TouchableOpacity,
  Share,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, TextInput, Dialog, Portal } from "react-native-paper";
import SeniorBottomNav from "../../components/SeniorBottomNav";
import CloverCareNavbar from "../../components/CloverCareNavbar";
import { colors } from "../../theme/colors";
import "../../global.css";
import {
  translations as translationData,
  loadLanguage,
  toggleLanguage,
  addLanguageChangeListener,
} from "../../utils/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfile } from "../../firestore/sharedFirestore";

export default function SettingsScreen() {
  const { user, userProfile, logout, setUserProfile } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const translations = translationData[currentLanguage];
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
  };

  const handleEditProfile = () => {
    setEditedName(userProfile?.name || "");
    setEditDialogVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.uid) {
      return;
    }

    if (!editedName.trim()) {
      Alert.alert(translations.error, translations.nameCannotBeEmpty);
      return;
    }
    setSaving(true);
    try {
      const result = await updateUserProfile(user.uid, {
        name: editedName.trim(),
      });

      if (result.success) {
        setUserProfile({
          ...userProfile,
          name: editedName.trim(),
        });
        setEditDialogVisible(false);
        Alert.alert(translations.success, translations.profileUpdatedSuccessfully);
      } else {
        Alert.alert("Error", result.error || "Failed to update profile");
      }
    } catch (error) {
      Alert.alert(translations.error, translations.failedToUpdateProfile);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogVisible(false);
  };

  const handleCopyCode = () => {
    if (userProfile?.linkingCode) {
      Clipboard.setString(userProfile.linkingCode);
      Alert.alert(translations.copied, translations.linkingCodeCopiedToClipboard);
    }
  };

  const handleShareCode = async () => {
    if (userProfile?.linkingCode) {
      try {
        const message = `${userProfile.name} has shared their linking code: ${userProfile.linkingCode}. Share this code with family members to allow them to view and manage my profile.`;
        await Share.share({
          message,
          title: translations.shareWithFamily || 'Share Linking Code'
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to share code');
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(translations.logout, translations.areYouSureYouWantToLogout, [
      {
        text: translations.cancel,
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          const result = await logout();
          if (!result.success) {
            Alert.alert(translations.error, translations.failedToLogout);
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

      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View className="items-center pt-8 pb-2 px-4">
          <View className="w-24 h-24 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.primary }}>
            <Text
              className="text-4xl font-bold text-white"
              style={{ color: colors.white }}
            >
              {userProfile?.name?.substring(0, 2).toUpperCase() || "EC"}
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-gray-900 text-center">
            {userProfile?.name || "User"}
          </Text>
          <Text className="text-base font-bold text-gray-500 text-center mt-2 mb-4">
            {userProfile?.phone || "No phone"}
          </Text>

          {/* Edit Profile Button - Right under profile */}
          <TouchableOpacity
            onPress={handleEditProfile}
            className="rounded-xl px-6 py-3 flex-row items-center"
            style={{ backgroundColor: colors.primary }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="edit" size={18} color={colors.white} />
            <Text
              className="font-bold text-base ml-2"
              style={{ color: colors.white }}
            >
              {translations.editProfile}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="h-2 my-6" />

        {/* Linking Code Section */}
        {userProfile?.linkingCode && (
          <View className="px-6 pb-4">
            <View className="rounded-2xl p-5 border" style={{ backgroundColor: colors.background.accent, borderColor: colors.border.accent }}>
              <View className="flex-row items-center justify-center mb-3">
                <MaterialIcons name="link" size={22} color={colors.primary} />
                <Text className="text-base font-bold text-gray-900 ml-2">
                  {translations.yourLinkingCode || "Your Linking Code"}
                </Text>
              </View>

              <Text className="text-xs text-gray-600 mb-3 text-center">
                {translations.shareWithFamily ||
                  "Share this code with your family member"}
              </Text>

              <View
                className="rounded-xl p-4 mb-4"
                style={{
                  backgroundColor: colors.white,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  className="text-3xl font-bold text-center tracking-widest"
                  style={{ color: colors.primary }}
                >
                  {userProfile.linkingCode}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Button
                  mode="contained"
                  onPress={handleCopyCode}
                  buttonColor={colors.primary}
                  icon="content-copy"
                  contentStyle={{ paddingVertical: 8 }}
                  labelStyle={{ fontSize: 15, fontWeight: "600" }}
                  style={{ flex: 1 }}
                >
                  {translations.copyCode || "Copy Code"}
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleShareCode}
                  icon="share"
                  contentStyle={{ paddingVertical: 8 }}
                  labelStyle={{ fontSize: 15, fontWeight: "600" }}
                  style={{ flex: 1 }}
                >
                  {translations.share || "Share"}
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="px-6 pb-4">
          {/* Manage Relations Button */}
          <TouchableOpacity
            onPress={() => router.push("/senior/manage-relations")}
            className="rounded-xl p-4 mb-3 border border-gray-200"
            style={{ backgroundColor: colors.white, elevation: 1 }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.background.lighter }}>
                  <MaterialIcons name="people" size={22} color={colors.secondary} />
                </View>
                <Text className="text-base font-semibold text-gray-900">
                  {translations.manageRelations || "Manage Relations"}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
            </View>
          </TouchableOpacity>

          {/* Language Toggle Button */}
          <TouchableOpacity
            onPress={handleLanguageToggle}
            className="rounded-xl p-4 mb-3 border border-gray-200"
            style={{ backgroundColor: colors.white, elevation: 1 }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.background.lighter }}>
                  <MaterialIcons name="language" size={22} color={colors.accent} />
                </View>
                <Text className="text-base font-semibold text-gray-900">
                  {translations.language || "Language"}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-sm font-medium text-gray-600 mr-2">
                  {currentLanguage === "en" ? translations.english : translations.tamil}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View className="px-6 pt-4 pb-32">
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-xl py-4 border"
            style={{ borderColor: colors.status.error }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-center">
              <MaterialIcons name="logout" size={22} color={colors.status.error} />
              <Text
                className="font-bold text-base ml-2"
                style={{ color: colors.status.error }}
              >
                {translations.logout || "Logout"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={handleCancelEdit} style={{ backgroundColor: 'white' }}>
          <Dialog.Title>{translations.editProfile}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={translations.name}
              value={editedName}
              onChangeText={setEditedName}
              mode="outlined"
              className="mb-3"
              activeOutlineColor={colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelEdit} disabled={saving}>
              {translations.cancel}
            </Button>
            <Button
              onPress={handleSaveProfile}
              loading={saving}
              disabled={saving}
            >
              {translations.save}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Bottom Navigation */}
      <SeniorBottomNav />
    </SafeAreaView>
  );
}
