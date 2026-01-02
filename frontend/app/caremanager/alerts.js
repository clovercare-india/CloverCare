import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StatusBar, TouchableOpacity, View, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Text, ActivityIndicator } from 'react-native-paper';
import { firestore } from '../../config/firebase';
import { doc, getDoc } from '@react-native-firebase/firestore';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import AlertHistoryModal from '../../components/AlertHistoryModal';
import '../../global.css';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { 
  resolveAlert,
  listenToAssignedSeniorIds,
  listenToAlertsForAssignedSeniors
} from '../../firestore/caremanagerFirestore';
import { getFamilyMembers } from '../../firestore/familyFirestore';
import { colors } from '../../theme/colors';export default function CareManagerAlertsScreen() {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];
  const [selectedSeniorFilter, setSelectedSeniorFilter] = useState('all');
  const [seniorMenuVisible, setSeniorMenuVisible] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Family modal states
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [selectedAlertForFamily, setSelectedAlertForFamily] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  
  // Resolve modal states
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  
  // History modal state
  const [historyVisible, setHistoryVisible] = useState(false);
  const [assignedSeniors, setAssignedSeniors] = useState([]);

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

  // Set up real-time alerts listener
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Listen to real-time changes in assigned seniors (when reassigned from admin)
    const unsubscribeAssignedSeniors = listenToAssignedSeniorIds(user.uid, (seniorIds) => {
      if (seniorIds.length === 0) {
        setAssignedSeniors([]);
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Listen to alerts for assigned seniors
      listenToAlertsForAssignedSeniors(seniorIds, async (alertsData) => {
        // Enrich alerts with senior phone numbers and build seniors map
        const seniorsMap = new Map();
        const enrichedAlerts = await Promise.all(
          alertsData.map(async (alert) => {
            try {
              const seniorDoc = await getDoc(doc(firestore, 'users', alert.userId));
              if (seniorDoc.exists()) {
                const seniorData = seniorDoc.data();
                const seniorName = seniorData.name || seniorData.fullName || 'Unknown Senior';
                
                // Build seniors map for history modal
                if (!seniorsMap.has(alert.userId)) {
                  seniorsMap.set(alert.userId, {
                    id: alert.userId,
                    userId: alert.userId,
                    name: seniorName,
                    fullName: seniorName
                  });
                }
                
                return {
                  ...alert,
                  seniorPhone: seniorData.phone || alert.seniorPhone,
                  seniorName: seniorName
                };
              }
            } catch (_error) {
            }
            return alert;
          })
        );
        
        // Set seniors for history modal
        const seniorsArray = Array.from(seniorsMap.values()); 
        setAssignedSeniors(seniorsArray);
        
        setAlerts(enrichedAlerts);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribeAssignedSeniors) unsubscribeAssignedSeniors();
    };
  }, [user?.uid]);

  // Reset pagination when senior filter changes
  useEffect(() => {
    setDisplayCount(10);
  }, [selectedSeniorFilter]);

  const handleCall = async (phoneNumber, seniorName) => {
    if (!phoneNumber || phoneNumber === 'No phone' || phoneNumber === '-') {
      Alert.alert(
        translations.error || 'Error',
        `No phone number available for ${seniorName}`
      );
      return;
    }
    
    try {
      const cleanedPhone = String(phoneNumber).replace(/[\s\-()]/g, '');
      await Linking.openURL(`tel:${cleanedPhone}`);
    } catch (_error) {
      Alert.alert(translations.error, translations.failedToInitiateCall);
    }
  };

  const handleCallFamily = async (alert) => {
    setSelectedAlertForFamily(alert);
    setLoadingFamily(true);
    setFamilyModalVisible(true);
    
    try {
      // Get senior's linked family directly from user document
      const seniorDoc = await getDoc(doc(firestore, 'users', alert.userId));
      if (seniorDoc.exists()) {
        const seniorData = seniorDoc.data();
        if (seniorData.linkedFamily && seniorData.linkedFamily.length > 0) {
          const familyResult = await getFamilyMembers(seniorData.linkedFamily);
          if (familyResult.success) {
            setFamilyMembers(familyResult.familyMembers);
          } else {
            setFamilyMembers([]);
          }
        } else {
          setFamilyMembers([]);
        }
      } else {
        setFamilyMembers([]);
      }
    } catch (_error) {
      setFamilyMembers([]);
    } finally {
      setLoadingFamily(false);
    }
  };

  const closeFamilyModal = () => {
    setFamilyModalVisible(false);
    setSelectedAlertForFamily(null);
    setFamilyMembers([]);
  };

  const openResolveModal = (alert) => {
    setAlertToResolve(alert);
    setResolveNote('');
    setResolveModalVisible(true);
  };

  const closeResolveModal = () => {
    setResolveModalVisible(false);
    setAlertToResolve(null);
    setResolveNote('');
  };

  const handleResolve = async () => {
    if (!alertToResolve) return;

    try {
      const result = await resolveAlert(alertToResolve.id, user.uid, resolveNote.trim() || null);
      if (result.success) {
        closeResolveModal();
        Alert.alert('Success', 'Alert resolved successfully');
      } else {
        Alert.alert(translations.error, result.error || 'Failed to resolve alert');
      }
    } catch (_error) {
      Alert.alert(translations.error, 'Failed to resolve alert');
    }
  };

  const handleAlertClick = (seniorId) => {
    router.push(`/caremanager/seniordetails/${seniorId}`);
  };

  const formatAlertTime = (timestamp) => {
    if (!timestamp) return translations.unknown || 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatAlertDate = (timestamp) => {
    if (!timestamp) return translations.unknown || 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return translations.today || 'Today';
    if (date.toDateString() === yesterday.toDateString()) return translations.yesterday || 'Yesterday';
    return date.toLocaleDateString();
  };

  const filteredAlerts = alerts.filter(alert => {
    // Only show active alerts on main page
    if (alert.status !== 'active') {
      return false;
    }
    // Filter by senior name
    if (selectedSeniorFilter !== 'all' && alert.seniorName !== selectedSeniorFilter) {
      return false;
    }
    return true;
  });

  // Get unique senior names for filter
  const uniqueSeniorNames = ['all', ...new Set(alerts.map(a => a.seniorName).filter(Boolean))];
  const selectedSeniorDisplayName = selectedSeniorFilter === 'all' ? 'All Seniors' : selectedSeniorFilter;

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 300;
    
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isNearBottom && !isLoadingMore && displayCount < filteredAlerts.length) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prevCount => prevCount + 5);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  // Apply pagination
  const displayedAlerts = filteredAlerts.slice(0, displayCount);

  const groupedAlerts = displayedAlerts.reduce((groups, alert) => {
    const date = formatAlertDate(alert.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(alert);
    return groups;
  }, {});

  // Sort groups: Today first, then Yesterday, then Earlier
  const sortedDates = Object.keys(groupedAlerts).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return 0;
  });

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Please log in to view alerts</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background.lighter }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.light} />

      {/* Header */}
      <View style={{ backgroundColor: colors.background.light }}>
        <View className="px-4 py-3 flex-row justify-between items-center gap-3">
          <View className="flex-1">
            <CloverCareNavbar 
              showLogo={true}
              logoSize={36}
              backgroundColor="transparent"
              appName="Clover Care"
              rightAction={{
                icon: 'history',
                onPress: () => setHistoryVisible(true)
              }}
            />
          </View>
        </View>
      </View>

      <View className="px-6 py-4" style={{ backgroundColor: colors.background.lighter }}>
        {/* Title */}
        <Text className="text-2xl font-bold mb-4" style={{ color: colors.text.dark }}>{translations.emergencyAlerts}</Text>

        {/* Senior Name Filter - Custom Dropdown */}
        <View className="mb-3" style={{ position: 'relative', zIndex: 100, overflow: 'visible' }}>
          <TouchableOpacity
            onPress={() => setSeniorMenuVisible(!seniorMenuVisible)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.background.light,
              borderWidth: 1,
              borderColor: colors.border.light,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 20,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10
              }}>
                <MaterialIcons name="person" size={18} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text.dark, fontWeight: '600', fontSize: 15 }}>
                {selectedSeniorDisplayName}
              </Text>
            </View>
            <MaterialIcons name="expand-more" size={22} color={colors.text.muted} />
          </TouchableOpacity>

          {/* Dropdown Menu */}
          {seniorMenuVisible && (
            <View style={{
              marginTop: 8,
              backgroundColor: colors.background.light,
              borderWidth: 1,
              borderColor: colors.border.light,
              borderRadius: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
              position: 'absolute',
              top: 60,
              left: 0,
              right: 0,
              zIndex: 1000,
              maxHeight: 250
            }}>
              {/* All Seniors Option */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedSeniorFilter('all');
                  setSeniorMenuVisible(false);
                }}
                style={{
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: selectedSeniorFilter === 'all' ? colors.primary + '15' : 'transparent'
                }}
              >
                <MaterialIcons name="group" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.text.dark, fontWeight: selectedSeniorFilter === 'all' ? '600' : '500', fontSize: 15 }}>
                  All Seniors
                </Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: colors.border.light }} />

              {/* Individual Seniors */}
              {uniqueSeniorNames.filter(name => name !== 'all').map((name) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => {
                    setSelectedSeniorFilter(name);
                    setSeniorMenuVisible(false);
                  }}
                  style={{
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selectedSeniorFilter === name ? colors.primary + '15' : 'transparent'
                  }}
                >
                  <MaterialIcons name="person" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.text.dark, fontWeight: selectedSeniorFilter === name ? '600' : '500', fontSize: 15 }}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6" 
        style={{ backgroundColor: colors.background.lighter }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {/* Overlay to close dropdown when tapping elsewhere */}
        {seniorMenuVisible && (
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
            onPress={() => setSeniorMenuVisible(false)}
            activeOpacity={0}
          />
        )}
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3" style={{ color: colors.text.muted }}>{translations.loadingAlerts || 'Loading alerts...'}</Text>
          </View>
        ) : filteredAlerts.length === 0 ? (
          // Empty State
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.status.success + '20' }}>
              <MaterialIcons name="check-circle" size={48} color={colors.status.success} />
            </View>
            <Text className="text-xl font-bold mb-2" style={{ color: colors.text.dark }}>
              {translations.noAlerts}
            </Text>
            <Text className="text-sm text-center px-8" style={{ color: colors.text.secondary }}>
              {translations.noAlertsDesc}
            </Text>
          </View>
        ) : (
          // Grouped Alerts
          sortedDates.map((date) => (
            <View key={date} className="mb-4">
              {/* Date Header */}
              <Text className="text-sm font-bold mb-3" style={{ color: colors.text.muted }}>{date}</Text>

              {/* Alerts for this date */}
              {groupedAlerts[date].map((alert) => {
                const isResolved = alert.status === 'resolved';
                const alertMessage = alert.type === 'panic_button' ? translations.emergencyButtonPressed : translations.morningCheckInMissed;
                const alertTypeLabel = alert.type === 'panic_button' ? (translations.panicAlert || 'PANIC ALERT') : (translations.missedCheckInAlert || 'Missed Check-In');

                return (
                  <Card
                    key={alert.id}
                    style={{
                      backgroundColor: isResolved ? colors.background.lighter : colors.background.light,
                      opacity: isResolved ? 0.7 : 1,
                      marginBottom: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      elevation: 2,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                    }}
                  >
                    <TouchableOpacity onPress={() => handleAlertClick(alert.seniorId)} activeOpacity={0.7}>
                      <Card.Content style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                        <View className="flex-row items-start">
                          {/* Avatar */}
                          <Avatar.Text
                            size={48}
                            label={(alert.seniorName || 'Senior').split(' ').map(n => n[0]).join('')}
                            style={{ backgroundColor: colors.primary }}
                            color={colors.text.light}
                          />

                          {/* Content */}
                          <View className="flex-1 ml-3">
                            <View className="flex-row items-center justify-between mb-1">
                              <Text variant="titleMedium" style={{ fontWeight: '700', flex: 1, color: colors.text.dark, fontSize: 16 }}>
                                {alert.seniorName || 'Senior'}
                              </Text>
                              <Text variant="bodySmall" style={{ color: colors.text.muted, fontSize: 12, marginLeft: 8 }}>
                                {formatAlertTime(alert.createdAt)}
                              </Text>
                            </View>

                            {/* Alert Type Badge */}
                            {alert.type === 'panic_button' && (
                              <Chip
                                mode="flat"
                                style={{ backgroundColor: '#fee2e2', alignSelf: 'flex-start', marginTop: 6, height: 24 }}
                                textStyle={{ color: '#991b1b', fontSize: 10, fontWeight: '700', lineHeight: 14 }}
                              >
                              {alertTypeLabel.toUpperCase()}
                              </Chip>
                            )}

                            {/* Message */}
                            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                              {alertMessage}
                            </Text>
                          </View>
                        </View>
                      </Card.Content>

                      {/* Action Buttons - Only for Active Alerts */}
                      {!isResolved && (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, flexDirection: 'row', gap: 8 }}>
                          <Button
                            mode="contained"
                            onPress={() => handleCall(alert.seniorPhone, alert.seniorName)}
                            buttonColor={colors.primary + '20'}
                            textColor={colors.primary}
                            icon="phone"
                            style={{ flex: 1, borderRadius: 8 }}
                            contentStyle={{ height: 40 }}
                            labelStyle={{ fontSize: 12, fontWeight: '700' }}
                            disabled={!alert.seniorPhone || alert.seniorPhone === 'No phone' || alert.seniorPhone === '-'}
                          >
                            {translations.call}
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => handleCallFamily(alert)}
                            buttonColor={colors.secondary + '20'}
                            textColor={colors.secondary}
                            icon={() => <MaterialIcons name="people" size={18} color={colors.secondary} />}
                            style={{ flex: 1, borderRadius: 8 }}
                            contentStyle={{ height: 40 }}
                            labelStyle={{ fontSize: 12, fontWeight: '700' }}
                          >
                            Family
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => openResolveModal(alert)}
                            buttonColor={colors.status.success}
                            textColor={colors.text.light}
                            icon="check"
                            style={{ flex: 1, borderRadius: 8 }}
                            contentStyle={{ height: 40 }}
                            labelStyle={{ fontSize: 12, fontWeight: '700' }}
                          >
                            {translations.resolve}
                          </Button>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Card>
                );
              })}
            </View>
          ))
        )}

        {/* Loading More Indicator */}
        {isLoadingMore && (
          <View className="items-center py-4">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-2" style={{ color: colors.text.muted }}>{translations.loadingMoreAlerts || 'Loading more alerts...'}</Text>
          </View>
        )}

        <View className="h-32" />
      </ScrollView>

      {/* Family Members Modal */}
      <Modal
        visible={familyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFamilyModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="rounded-3xl w-full" style={{ backgroundColor: colors.background.light, maxWidth: 500, maxHeight: '80%', elevation: 8 }}>
            <View className="p-6 pb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-2xl font-bold" style={{ color: colors.text.dark }}>{translations.callFamily || 'Call Family'}</Text>
                <TouchableOpacity 
                  onPress={closeFamilyModal}
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.background.lighter }}
                >
                  <MaterialIcons name="close" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {selectedAlertForFamily && (
                <Text className="text-sm" style={{ color: colors.text.secondary }}>
                  For {selectedAlertForFamily.seniorName}
                </Text>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border.light }} />

            <ScrollView className="max-h-96">
              {loadingFamily ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="mt-3" style={{ color: colors.text.muted }}>{translations.loadingFamilyMembers || 'Loading family members...'}</Text>
                </View>
              ) : familyMembers.length === 0 ? (
                <View className="items-center py-8">
                  <MaterialIcons name="family-restroom" size={48} color={colors.text.muted} />
                  <Text className="mt-3" style={{ color: colors.text.muted }}>{translations.noFamilyMembersLinked || 'No family members linked'}</Text>
                </View>
              ) : (
                <View className="p-6">
                  {familyMembers.map((member, index) => (
                    <View key={member.userId}>
                      <TouchableOpacity
                        onPress={() => {
                          closeFamilyModal();
                          handleCall(member.phone, member.name);
                        }}
                        className="flex-row items-center py-3"
                        activeOpacity={0.7}
                      >
                        <Avatar.Text
                          size={52}
                          label={member.name?.substring(0, 2).toUpperCase() || 'FM'}
                          style={{ backgroundColor: colors.primary }}
                          color={colors.text.light}
                        />
                        <View className="flex-1 ml-3">
                          <Text className="text-base font-bold" style={{ color: colors.text.dark }}>{member.name}</Text>
                          <Text className="text-sm" style={{ color: colors.text.secondary }}>{member.phone}</Text>
                        </View>
                        <MaterialIcons name="phone" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      {index < familyMembers.length - 1 && (
                        <View style={{ height: 1, backgroundColor: colors.border.light, marginVertical: 4 }} />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Resolve Alert Modal */}
      <Modal
        visible={resolveModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeResolveModal}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="rounded-t-3xl" style={{ backgroundColor: colors.background.light }}>
            <View className="p-6 pb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-2xl font-bold" style={{ color: colors.text.dark }}>{translations.resolveAlert || 'Resolve Alert'}</Text>
                <TouchableOpacity 
                  onPress={closeResolveModal}
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.background.lighter }}
                >
                  <MaterialIcons name="close" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {alertToResolve && (
                <Text className="text-sm" style={{ color: colors.text.secondary }}>
                  For {alertToResolve.seniorName}
                </Text>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border.light }} />

            <ScrollView className="max-h-96">
              <View className="p-6">
                <View className="mb-4">
                  <Text className="text-base font-bold mb-2" style={{ color: colors.text.dark }}>
                    {translations.addANoteOptional || 'Add a note (Optional)'}
                  </Text>
                  <Text className="text-sm mb-3" style={{ color: colors.text.secondary }}>
                    {translations.documentActionsTaken || 'Document any actions taken or observations about this alert'}
                  </Text>
                  
                  <View className="rounded-xl" style={{ minHeight: 120, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.background.lighter }}>
                    <TextInput
                      value={resolveNote}
                      onChangeText={setResolveNote}
                      placeholder={translations.exampleNote || "E.g., Called senior, confirmed they are safe. False alarm."}
                      placeholderTextColor={colors.text.muted}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      className="p-4 text-base"
                      style={{ color: colors.text.dark }}
                      maxLength={500}
                    />
                  </View>
                  <Text className="text-xs mt-2" style={{ color: colors.text.muted }}>
                    {resolveNote.length}/500 characters
                  </Text>
                </View>

                <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: colors.primary + '10' }}>
                  <View className="flex-row items-start">
                    <MaterialIcons name="info" size={20} color={colors.primary} />
                    <Text className="flex-1 ml-2 text-sm leading-5" style={{ color: colors.text.dark }}>
                      {translations.noteWillBeSaved || 'This note will be saved with the alert resolution and visible to family members.'}
                    </Text>
                  </View>
                </View>

                <View className="flex-col gap-3">
                  <Button
                    mode="contained"
                    onPress={handleResolve}
                    buttonColor={colors.status.success}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 16, fontWeight: '700' }}
                    icon={() => <MaterialIcons name="check-circle" size={22} color={colors.text.light} />}
                  >
                    {translations.resolveAlert || 'Resolve Alert'}
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={closeResolveModal}
                    textColor={colors.text.muted}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 16, fontWeight: '600' }}
                    style={{ borderWidth: 1.5, borderColor: colors.border.light }}
                  >
                    {translations.cancel || 'Cancel'}
                  </Button>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <CareManagerBottomNav />

      {/* Alert History Modal */}
      <AlertHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        seniors={assignedSeniors}
        translations={translations}
      />
    </SafeAreaView>
  );
}