import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, ScrollView, StatusBar, TouchableOpacity, View, RefreshControl, Modal, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Text, ActivityIndicator, Divider } from 'react-native-paper';
import FamilyBottomNav from '../../components/FamilyBottomNav';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import AlertHistoryModal from '../../components/AlertHistoryModal';
import { colors } from '../../theme/colors';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { getLinkedSeniorsWithDetails } from '../../firestore/familyFirestore';
import { getAlertsForSenior, updateAlertStatus } from '../../firestore/seniorFirestore';
import { getUserName } from '../../firestore/sharedFirestore';
import { listenToAlertsForAssignedSeniors as listenToAlerts } from '../../firestore/caremanagerFirestore';

export default function AlertsScreen() {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [selectedSenior, setSelectedSenior] = useState('all');
  const [showSeniorSelector, setShowSeniorSelector] = useState(false);
  const [seniors, setSeniors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [alertToResolve, setAlertToResolve] = useState(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const translations = translationData[currentLanguage];

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Close dropdown when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowSeniorSelector(false);
      };
    }, [])
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const seniorsResult = await getLinkedSeniorsWithDetails(user.uid);
      if (seniorsResult.success) {
        setSeniors(seniorsResult.data);
      }
    } catch (_error) {
      // Handle error silently
      Alert.alert(translations.error, 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [user, translations]);

  useEffect(() => {
    if (user?.uid) {
      loadData();
    }
  }, [user, loadData]);

  const loadAlerts = useCallback(async () => {
    try {
      if (!seniors || seniors.length === 0) {
        setAlerts([]);
        return;
      }

      let allAlerts = [];

      if (selectedSenior === 'all') {
        // Get alerts for all linked seniors
        const alertPromises = seniors.map(senior => getAlertsForSenior(senior.userId));
        const alertResults = await Promise.all(alertPromises);
        allAlerts = alertResults.flat().filter(Boolean);
      } else {
        // Get alerts for specific senior
        const result = await getAlertsForSenior(selectedSenior);
        allAlerts = Array.isArray(result) ? result : [];
      }

      // Sort alerts by createdAt (newest first)
      allAlerts.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return timeB - timeA;
      });

      setAlerts(allAlerts);
    } catch (_error) {
      // Handle error silently
      setAlerts([]);
    }
  }, [selectedSenior, seniors]);

  useEffect(() => {
    if (seniors && seniors.length > 0) {
      loadAlerts();
      setDisplayCount(10);
    }
  }, [loadAlerts, seniors]);

  // Set up real-time listener for alerts
  useEffect(() => {
    if (!seniors || seniors.length === 0) return;

    const seniorIds = seniors.map(senior => senior.userId);
    const unsubscribe = listenToAlerts(seniorIds, (updatedAlerts) => {
      if (Array.isArray(updatedAlerts)) {
        setAlerts(updatedAlerts);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [seniors]);

  const handleCall = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber === 'No phone' || phoneNumber === '-') {
      Alert.alert(
        translations.error || 'Error',
        'No phone number available'
      );
      return;
    }

    try {
      const cleanedPhone = String(phoneNumber).replace(/[\s\-()]/g, '');
      await Linking.openURL(`tel:${cleanedPhone}`);
    } catch (_error) {
      // Handle error silently
      Alert.alert(translations.error || 'Error', translations.failedToInitiateCall || 'Failed to initiate call');
    }
  };

  const handleAlertClick = (alert, senior) => {
    setSelectedAlert({ ...alert, seniorInfo: senior });
    setModalVisible(true);
  };

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedAlert(null);
  }, []);

  const openResolveModal = (alertId, seniorName) => {
    setAlertToResolve({ alertId, seniorName });
    setResolveNote('');
    setResolveModalVisible(true);
  };

  const closeResolveModal = useCallback(() => {
    setResolveModalVisible(false);
    setAlertToResolve(null);
    setResolveNote('');
  }, []);

  const handleResolveAlert = async () => {
    if (!alertToResolve?.alertId) return;

    try {
      // Fetch the current user's name from Firestore
      const resolverName = await getUserName(user.uid);
      const result = await updateAlertStatus(
        alertToResolve.alertId, 
        'resolved', 
        user.uid,
        resolveNote.trim() || null,
        resolverName
      );
      
      if (result?.success) {
        // Update local state
        setAlerts(prevAlerts => {
          if (!Array.isArray(prevAlerts)) return prevAlerts;
          return prevAlerts.map(alert =>
            alert.alertId === alertToResolve.alertId 
              ? { ...alert, status: 'resolved', resolutionNote: resolveNote.trim() || null, resolvedBy: user.uid, resolverName: resolverName, resolvedAt: new Date() } 
              : alert
          );
        });
        closeResolveModal();
        closeModal();
        Alert.alert('Success', 'Alert has been resolved successfully');
      } else {
        Alert.alert(translations.error, result?.message || 'Failed to resolve alert');
      }
    } catch (_error) {
      // Handle error silently
      Alert.alert(translations.error, 'Failed to resolve alert. Please try again.');
    }
  };

  const getAlertTitle = (type) => {
    return type === 'panic_button' ? translations.panicButton : translations.missedCheckIn;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    }
  };

  const filteredAlerts = alerts && alerts.length > 0
    ? alerts.filter(alert => alert.status === 'active')
    : [];

  const seniorOptions = [
    { id: 'all', name: translations.allSeniors },
    ...seniors.map(senior => ({ id: senior.userId, name: senior.name || senior.fullName || 'Unknown Senior' }))
  ];

  const selectedSeniorName = seniorOptions.find(s => s.id === selectedSenior)?.name || translations.allSeniors;

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 300;
    
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isNearBottom) {
      if (!isLoadingMore && displayCount < filteredAlerts.length) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayCount(prevCount => prevCount + 5);
          setIsLoadingMore(false);
        }, 300);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-gray-600">{translations.loading}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      {/* Header with Navbar */}
      <View className="bg-white">
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

      {/* Content Section */}
      <View className="bg-white px-4 pt-5 pb-5">
        {/* Alerts Heading - Compact */}
        <View className="mb-5">
          <Text className="text-2xl font-bold text-slate-900">{translations.emergencyAlerts}</Text>
        </View>

        {/* Controls Section */}
        <View className="gap-3">
          {/* Senior Selector Dropdown */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{translations.selectSenior || 'Select Senior'}</Text>
            <TouchableOpacity 
              onPress={() => seniors.length > 1 && setShowSeniorSelector(!showSeniorSelector)}
              className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
              activeOpacity={seniors.length > 1 ? 0.7 : 1}
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                    {(selectedSeniorName || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-0.5">{translations.viewing || 'Viewing'}</Text>
                  <Text className="text-sm font-bold text-gray-900">
                    {selectedSeniorName}
                  </Text>
                </View>
              </View>
              {seniors.length > 1 && (
                <MaterialIcons 
                  name={showSeniorSelector ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color={colors.text.primary} 
                />
              )}
            </TouchableOpacity>

            {/* Dropdown List */}
            {showSeniorSelector && seniors.length > 1 && (
              <View className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {seniorOptions.map((senior, index) => (
                  <TouchableOpacity
                    key={senior.id}
                    onPress={() => {
                      setSelectedSenior(senior.id);
                      setShowSeniorSelector(false);
                    }}
                    className={`flex-row items-center px-4 py-3 ${
                      index !== seniorOptions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                    style={senior.id === selectedSenior ? { backgroundColor: colors.background.lighter } : {}}
                    activeOpacity={0.7}
                  >
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{
                      backgroundColor: senior.id === selectedSenior ? colors.primary : colors.text.muted
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                        {(senior.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold" style={{
                        color: senior.id === selectedSenior ? colors.primary : '#111827'
                      }}>
                        {senior.name}
                      </Text>
                    </View>
                    {senior.id === selectedSenior && (
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredAlerts.length === 0 ? (
          <Card className="bg-white">
            <Card.Content className="items-center justify-center py-12">
              <MaterialIcons name="check-circle" size={64} color={colors.status.success} />
              <Text className="text-xl font-bold text-gray-900 mt-4">
                {translations.noAlerts}
              </Text>
              <Text className="text-sm text-slate-600 mt-2 text-center">
                {translations.noAlertsDesc}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <View className="mb-32">
            {filteredAlerts.slice(0, displayCount).map((alert, index) => {
              const senior = seniors.find(s => s.userId === alert.userId);
              const seniorName = senior?.name || senior?.fullName || 'Unknown Senior';
              const isResolved = alert.status === 'resolved';
              // Use alertId if available, otherwise use alert.id, or fallback to unique combination
              const alertKey = alert.alertId || alert.id || `${alert.userId}-${alert.createdAt}-${index}`;

              return (
                <TouchableOpacity
                  key={alertKey}
                  onPress={() => handleAlertClick(alert, senior)}
                  activeOpacity={0.7}
                >
                  <Card style={{ marginBottom: 16, backgroundColor: colors.background.light }}>
                    <Card.Content>
                      {/* Alert Header */}
                      <View className="flex-row items-start mb-3">
                        <Avatar.Text
                          size={48}
                          label={seniorName.split(' ').map(n => n[0]).join('')}
                          style={{ backgroundColor: colors.primary }}
                        />
                        <View className="flex-1 ml-3">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-bold text-gray-900">
                              {getAlertTitle(alert.type)}
                            </Text>
                            {isResolved && (
                              <Chip
                                mode="flat"
                                style={{ backgroundColor: '#dcfce7' }}
                                textStyle={{ color: colors.status.success, fontSize: 12, fontWeight: '600' }}
                              >
                                {translations.resolved}
                              </Chip>
                            )}
                          </View>
                          <Text className="text-sm text-gray-900 font-semibold">
                            {seniorName}
                          </Text>
                          <Text className="text-xs text-slate-600 mt-1">
                            {formatTimestamp(alert.createdAt)}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                      </View>

                      {/* Quick Action Buttons */}
                      {!isResolved && (
                        <View className="flex-row gap-2 mt-3">
                          <Button
                            mode="contained"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCall(senior?.phone);
                            }}
                            className="flex-1"
                            buttonColor={colors.primary}
                            icon={() => <MaterialIcons name="phone" size={18} color="#fff" />}
                          >
                            {translations.callSenior}
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={(e) => {
                              e.stopPropagation();
                              openResolveModal(alert.alertId, seniorName);
                            }}
                            className="flex-1"
                            icon={() => <MaterialIcons name="check" size={18} color={colors.primary} />}
                          >
                            {translations.resolve}
                          </Button>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            })}

            {/* Loading Indicator - Shows only when auto-loading more items */}
            {isLoadingMore && (
              <View className="items-center py-4">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, color: colors.text.muted }}>
                  Loading more alerts...
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Alert Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-md" style={{ elevation: 10 }}>
            {selectedAlert && (() => {
              const seniorName = selectedAlert.seniorInfo?.name || selectedAlert.seniorInfo?.fullName || 'Unknown Senior';
              const isResolved = selectedAlert.status === 'resolved';
              const alertDate = selectedAlert.createdAt?.toDate?.() || new Date(selectedAlert.createdAt);

              return (
                <>
                  {/* Modal Header */}
                  <View className="p-6 pb-4 flex-row items-center justify-between">
                    <View className="flex-1"></View>
                    <TouchableOpacity 
                      onPress={closeModal}
                      className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                    >
                      <MaterialIcons name="close" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                    <Text className="text-2xl font-bold text-gray-900 mb-1">
                      {getAlertTitle(selectedAlert.type)}
                    </Text>
                    
                    {isResolved && (
                      <Chip
                        mode="flat"
                        style={{ backgroundColor: '#dcfce7', alignSelf: 'flex-start' }}
                        textStyle={{ color: colors.status.success, fontSize: 12, fontWeight: '600' }}
                        icon={() => <MaterialIcons name="check-circle" size={16} color={colors.status.success} />}
                      >
                        {translations.resolved}
                      </Chip>
                    )}
                  <Divider />

                  {/* Modal Content */}
                  <View className="p-6">
                    {/* Senior Info */}
                    <View className="flex-row items-center mb-5">
                      <Avatar.Text
                        size={56}
                        label={seniorName.split(' ').map(n => n[0]).join('')}
                        style={{ backgroundColor: colors.primary }}
                      />
                      <View className="flex-1 ml-4">
                        <Text className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                          Senior
                        </Text>
                        <Text className="text-lg font-bold text-gray-900">
                          {seniorName}
                        </Text>
                        {selectedAlert.seniorInfo?.phone && (
                          <Text className="text-sm text-slate-600 mt-0.5">
                            {selectedAlert.seniorInfo.phone}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Alert Details */}
                    <View className="bg-gray-50 rounded-2xl p-4 mb-5">
                      <View className="flex-row items-start mb-3">
                        <MaterialIcons name="access-time" size={20} color={colors.primary} />
                        <View className="flex-1 ml-3">
                          <Text className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Alert Time
                          </Text>
                          <Text className="text-base font-semibold text-gray-900 mt-1">
                            {alertDate.toLocaleString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </Text>
                          <Text className="text-sm text-slate-600 mt-0.5">
                            {formatTimestamp(selectedAlert.createdAt)}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-start">
                        <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                        <View className="flex-1 ml-3">
                          <Text className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Alert Type
                          </Text>
                          <Text className="text-base font-semibold text-gray-900 mt-1">
                            {getAlertTitle(selectedAlert.type)}
                          </Text>
                          {selectedAlert.type === 'panic_button' ? (
                            <Text style={{ fontSize: 14, color: colors.status.error, marginTop: 4 }}>
                              🚨 Requires immediate attention
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 14, color: colors.status.warning, marginTop: 4 }}>
                              ⚠️ Senior has not checked in today
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    {!isResolved && (
                      <View className="flex-col gap-3">
                        <Button
                          mode="contained"
                          onPress={() => {
                            closeModal();
                            handleCall(selectedAlert.seniorInfo?.phone);
                          }}
                          buttonColor={colors.primary}
                          contentStyle={{ paddingVertical: 12 }}
                          labelStyle={{ fontSize: 16, fontWeight: '600' }}
                          icon={() => <MaterialIcons name="phone" size={22} color={colors.white} />}
                        >
                          Call {seniorName.split(' ')[0]}
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => openResolveModal(selectedAlert.alertId, seniorName)}
                          textColor={colors.primary}
                          contentStyle={{ paddingVertical: 12 }}
                          labelStyle={{ fontSize: 16, fontWeight: '600' }}
                          icon={() => <MaterialIcons name="check-circle" size={22} color={colors.primary} />}
                          style={{ borderWidth: 2, borderColor: colors.primary }}
                        >
                          Mark as Resolved
                        </Button>
                      </View>
                    )}

                    {isResolved && (
                      <View className="bg-green-50 rounded-2xl p-4">
                        <View className="items-center mb-3">
                          <MaterialIcons name="check-circle" size={48} color={colors.primary} />
                          <Text className="text-lg font-bold text-green-900 mt-3">
                            Alert Resolved
                          </Text>
                          <Text className="text-sm text-green-700 mt-1 text-center">
                            This alert has been marked as resolved
                          </Text>
                        </View>
                        {selectedAlert.resolutionNote && (
                          <View className="mt-3 pt-3 border-t border-green-200">
                            <View className="flex-row items-start">
                              <MaterialIcons name="note" size={20} color={colors.primary} />
                              <View className="flex-1 ml-2">
                                <Text className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-1">
                                  Resolution Note
                                </Text>
                                <Text className="text-sm text-green-900 leading-5">
                                  {selectedAlert.resolutionNote}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Resolve Alert Modal with Note */}
      <Modal
        visible={resolveModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeResolveModal}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl" style={{ elevation: 10 }}>
            {/* Modal Header */}
            <View className="p-6 pb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-2xl font-bold text-gray-900">
                  Resolve Alert
                </Text>
                <TouchableOpacity 
                  onPress={closeResolveModal}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                >
                  <MaterialIcons name="close" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {alertToResolve && (
                <Text className="text-sm text-slate-600">
                  For {alertToResolve.seniorName}
                </Text>
              )}
            </View>

            <Divider />

            {/* Modal Content */}
            <ScrollView className="max-h-96">
              <View className="p-6">
                <View className="mb-4">
                  <Text className="text-base font-semibold text-gray-900 mb-2">
                    Add a note (Optional)
                  </Text>
                  <Text className="text-sm text-slate-600 mb-3">
                    Document any actions taken or observations about this alert
                  </Text>
                  
                  <View className="border border-gray-300 rounded-xl bg-gray-50" style={{ minHeight: 120 }}>
                    <TextInput
                      value={resolveNote}
                      onChangeText={setResolveNote}
                      placeholder="E.g., Called senior, confirmed they are safe. False alarm."
                      placeholderTextColor={colors.text.muted}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      className="p-4 text-base text-gray-900"
                    />
                  </View>
                  <Text className="text-xs text-slate-500 mt-2">
                    {resolveNote.length}/500 characters
                  </Text>
                </View>

                <View className="bg-blue-50 rounded-xl p-4 mb-6">
                  <View className="flex-row items-start">
                    <MaterialIcons name="info" size={20} color={colors.primary} />
                    <Text className="flex-1 ml-2 text-sm text-blue-900 leading-5">
                      This note will be saved with the alert resolution and visible to all family members and care managers.
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-col gap-3">
                  <Button
                    mode="contained"
                    onPress={handleResolveAlert}
                    buttonColor={colors.status.success}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 16, fontWeight: '600' }}
                    icon={() => <MaterialIcons name="check-circle" size={22} color={colors.white} />}
                  >
                    Resolve Alert
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={closeResolveModal}
                    textColor={colors.text.secondary}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 16, fontWeight: '600' }}
                    style={{ borderWidth: 1.5, borderColor: colors.border.light }}
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AlertHistoryModal 
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        seniors={seniors}
        translations={translations}
      />

      <FamilyBottomNav />
    </SafeAreaView>
  );
}
