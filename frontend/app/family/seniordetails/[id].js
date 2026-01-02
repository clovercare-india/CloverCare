import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, ScrollView, Share, StatusBar, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { colors } from '../../../theme/colors';
import '../../../global.css';
import { translations as translationData, loadLanguage } from '../../../utils/i18n';
import { getUserProfile } from '../../../firestore/sharedFirestore';
import { getFamilyMembers, removeSeniorLink, getHealthLogsForLinkedSenior } from '../../../firestore/familyFirestore';
import { configureScheduledCheckIn, getScheduledCheckIn, getCareManager } from '../../../firestore/caremanagerFirestore';
import { useAuth } from '../../../contexts/AuthContext';
import ConfigureCheckInModal from '../../../components/ConfigureCheckInModal';
import CloverCareNavbar from '../../../components/CloverCareNavbar';

export default function SeniorDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [senior, setSenior] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [checkInConfig, setCheckInConfig] = useState(null);
  const [healthLogs, setHealthLogs] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];

  useEffect(() => {
    loadLanguage().then(setCurrentLanguage);
  }, []);

  const loadSeniorDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get basic senior profile
      const seniorProfile = await getUserProfile(id);
      if (!seniorProfile) {
        throw new Error('Senior not found');
      }

      // Get care manager info
      const careManagerResult = await getCareManager(seniorProfile.careManagerId);
      const careManager = careManagerResult.success ? careManagerResult.careManager : null;

      // Get linked family members
      const familyResult = await getFamilyMembers(seniorProfile.linkedFamily || []);
      const linkedFamilyMembers = familyResult.success ? familyResult.familyMembers : [];

      // Get health logs (latest 3 only)
      const healthLogsResult = await getHealthLogsForLinkedSenior(id);
      if (healthLogsResult.success) {
        // Get only the latest 3 logs (they're already sorted by createdAt desc)
        const latestLogs = healthLogsResult.logs.slice(0, 3);
        setHealthLogs(latestLogs);
      }

      // Get check-in configuration
      const configResult = await getScheduledCheckIn(id);
      if (configResult.success && configResult.config) {
        setCheckInConfig(configResult.config);
        setCheckInEnabled(true);
      } else {
        setCheckInConfig(null);
        setCheckInEnabled(false);
      }

      // Build senior data
      const seniorData = {
        ...seniorProfile,
        name: seniorProfile.name || seniorProfile.fullName || 'Unknown Senior',
        phone: seniorProfile.phoneNumber || seniorProfile.phone,
        age: seniorProfile.age || 'N/A',
        gender: seniorProfile.gender || 'N/A',
        linkingCode: seniorProfile.linkingCode || 'N/A',
        careManager: careManager ? {
          id: careManager.id || seniorProfile.careManagerId,
          name: careManager.name || 'Care Manager',
          phone: careManager.phoneNumber || careManager.phone
        } : {
          id: seniorProfile.careManagerId,
          name: 'Not Assigned',
          phone: undefined
        },
        linkedFamilyMembers: linkedFamilyMembers.filter(member => member).map(member => ({
          name: member?.name || member?.fullName || 'Unknown',
          relation: member?.role || 'family',
          role: member?.role || 'family'
        }))
      };

      setSenior(seniorData);
    } catch (err) {
      setError(err.message || 'Failed to load senior details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadSeniorDetails();
    }
  }, [id, loadSeniorDetails]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-base text-gray-600">{translations.loading || 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <MaterialIcons name="error-outline" size={64} color={colors.status.error} />
        <Text className="mt-4 text-lg font-bold text-gray-900">{translations.error || 'Error'}</Text>
        <Text className="mt-2 text-sm text-gray-600 text-center px-4">{error}</Text>
        <TouchableOpacity onPress={loadSeniorDetails} className="mt-6 bg-primary px-4 py-2 rounded-lg">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!senior) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-lg text-gray-600">Senior not found</Text>
      </SafeAreaView>
    );
  }

  // Simple phone call function
  const handleCall = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber === 'No phone' || phoneNumber === '-') {
      Alert.alert('Error', 'Phone number not available');
      return;
    }
    
    try {
      // Clean phone number: remove spaces, dashes, parentheses
      const cleanPhone = String(phoneNumber).replace(/[\s\-()]/g, '');
      await Linking.openURL(`tel:${cleanPhone}`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to open phone app');
    }
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(senior.linkingCode);
    Alert.alert('Success', 'Code copied to clipboard');
  };

  const handleShareCode = async () => {
    try {
      const message = `${senior.name} has shared their linking code: ${senior.linkingCode}`;
      await Share.share({ message });
    } catch (_error) {
      Alert.alert('Error', 'Failed to share code');
    }
  };

  const handleConfigureCheckIn = () => {
    setCheckInModalVisible(true);
  };

  const handleDismissCheckInModal = () => {
    setCheckInModalVisible(false);
  };

  const handleSaveCheckInConfig = async (configData) => {
    if (!user?.uid || !id || !configData) {
      Alert.alert('Error', 'Missing required information');
      return false;
    }

    try {
      const result = await configureScheduledCheckIn(id, senior?.careManager?.id || user.uid, configData);
      
      if (result && result.success) {
        setCheckInConfig({
          ...configData,
          seniorId: id,
          careManagerId: senior?.careManager?.id || user.uid
        });
        setCheckInEnabled(true);
        setCheckInModalVisible(false);
        Alert.alert('Success', 'Configuration saved successfully');
        return true;
      } else {
        Alert.alert('Error', result?.error || 'Failed to save configuration');
        return false;
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to save configuration');
      return false;
    }
  };

  const handleInviteFamilyMember = () => {
    Alert.alert(
      'Invite Family Member',
      'Share the linking code with family members.',
      [
        { text: 'Share Code', onPress: handleShareCode },
        { text: 'Copy Code', onPress: handleCopyCode },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleRemoveSenior = async () => {
    Alert.alert(
      'Remove Senior',
      `Are you sure you want to remove ${senior.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await removeSeniorLink(user.uid, id);
              if (result.success) {
                Alert.alert('Success', 'Senior removed successfully', [
                  { text: 'OK', onPress: () => router.replace('/family/dashboard') }
                ]);
              } else {
                Alert.alert('Error', 'Failed to remove senior');
              }
            } catch (_error) {
              Alert.alert('Error', 'Failed to remove senior');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <CloverCareNavbar 
        showBackButton={true}
        onBackPress={() => router.replace('/family/dashboard')}
        appName="Senior Details"
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Senior Profile Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5">
          <View className="flex-row items-center">
            <View className="w-20 h-20 bg-primary rounded-full items-center justify-center">
              <Text className="text-2xl font-bold text-white">
                {senior.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-2xl font-bold text-gray-900">{senior.name}</Text>
              <View className="flex-row items-center mt-2">
                <View className="bg-gray-100 px-3 py-1 rounded-full mr-2">
                  <Text className="text-xs font-semibold text-gray-700">{senior.age} years</Text>
                </View>
                <View className="bg-gray-100 px-3 py-1 rounded-full">
                  <Text className="text-xs font-semibold text-gray-700">{senior.gender}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Phone Number (Read-only) */}
          {senior.phone && (
            <View className="mt-4 bg-primary/10 rounded-xl p-3.5 flex-row items-center">
              <View className="w-9 h-9 bg-primary rounded-lg items-center justify-center mr-3">
                <MaterialIcons name="phone" size={20} color={colors.white} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-600 font-medium">{translations.phoneNumber || 'Phone Number'}</Text>
                <Text className="text-base font-bold text-primary mt-0.5">{senior.phone}</Text>
              </View>
            </View>
          )}

          {/* Linking Code */}
          <View className="mt-4 pt-4 border-t border-gray-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-gray-600">{translations.linkingCode || 'Linking Code'}</Text>
              <View className="flex-row items-center">
                <View className="bg-gray-100 px-3 py-1.5 rounded-lg mr-2">
                  <Text className="text-base font-bold text-gray-900">{senior.linkingCode}</Text>
                </View>
                <TouchableOpacity onPress={handleCopyCode} className="w-8 h-8 bg-gray-100 rounded-lg items-center justify-center mr-1">
                  <MaterialIcons name="content-copy" size={18} color={colors.text.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareCode} className="w-8 h-8 bg-primary/10 rounded-lg items-center justify-center">
                  <MaterialIcons name="share" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Care Manager Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-secondary/20 rounded-xl items-center justify-center mr-3">
              <MaterialIcons name="medical-services" size={22} color={colors.secondary} />
            </View>
            <Text className="text-lg font-bold text-gray-900">{translations.careManager || 'Care Manager'}</Text>
          </View>
          
          <View className="bg-secondary/10 rounded-xl p-4">
            <Text className="text-base font-bold text-gray-900 mb-3">{senior.careManager.name}</Text>
            
            {senior.careManager.phone && (
              <TouchableOpacity
                onPress={() => handleCall(senior.careManager.phone)}
                className="bg-white rounded-lg p-3 flex-row items-center"
              >
                <View className="w-8 h-8 bg-secondary/20 rounded-lg items-center justify-center mr-3">
                  <MaterialIcons name="phone" size={18} color={colors.secondary} />
                </View>
                <Text className="flex-1 text-sm font-semibold text-secondary">{senior.careManager.phone}</Text>
                <MaterialIcons name="call" size={18} color={colors.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Check-In Notifications Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-accent/20 rounded-xl items-center justify-center mr-3">
              <MaterialIcons name="notifications-active" size={22} color={colors.accent} />
            </View>
            <Text className="text-lg font-bold text-gray-900">{translations.checkInNotifications || 'Check-In Notifications'}</Text>
          </View>
          
          <View className="bg-gray-50 rounded-xl p-4">
            {checkInEnabled && checkInConfig ? (
              <>
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{translations.checkInTimes || 'Check-in Times'}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {checkInConfig.checkInTimes?.map((time, index) => (
                      <View key={index} className="bg-primary/10 px-3 py-2 rounded-lg">
                        <Text className="text-sm font-bold text-primary">{time}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{translations.checkInOptions || 'Check-in Options'}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {checkInConfig.checkInOptions?.slice(0, 3).map((option, index) => (
                      <View key={index} className="bg-gray-100 px-3 py-2 rounded-lg flex-row items-center">
                        <MaterialIcons 
                          name={option.icon || 'sentiment-satisfied'} 
                          size={16} 
                          color={option.color || colors.status.success} 
                        />
                        <Text className="text-xs font-medium text-gray-700 ml-1">{option.label}</Text>
                      </View>
                    ))}
                    {checkInConfig.checkInOptions?.length > 3 && (
                      <View className="bg-gray-100 px-3 py-2 rounded-lg">
                        <Text className="text-xs font-medium text-gray-700">+{checkInConfig.checkInOptions.length - 3} more</Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleConfigureCheckIn}
                  className="bg-primary rounded-lg p-3 flex-row items-center justify-center"
                >
                  <MaterialIcons name="settings" size={18} color={colors.white} />
                  <Text className="text-white font-semibold ml-2">{translations.editConfiguration || 'Edit Configuration'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View className="items-center py-6">
                <MaterialIcons name="notifications-off" size={28} color={colors.status.warning} />
                <Text className="text-sm text-gray-500 my-4">{translations.noCheckInConfigured || 'No check-in notifications configured'}</Text>
                <TouchableOpacity 
                  onPress={handleConfigureCheckIn}
                  className="bg-primary rounded-lg p-3 flex-row items-center justify-center"
                >
                  <MaterialIcons name="add" size={18} color={colors.white} />
                  <Text className="text-white font-semibold ml-2">{translations.configureCheckIn || 'Configure Check-In'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Health Logs Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
                <MaterialIcons name="favorite" size={22} color={colors.primary} />
              </View>
              <Text className="text-lg font-bold text-gray-900">{translations.latestHealthLogs || 'Latest Health Logs'}</Text>
            </View>
            {healthLogs.length > 0 && (
              <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                <Text className="text-xs font-bold text-primary">{healthLogs.length}</Text>
              </View>
            )}
          </View>

          {healthLogs.length === 0 ? (
            <View className="items-center py-6">
              <MaterialIcons name="favorite-border" size={28} color={colors.primary} />
              <Text className="text-sm text-gray-500 mt-2">{translations.noHealthLogsAvailable || 'No health logs available'}</Text>
              <Text className="text-xs text-gray-400 mt-1">{translations.healthLogsAddedWillAppear || 'Health logs added by care manager will appear here'}</Text>
            </View>
          ) : (
            healthLogs.map((log, index) => (
              <View key={log.id || index} className="mb-3 bg-gray-50 rounded-xl p-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-xs font-semibold text-gray-600">
                    {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                  </Text>
                  <MaterialIcons name="favorite" size={16} color={colors.primary} />
                </View>
                
                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1 bg-white rounded-lg p-2.5">
                    <Text className="text-xs text-gray-500 font-semibold mb-1">{translations.bp || 'BP'}</Text>
                    <Text className="text-sm font-bold text-gray-900">{log.vitals?.bloodPressure || 'N/A'}</Text>
                  </View>
                  <View className="flex-1 bg-white rounded-lg p-2.5">
                    <Text className="text-xs text-gray-500 font-semibold mb-1">{translations.sugar || 'Sugar'}</Text>
                    <Text className="text-sm font-bold text-gray-900">{log.vitals?.bloodSugar || 'N/A'}</Text>
                  </View>
                  <View className="flex-1 bg-white rounded-lg p-2.5">
                    <Text className="text-xs text-gray-500 font-semibold mb-1">{translations.temp || 'Temp'}</Text>
                    <Text className="text-sm font-bold text-gray-900">{log.vitals?.temperature || 'N/A'}°F</Text>
                  </View>
                </View>
                
                {log.notes && (
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-xs text-gray-600 font-medium mb-1">{translations.notes || 'Notes'}</Text>
                    <Text className="text-xs text-gray-700">{log.notes}</Text>
                  </View>
                )}

                {log.careManagerName && (
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-xs text-gray-500 font-medium">{translations.addedByLabel || 'Added by:'} {log.careManagerName}</Text>
                  </View>
                )}
              </View>
            ))
          )}

          {/* View All Button */}
          {healthLogs.length > 0 && (
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/family/health-logs',
                params: { seniorId: id, seniorName: senior?.name || senior?.fullName || 'Senior' }
              })}
              className="mt-2 rounded-xl py-3 items-center"
              style={{ backgroundColor: colors.background.lighter, borderWidth: 1, borderColor: colors.primary }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="visibility" size={18} color={colors.primary} />
                <Text className="text-sm font-bold ml-2" style={{ color: colors.primary }}>
                  View All Health Logs
                </Text>
                <MaterialIcons name="arrow-forward" size={16} color={colors.primary} className="ml-1" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Linked Family Members Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-secondary/20 rounded-xl items-center justify-center mr-3">
                <MaterialIcons name="groups" size={22} color={colors.secondary} />
              </View>
              <Text className="text-lg font-bold text-gray-900">Family Members</Text>
            </View>
            <View className="bg-secondary/20 px-2.5 py-1 rounded-full">
              <Text className="text-xs font-bold text-secondary">
                {senior.linkedFamilyMembers?.length || 0}
              </Text>
            </View>
          </View>

          {senior.linkedFamilyMembers && senior.linkedFamilyMembers.length > 0 ? (
            senior.linkedFamilyMembers.map((member, index) => (
              <View 
                key={index} 
                className="flex-row items-center py-3 mb-2 bg-gray-50 rounded-xl px-3"
              >
                <View className="w-10 h-10 bg-secondary/20 rounded-full items-center justify-center mr-3">
                  <MaterialIcons name="person" size={20} color={colors.secondary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">{member.name}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {member.relation === 'owner' ? 'Owner' :
                     member.relation === 'son' ? 'Son' :
                     member.relation === 'daughter' ? 'Daughter' :
                     member.relation || 'Family'}
                  </Text>
                </View>
                <View className="bg-secondary/10 px-2.5 py-1 rounded-full">
                  <Text className="text-xs font-semibold text-secondary capitalize">{member.role}</Text>
                </View>
              </View>
            ))
          ) : (
            <View className="items-center py-6">
              <MaterialIcons name="people-outline" size={28} color={colors.secondary} />
              <Text className="text-sm text-gray-500 mt-2">{translations.noLinkedFamilyMembers || 'No linked family members'}</Text>
            </View>
          )}

          <View className="mt-4 pt-4 border-t border-gray-100">
            <TouchableOpacity
              onPress={handleInviteFamilyMember}
              className="bg-primary rounded-xl p-3 flex-row items-center justify-center"
            >
              <MaterialIcons name="person-add" size={18} color={colors.white} />
              <Text className="text-white font-semibold ml-2">Invite Family Member</Text>
            </TouchableOpacity>
          </View>
        </View>

          {/* Remove Senior Section */}
        <View className="mx-4 mt-4 mb-32">
          <TouchableOpacity
            onPress={handleRemoveSenior}
            className="border-2 border-red-500 rounded-xl p-3 flex-row items-center justify-center"
            style={{ borderColor: colors.status.error }}
          >
            <MaterialIcons name="person-remove" size={18} color={colors.status.error} />
            <Text className="font-semibold ml-2" style={{ color: colors.status.error }}>Remove Senior</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Configure Check-In Modal */}
      <ConfigureCheckInModal
        visible={checkInModalVisible}
        onDismiss={handleDismissCheckInModal}
        seniorId={id}
        seniorName={senior?.name || senior?.fullName}
        onSave={handleSaveCheckInConfig}
        existingConfig={checkInConfig}
        loading={false}
      />
    </SafeAreaView>
  );
}
