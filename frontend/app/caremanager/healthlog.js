import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FAB, TextInput as PaperInput } from 'react-native-paper';
import CareManagerBottomNav from '../../components/CareManagerBottomNav';
import '../../global.css';
import { translations as translationData, loadLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addHealthLog, 
  updateHealthLog,
  getHealthLogsPaginated,
  getHealthLogsForSenior,
  listenToAssignedSeniorIds
} from '../../firestore/caremanagerFirestore';
import { getUserProfile } from '../../firestore/sharedFirestore';
import CloverCareNavbar from '../../components/CloverCareNavbar';
import { colors } from '../../theme/colors';

export default function CareManagerHealthLog() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];
  const [loading, setLoading] = useState(false);
  const [healthLogs, setHealthLogs] = useState([]);
  const [assignedSeniors, setAssignedSeniors] = useState([]);
  
  // Pagination state
  const [lastDocument, setLastDocument] = useState(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [selectedSeniorId, setSelectedSeniorId] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  
  // Edit state
  const [editingLogId, setEditingLogId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Menu state for dropdowns
  const [seniorMenuVisible, setSeniorMenuVisible] = useState(false);
  const [modalSeniorMenuVisible, setModalSeniorMenuVisible] = useState(false);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  // Auto-set senior ID if passed from senior detail page
  useEffect(() => {
    if (params?.seniorId) {
      setSelectedSeniorId(params.seniorId);
    }
  }, [params?.seniorId]);

  // Fetch assigned seniors with names - with real-time listener
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToAssignedSeniorIds(user.uid, async (seniorIds) => {
      try {
        if (seniorIds.length === 0) {
          setAssignedSeniors([]);
          return;
        }

        // Fetch senior profiles to get names
        const seniorsWithNames = await Promise.all(
          seniorIds.map(async (seniorId) => {
            const profile = await getUserProfile(seniorId);
            return {
              key: seniorId,
              label: profile?.name || profile?.fullName || `Senior ${seniorId.slice(0, 8)}...`,
              value: seniorId
            };
          })
        );
        
        setAssignedSeniors(seniorsWithNames);
        
        // Auto-select first senior if none selected and no param
        if (!params.seniorId && seniorsWithNames.length > 0) {
          setSelectedSeniorId(prev => prev || seniorsWithNames[0].value);
        }
      } catch (_error) {
        // Silent fail
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, params?.seniorId]);

  // Fetch health logs when senior is selected
  useEffect(() => {
    if (!selectedSeniorId) {
      setHealthLogs([]);
      return;
    }

    const fetchHealthLogs = async () => {
      const result = await getHealthLogsPaginated(selectedSeniorId, 10, null);
      
      if (result.success) {
        setHealthLogs(result.logs);
        setHasMoreLogs(result.hasMore);
        setLastDocument(result.lastDocument);
      } else if (result.error && result.error.includes('index')) {
        const fallbackResult = await getHealthLogsForSenior(selectedSeniorId, 30);
        if (fallbackResult.success) {
          setHealthLogs(fallbackResult.logs.slice(0, 10));
          setHasMoreLogs(fallbackResult.logs.length > 10);
        }
      }
    };

    fetchHealthLogs();
  }, [selectedSeniorId]);

  const loadMoreLogs = async () => {
    if (!selectedSeniorId || !hasMoreLogs || loadingMore) return;
    
    setLoadingMore(true);
    const result = await getHealthLogsPaginated(selectedSeniorId, 10, lastDocument);
    
    if (result.success) {
      setHealthLogs(prev => [...prev, ...result.logs]);
      setHasMoreLogs(result.hasMore);
      setLastDocument(result.lastDocument);
    }
    
    setLoadingMore(false);
  };

  const handleOpenModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!selectedSeniorId) {
      Alert.alert('Error', 'Please select a senior first');
      return;
    }

    if (!bloodPressure || !bloodSugar || !temperature) {
      Alert.alert('Error', 'Please fill all vital signs');
      return;
    }

    const sugarVal = parseFloat(bloodSugar);
    const tempVal = parseFloat(temperature);

    if (isNaN(sugarVal) || isNaN(tempVal)) {
      Alert.alert('Error', 'Please enter valid numbers for Blood Sugar and Temperature');
      return;
    }

    setLoading(true);
    
    const vitals = {
      bloodPressure,
      bloodSugar: sugarVal,
      temperature: tempVal
    };

    if (isEditing && editingLogId) {
      // Update existing log
      const result = await updateHealthLog(editingLogId, vitals, notes);
      
      if (result.success) {
        Alert.alert('Success', 'Health log updated successfully!');
        
        // Refresh logs
        const logsResult = await getHealthLogsPaginated(selectedSeniorId, 10, null);
        if (logsResult.success) {
          setHealthLogs(logsResult.logs);
          setHasMoreLogs(logsResult.hasMore);
          setLastDocument(logsResult.lastDocument);
        }
        
        handleCloseModal();
      } else {
        Alert.alert('Error', 'Failed to update health log');
      }
    } else {
      // Add new log
      const result = await addHealthLog(selectedSeniorId, user.uid, vitals, notes);
      
      if (result.success) {
        Alert.alert('Success', 'Health log added successfully!');
        
        // Refresh logs
        const logsResult = await getHealthLogsPaginated(selectedSeniorId, 10, null);
        if (logsResult.success) {
          setHealthLogs(logsResult.logs);
          setHasMoreLogs(logsResult.hasMore);
          setLastDocument(logsResult.lastDocument);
        }
        
        handleCloseModal();
      } else {
        Alert.alert('Error', result.error || 'Failed to add health log');
      }
    }
    
    setLoading(false);
  };
  
  const resetForm = () => {
    setBloodPressure('');
    setBloodSugar('');
    setTemperature('');
    setNotes('');
    setIsEditing(false);
    setEditingLogId(null);
  };
  
  const handleEdit = (log) => {
    setSelectedSeniorId(log.seniorId);
    setBloodPressure(log.vitals.bloodPressure);
    setBloodSugar(log.vitals.bloodSugar.toString());
    setTemperature(log.vitals.temperature.toString());
    setNotes(log.notes || '');
    setIsEditing(true);
    setEditingLogId(log.id);
    setModalVisible(true);
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.lighter }}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: colors.text.muted }}>Please log in to view health logs</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background.lighter }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.lighter} />

      <CloverCareNavbar 
        showBackButton={true}
        onBackPress={() => router.replace('/caremanager/dashboard')}
        appName="Health Records"
      />

      <View className="px-4 pt-4" style={{ backgroundColor: colors.background.lighter, zIndex: 100, overflow: 'visible' }}>
        <View className="mb-6 bg-white rounded-2xl p-5" style={{ 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 4 }, 
          shadowOpacity: 0.1, 
          shadowRadius: 8, 
          elevation: 5,
          zIndex: 100,
          overflow: 'visible'
        }}>
          <View className="flex-row items-center mb-3">
            <View 
              className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.background.lighter }}
            >
              <MaterialIcons name="people" size={20} color={colors.primary} />
            </View>
            <Text className="text-base font-bold" style={{ color: colors.text.dark }}>Select Patient</Text>
          </View>
          {assignedSeniors.length > 0 ? (
            <View>
              <TouchableOpacity 
                onPress={() => setSeniorMenuVisible(!seniorMenuVisible)}
                className="rounded-2xl px-4 py-4 flex-row justify-between items-center"
                style={{ 
                  backgroundColor: colors.background.lighter, 
                  borderWidth: 2, 
                  borderColor: selectedSeniorId ? colors.primary : colors.border.light
                }}
              >
                <View className="flex-row items-center">
                  <View 
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: selectedSeniorId ? colors.primary : colors.border.light }}
                  >
                    <MaterialIcons 
                      name="person" 
                      size={16} 
                      color={selectedSeniorId ? 'white' : colors.text.muted} 
                    />
                  </View>
                  <Text className="font-medium" style={{ color: selectedSeniorId ? colors.text.dark : colors.text.muted }}>
                    {assignedSeniors.find(s => s.value === selectedSeniorId)?.label || "Choose a patient"}
                  </Text>
                </View>
                <MaterialIcons name={seniorMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={colors.text.muted} />
              </TouchableOpacity>

              {seniorMenuVisible && (
                <View style={{ 
                  marginTop: 8, 
                  backgroundColor: 'white', 
                  borderWidth: 1, 
                  borderColor: '#e5e7eb', 
                  borderRadius: 12, 
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 8,
                  zIndex: 1000,
                  position: 'absolute',
                  top: 60,
                  left: 0,
                  right: 0
                }}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {assignedSeniors.map((senior) => (
                      <TouchableOpacity
                        key={senior.key}
                        onPress={() => {
                          setSelectedSeniorId(senior.value);
                          setSeniorMenuVisible(false);
                        }}
                        activeOpacity={0.6}
                        style={{ 
                          padding: 16, 
                          flexDirection: 'row', 
                          alignItems: 'center',
                          backgroundColor: selectedSeniorId === senior.value ? colors.primary + '10' : 'transparent',
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9'
                        }}
                      >
                        <View 
                          className="w-2 h-2 rounded-full mr-3"
                          style={{ backgroundColor: selectedSeniorId === senior.value ? colors.primary : 'transparent' }}
                        />
                        <Text style={{ 
                          color: selectedSeniorId === senior.value ? colors.primary : colors.text.dark,
                          fontWeight: selectedSeniorId === senior.value ? 'bold' : 'normal',
                          fontSize: 16
                        }}>
                          {senior.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <View className="rounded-2xl px-4 py-4" style={{ backgroundColor: colors.status.error + '15', borderWidth: 1, borderColor: colors.status.error + '40' }}>
              <View className="flex-row items-center">
                <MaterialIcons name="info" size={16} color={colors.status.error} />
                <Text className="ml-2" style={{ color: colors.status.error }}>No patients assigned</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-20" showsVerticalScrollIndicator={false} style={{ zIndex: 1 }}>
        {/* Health Logs List */}
        <View className="mb-32">
          <View className="flex-row items-center mb-4">
            <View className="w-1 h-6 rounded-full mr-2" style={{ backgroundColor: colors.primary }} />
            <Text className="text-lg font-bold" style={{ color: colors.text.dark }}>Recent Health Records</Text>
          </View>
          
          {!selectedSeniorId ? (
            <View className="bg-white rounded-2xl p-8 items-center" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.background.lighter }}>
                <MaterialIcons name="health-and-safety" size={40} color={colors.primary} />
              </View>
              <Text className="font-semibold text-base" style={{ color: colors.text.muted }}>Please select a senior</Text>
              <Text className="text-sm mt-1" style={{ color: colors.text.muted }}>Choose from the dropdown above</Text>
            </View>
          ) : healthLogs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center" style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.background.lighter }}>
                <MaterialIcons name="add-circle-outline" size={40} color={colors.text.muted} />
              </View>
              <Text className="font-semibold text-base" style={{ color: colors.text.muted }}>No health logs yet</Text>
              <Text className="text-sm mt-1" style={{ color: colors.text.muted }}>Tap the + button to add first record</Text>
            </View>
          ) : (
            <>
              {healthLogs.map((log) => (
                <View 
                  key={log.id} 
                  className="bg-white rounded-2xl p-4 mb-3" 
                  style={{ 
                    elevation: 4, 
                    shadowColor: '#8DAAA5', 
                    shadowOffset: { width: 0, height: 4 }, 
                    shadowOpacity: 0.12, 
                    shadowRadius: 8
                  }}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold" style={{ color: colors.text.dark }}>
                        {log.seniorName || 'Unknown Senior'}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <MaterialIcons name="access-time" size={12} color={colors.text.muted} />
                        <Text className="text-xs ml-1" style={{ color: colors.text.muted }}>
                          {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          }) : 'Just now'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleEdit(log)}
                      className="rounded-xl px-3 py-2"
                      style={{ backgroundColor: colors.background.lighter }}
                    >
                      <MaterialIcons name="edit" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View className="flex-row gap-2 mb-2">
                    <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: colors.status.warning + '15' }}>
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="favorite" size={14} color={colors.status.warning} />
                        <Text className="text-xs font-semibold ml-1" style={{ color: colors.status.warning }}>BP</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: colors.text.dark }}>{log.vitals?.bloodPressure || 'N/A'}</Text>
                    </View>
                    <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: colors.status.error + '15' }}>
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="water-drop" size={14} color={colors.status.error} />
                        <Text className="text-xs font-semibold ml-1" style={{ color: colors.status.error }}>Sugar</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: colors.text.dark }}>{log.vitals?.bloodSugar || 'N/A'} mg/dL</Text>
                    </View>
                    <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: colors.secondary + '15' }}>
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="thermostat" size={14} color={colors.secondary} />
                        <Text className="text-xs font-semibold ml-1" style={{ color: colors.secondary }}>Temp</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: colors.text.dark }}>{log.vitals?.temperature || 'N/A'}°F</Text>
                    </View>
                  </View>
                  
                  {log.notes && (
                    <View className="mt-2 pt-2 rounded-lg p-2" style={{ backgroundColor: colors.background.lighter }}>
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="notes" size={12} color={colors.text.muted} />
                        <Text className="text-xs font-semibold ml-1" style={{ color: colors.text.muted }}>Notes</Text>
                      </View>
                      <Text className="text-sm" style={{ color: colors.text.dark }}>{log.notes}</Text>
                    </View>
                  )}
                </View>
              ))}
              
              {/* Load More Button */}
              {hasMoreLogs && (
                <TouchableOpacity
                  onPress={loadMoreLogs}
                  disabled={loadingMore}
                  className="rounded-2xl p-4 items-center mt-2"
                  style={{ backgroundColor: colors.background.lighter }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <MaterialIcons name="expand-more" size={22} color={colors.primary} />
                    <Text className="font-bold ml-2" style={{ color: colors.primary }}>
                      {loadingMore ? 'Loading...' : 'Load More Logs'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Health Log Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={handleCloseModal}>
        <View className="flex-1 justify-center items-center px-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <View className="bg-white rounded-3xl p-6 w-full" style={{ 
            maxWidth: 500, 
            maxHeight: '90%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10
          }}>
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <View 
                  className="w-12 h-12 rounded-2xl items-center justify-center mr-3" 
                  style={{ 
                    backgroundColor: isEditing ? colors.status.success + '15' : colors.background.lighter,
                    borderWidth: 2,
                    borderColor: isEditing ? colors.status.success : colors.primary
                  }}
                >
                  <MaterialIcons 
                    name={isEditing ? "edit" : "add"} 
                    size={24} 
                    color={isEditing ? colors.status.success : colors.primary} 
                  />
                </View>
                <View>
                  <Text className="text-xl font-bold" style={{ color: colors.text.dark }}>
                    {isEditing ? 'Edit Health Record' : 'New Health Record'}
                  </Text>
                  <Text className="text-sm" style={{ color: colors.text.muted }}>
                    {isEditing ? 'Update vital signs' : 'Record vital measurements'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleCloseModal}
                className="w-10 h-10 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.background.lighter }}
              >
                <MaterialIcons name="close" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Senior Selection */}
              <View className="mb-6" style={{ zIndex: 100, overflow: 'visible' }}>
                <Text className="text-sm font-bold mb-3" style={{ color: colors.text.dark }}>Patient Selection</Text>
                {assignedSeniors.length > 0 ? (
                  <View>
                    <TouchableOpacity 
                      onPress={() => setModalSeniorMenuVisible(!modalSeniorMenuVisible)}
                      className="rounded-2xl px-4 py-4 flex-row justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background.lighter, 
                        borderWidth: 2, 
                        borderColor: selectedSeniorId ? colors.primary : colors.border.light
                      }}
                    >
                      <View className="flex-row items-center">
                        <View 
                          className="w-8 h-8 rounded-full items-center justify-center mr-3"
                          style={{ backgroundColor: selectedSeniorId ? colors.primary : colors.border.light }}
                        >
                          <MaterialIcons 
                            name="person" 
                            size={16} 
                            color={selectedSeniorId ? 'white' : colors.text.muted} 
                          />
                        </View>
                        <Text className="font-medium" style={{ color: selectedSeniorId ? colors.text.dark : colors.text.muted }}>
                          {assignedSeniors.find(s => s.value === selectedSeniorId)?.label || "Select a patient"}
                        </Text>
                      </View>
                      <MaterialIcons name={modalSeniorMenuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={colors.text.muted} />
                    </TouchableOpacity>

                    {modalSeniorMenuVisible && (
                      <View style={{ 
                        marginTop: 8, 
                        backgroundColor: 'white', 
                        borderWidth: 1, 
                        borderColor: '#e5e7eb', 
                        borderRadius: 12, 
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 8,
                        zIndex: 1000,
                        position: 'absolute',
                        top: 60,
                        left: 0,
                        right: 0
                      }}>
                        <ScrollView style={{ maxHeight: 200 }}>
                          {assignedSeniors.map((senior) => (
                            <TouchableOpacity
                              key={senior.key}
                              onPress={() => {
                                setSelectedSeniorId(senior.value);
                                setModalSeniorMenuVisible(false);
                              }}
                              activeOpacity={0.6}
                              style={{ 
                                padding: 16, 
                                flexDirection: 'row', 
                                alignItems: 'center',
                                backgroundColor: selectedSeniorId === senior.value ? colors.primary + '10' : 'transparent',
                                borderBottomWidth: 1,
                                borderBottomColor: '#f1f5f9'
                              }}
                            >
                              <View 
                                className="w-2 h-2 rounded-full mr-3"
                                style={{ backgroundColor: selectedSeniorId === senior.value ? colors.primary : 'transparent' }}
                              />
                              <Text style={{ 
                                color: selectedSeniorId === senior.value ? colors.primary : colors.text.dark,
                                fontWeight: selectedSeniorId === senior.value ? 'bold' : 'normal',
                                fontSize: 16
                              }}>
                                {senior.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="rounded-2xl px-4 py-4" style={{ backgroundColor: colors.status.error + '15', borderWidth: 1, borderColor: colors.status.error + '40' }}>
                    <Text style={{ color: colors.status.error }}>No patients assigned</Text>
                  </View>
                )}
              </View>

              {/* Vital Signs Grid */}
              <View className="mb-6">
                <Text className="text-sm font-bold mb-3" style={{ color: colors.text.dark }}>Vital Signs</Text>
                
                {/* Blood Pressure */}
                <View className="mb-4">
                  <View className="flex-row items-center mb-2">
                    <View 
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                      style={{ backgroundColor: colors.status.warning + '15' }}
                    >
                      <MaterialIcons name="favorite" size={16} color={colors.status.warning} />
                    </View>
                    <Text className="text-sm font-semibold" style={{ color: colors.text.dark }}>Blood Pressure</Text>
                  </View>
                  <PaperInput
                    value={bloodPressure}
                    onChangeText={setBloodPressure}
                    placeholder="120/80 mmHg"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.status.error}
                    style={{ backgroundColor: 'white' }}
                    theme={{ 
                      colors: { 
                        text: colors.text.dark,
                        placeholder: colors.text.muted
                      } 
                    }}
                    contentStyle={{ fontSize: 16 }}
                  />
                </View>

                {/* Blood Sugar */}
                <View className="mb-4">
                  <View className="flex-row items-center mb-2">
                    <View 
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                      style={{ backgroundColor: colors.status.error + '15' }}
                    >
                      <MaterialIcons name="water-drop" size={16} color={colors.status.error} />
                    </View>
                    <Text className="text-sm font-semibold" style={{ color: colors.text.dark }}>Blood Sugar</Text>
                  </View>
                  <PaperInput
                    value={bloodSugar}
                    onChangeText={setBloodSugar}
                    placeholder="100 mg/dL"
                    keyboardType="numeric"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.status.warning}
                    style={{ backgroundColor: 'white' }}
                    theme={{ 
                      colors: { 
                        text: colors.text.dark,
                        placeholder: colors.text.muted
                      } 
                    }}
                    contentStyle={{ fontSize: 16 }}
                  />
                </View>

                {/* Temperature */}
                <View className="mb-4">
                  <View className="flex-row items-center mb-2">
                    <View 
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                      style={{ backgroundColor: colors.secondary + '15' }}
                    >
                      <MaterialIcons name="thermostat" size={16} color={colors.secondary} />
                    </View>
                    <Text className="text-sm font-semibold" style={{ color: colors.text.dark }}>Temperature</Text>
                  </View>
                  <PaperInput
                    value={temperature}
                    onChangeText={setTemperature}
                    placeholder="98.6°F"
                    keyboardType="decimal-pad"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.secondary}
                    style={{ backgroundColor: 'white' }}
                    theme={{ 
                      colors: { 
                        text: colors.text.dark,
                        placeholder: colors.text.muted
                      } 
                    }}
                    contentStyle={{ fontSize: 16 }}
                  />
                </View>
              </View>

              {/* Notes */}
              <View className="mb-6">
                <View className="flex-row items-center mb-2">
                  <View 
                    className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                    style={{ backgroundColor: colors.background.lighter }}
                  >
                    <MaterialIcons name="notes" size={16} color={colors.primary} />
                  </View>
                  <Text className="text-sm font-semibold" style={{ color: colors.text.dark }}>Additional Notes</Text>
                  <Text className="text-xs ml-2" style={{ color: colors.text.muted }}>(Optional)</Text>
                </View>
                <PaperInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional observations or symptoms..."
                  multiline
                  numberOfLines={3}
                  mode="outlined"
                  outlineColor={colors.border.light}
                  activeOutlineColor={colors.primary}
                  style={{ backgroundColor: 'white' }}
                  theme={{ 
                    colors: { 
                      text: colors.text.dark,
                      placeholder: colors.text.muted
                    } 
                  }}
                  contentStyle={{ fontSize: 16 }}
                />
              </View>

              {/* Action Button */}
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading || !selectedSeniorId}
                buttonColor={isEditing ? colors.status.success : colors.primary}
                className="rounded-2xl"
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}
              >
                {loading 
                  ? (isEditing ? 'Updating...' : 'Saving...')
                  : (isEditing ? 'Update Health Record' : 'Save Health Record')
                }
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      {selectedSeniorId && (
        <FAB
          icon="plus"
          style={{ 
            position: 'absolute', 
            margin: 16, 
            right: 0, 
            bottom: 80,
            backgroundColor: colors.primary,
            borderRadius: 16,
            zIndex: 999
          }}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
          color="white"
        />
      )}

      <CareManagerBottomNav />
    </SafeAreaView>
  );
}