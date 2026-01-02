import React, { useState, useEffect } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { Portal, Dialog, Button, Text, SegmentedButtons, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors } from '../theme/colors';
import { getRoutineLogsHistory, getReminderHistory } from '../firestore/seniorFirestore';

// Utility functions for date and time formatting
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(dateObj.getTime())) return 'N/A';
  return format(dateObj, 'MMM dd, yyyy');
};

const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(dateObj.getTime())) return 'N/A';
  return format(dateObj, 'h:mm a');
};

const SeniorHistoryModal = ({ 
  visible, 
  onDismiss, 
  historyType = 'routines', // 'routines' or 'reminders'
  userId,
  translations = {}
}) => {
  const [selectedTab, setSelectedTab] = useState('completed');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch history data when modal opens or historyType changes
  useEffect(() => {
    if (!visible || !userId) {
      setHistoryData([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      
      try {
        let result;
        if (historyType === 'routines') {
          result = await getRoutineLogsHistory(userId, 7);
        } else {
          result = await getReminderHistory(userId, 7);
        }

        if (result.success) {
          setHistoryData(result.data || []);
        } else {
          setHistoryData([]);
        }
      } catch (_error) {
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [visible, userId, historyType]);

  // Filter data based on selected tab
  const filteredData = historyData.filter(item => 
    selectedTab === 'completed' 
      ? item.status === 'completed' 
      : item.status === 'missed'
  );

  // Get icon for routine type
  const getRoutineIcon = (type) => {
    const iconMap = {
      medication: 'medication',
      meal: 'restaurant',
      exercise: 'directions-walk',
      therapy: 'accessible',
      custom: 'task-alt',
    };
    return iconMap[type] || 'task-alt';
  };

  const renderHistoryItem = ({ item }) => {
    const isRoutine = historyType === 'routines';
    const icon = isRoutine ? getRoutineIcon(item.type) : 'notifications-active';

    return (
      <Card 
        style={{ 
          marginBottom: 12, 
          borderRadius: 12, 
          backgroundColor: 'white', 
          elevation: 2 
        }}
      >
        <Card.Content>
          {/* Header with Icon and Title */}
          <View style={{ flexDirection: 'row', alignItems: 'start', marginBottom: 12 }}>
            <View 
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: item.status === 'completed' ? '#dcfce7' : '#fecaca',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}
            >
              <MaterialIcons 
                name={icon} 
                size={24} 
                color={item.status === 'completed' ? '#166534' : '#991b1b'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                {item.title || (isRoutine ? 'Routine' : 'Reminder')}
              </Text>
              {!isRoutine && item.description && (
                <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                  {item.description}
                </Text>
              )}
              <View style={{ 
                backgroundColor: item.status === 'completed' ? '#dcfce7' : '#fecaca',
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 8,
                alignSelf: 'flex-start'
              }}>
                <Text style={{ 
                  color: item.status === 'completed' ? '#166534' : '#991b1b',
                  fontSize: 11, 
                  fontWeight: '700', 
                  textTransform: 'uppercase'
                }}>
                  {item.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 }} />

          {/* Time Information */}
          <View style={{ gap: 8 }}>
            {/* Scheduled Time */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="schedule" size={16} color="#64748b" />
              <Text style={{ fontSize: 13, color: '#475569', marginLeft: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>Scheduled: </Text>
                {formatDate(item.scheduledTime)} {formatTime(item.scheduledTime)}
              </Text>
            </View>

            {/* Completion/Missed Time */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons 
                name={item.status === 'completed' ? 'check-circle' : 'cancel'} 
                size={16} 
                color={item.status === 'completed' ? '#22c55e' : '#ef4444'} 
              />
              <Text style={{ fontSize: 13, color: '#475569', marginLeft: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>
                  {item.status === 'completed' ? 'Completed: ' : 'Missed: '}
                </Text>
                {formatDate(item.completedAt)} {formatTime(item.completedAt)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <Portal>
      <Dialog 
        visible={visible} 
        onDismiss={onDismiss} 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: 20, 
          maxHeight: '85%' 
        }}
      >
        <Dialog.Title style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
          {historyType === 'routines' 
            ? (translations.routinesHistory || 'Routines History')
            : (translations.remindersHistory || 'Reminders History')
          }
        </Dialog.Title>

        <Dialog.Content style={{ paddingHorizontal: 16, flexShrink: 1 }}>
          {/* Tabs for Completed / Missed */}
          <View style={{ marginBottom: 16 }}>
            <SegmentedButtons
              value={selectedTab}
              onValueChange={setSelectedTab}
              buttons={[
                { 
                  value: 'completed', 
                  label: translations.completed || 'Completed', 
                  icon: 'check-circle' 
                },
                { 
                  value: 'missed', 
                  label: translations.missed || 'Missed', 
                  icon: 'close-circle' 
                },
              ]}
              theme={{ 
                colors: { 
                  secondaryContainer: colors.primary + '20', 
                  onSecondaryContainer: colors.primary 
                } 
              }}
            />
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: '#64748b', marginTop: 12 }}>
                {translations.loading || 'Loading...'}
              </Text>
            </View>
          ) : (
            /* History List */
            <FlatList
              data={filteredData}
              renderItem={renderHistoryItem}
              keyExtractor={(item, index) => item.id || item.logId || `item-${index}`}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialIcons 
                    name="history" 
                    size={64} 
                    color="#cbd5e1" 
                  />
                  <Text style={{ 
                    color: '#94a3b8', 
                    fontSize: 16, 
                    marginTop: 12,
                    textAlign: 'center'
                  }}>
                    {selectedTab === 'completed'
                      ? (translations.noCompletedHistory || 'No completed history in the last 7 days')
                      : (translations.noMissedHistory || 'No missed history in the last 7 days')
                    }
                  </Text>
                </View>
              }
            />
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onDismiss} textColor={colors.primary}>
            {translations.close || 'Close'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default SeniorHistoryModal;
