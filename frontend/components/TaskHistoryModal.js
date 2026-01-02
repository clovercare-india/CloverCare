import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { Portal, Dialog, Button, Text, SegmentedButtons, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors } from '../theme/colors';
import { 
  listenToCarerTasksForAssignedSeniors,
  listenToRemindersForAssignedSeniors,
  listenToTasksCreatedByCareManager
} from '../firestore/caremanagerFirestore';

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

const TaskHistoryModal = ({ 
  visible, 
  onDismiss, 
  role, 
  seniors = [], 
  translations = {},
  user = null // Add user prop to get current user ID
}) => {
  const [historyTab, setHistoryTab] = useState('completed');
  const [historySeniorId, setHistorySeniorId] = useState('all');
  const [historyTasks, setHistoryTasks] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMenuType, setHistoryMenuType] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // Real-time listeners setup - similar to main tasks screen
  useEffect(() => {
    if (!visible || !seniors.length || !user?.uid) {
      setHistoryTasks([]);
      return;
    }

    setLoadingHistory(true);
    const assignedSeniorIds = seniors
      .filter(s => (s.userId || s.id) && (s.userId || s.id) !== 'all')
      .map(s => s.userId || s.id);
    
    if (!assignedSeniorIds.length) {
      setLoadingHistory(false);
      return;
    }

    let unsubscribeServiceRequests, unsubscribeReminders, unsubscribeMyTasks;

    const getSeniorName = (seniorId) => {
      return seniors.find(s => (s.userId || s.id) === seniorId)?.name || 'Unknown Senior';
    };

    // Listen to service requests (completed and cancelled)
    unsubscribeServiceRequests = listenToCarerTasksForAssignedSeniors(assignedSeniorIds, async (tasks) => {
      const processed = tasks
        .filter(task => ['completed', 'cancelled'].includes(task.status))
        .map(task => ({
          id: task.id || task.taskId,
          seniorId: task.seniorId,
          seniorName: getSeniorName(task.seniorId),
          taskDescription: task.taskDescription || task.title || 'No description',
          scheduledTime: task.scheduledAt ? `${formatDate(task.scheduledAt)} ${formatTime(task.scheduledAt)}` : formatTime(task.createdAt),
          status: task.status,
          type: 'service_request',
          createdAt: task.createdAt,
          scheduledAt: task.scheduledAt,
          completedAt: task.updatedAt,
          updatedAt: task.updatedAt,
          originalRequest: task
        }));
      
      setHistoryTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'service_request');
        const combined = [...filtered, ...processed];
        // Remove duplicates by ID across all types
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique;
      });
    });

    // Listen to reminders (completed and cancelled)
    unsubscribeReminders = listenToRemindersForAssignedSeniors(assignedSeniorIds, async (remindersList) => {
      const processed = remindersList
        .filter(reminder => ['completed', 'missed'].includes(reminder.status))
        .map(reminder => ({
          id: reminder.id,
          seniorId: reminder.userId,
          seniorName: getSeniorName(reminder.userId),
          taskDescription: reminder.title ? `${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}` : 'Reminder',
          scheduledTime: reminder.scheduledTime ? `${formatDate(reminder.scheduledTime)} ${formatTime(reminder.scheduledTime)}` : formatTime(reminder.createdAt),
          status: reminder.status,
          type: 'reminder',
          createdAt: reminder.createdAt || reminder.scheduledTime,
          scheduledAt: reminder.scheduledTime,
          completedAt: reminder.updatedAt,
          updatedAt: reminder.updatedAt,
          originalReminder: reminder
        }));
      
      setHistoryTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'reminder');
        const combined = [...filtered, ...processed];
        // Remove duplicates by ID across all types
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique;
      });
    });

    // Listen to care manager created tasks (completed and cancelled)
    unsubscribeMyTasks = listenToTasksCreatedByCareManager(user.uid, (myTasks) => {
      const processed = myTasks
        .filter(task => ['completed', 'cancelled'].includes(task.status))
        .map(task => ({
          id: task.taskId,
          seniorId: task.seniorId,
          seniorName: getSeniorName(task.seniorId),
          taskDescription: task.taskDescription,
          scheduledTime: task.scheduledAt ? `${formatDate(task.scheduledAt)} ${formatTime(task.scheduledAt)}` : formatTime(task.createdAt),
          status: task.status,
          type: 'care_manager_task',
          createdAt: task.createdAt,
          scheduledAt: task.scheduledAt,
          completedAt: task.updatedAt,
          updatedAt: task.updatedAt,
          originalTask: task
        }));
      
      setHistoryTasks(prev => {
        const filtered = prev.filter(t => t.type !== 'care_manager_task');
        const combined = [...filtered, ...processed];
        // Remove duplicates by ID across all types
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique;
      });
    });

    setLoadingHistory(false);

    return () => {
      if (unsubscribeServiceRequests) unsubscribeServiceRequests();
      if (unsubscribeReminders) unsubscribeReminders();
      if (unsubscribeMyTasks) unsubscribeMyTasks();
    };
  }, [visible, seniors, user?.uid]);

  // Filter tasks based on current tab and senior selection
  const filteredHistoryTasks = historyTasks
    .filter(task => {
      const statusMatch = historyTab === 'completed' 
        ? task.status === 'completed' 
        : ['cancelled', 'missed'].includes(task.status);
      
      const seniorMatch = historySeniorId === 'all' || task.seniorId === historySeniorId;
      return statusMatch && seniorMatch;
    })
    .sort((a, b) => {
      const timeA = a.completedAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(a.completedAt || a.updatedAt || 0);
      const timeB = b.completedAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(b.completedAt || b.updatedAt || 0);
      return timeB.getTime() - timeA.getTime();
    });

  const renderHistoryItem = ({ item }) => {
    const itemId = item.id || item.taskId;
    const isExpanded = expandedHistoryId === itemId;
    
    const createdAt = item.createdAt;
    const completedAt = item.completedAt || item.updatedAt;

    return (
      <Card 
        style={{ marginBottom: 12, borderRadius: 12, backgroundColor: 'white', elevation: 2 }} 
        onPress={() => setExpandedHistoryId(isExpanded ? null : itemId)}
      >
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>{item.taskDescription || item.title}</Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>{item.seniorName} • {formatDate(createdAt)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                backgroundColor: item.status === 'completed' ? '#dcfce7' : '#fecaca',
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                marginRight: 8
              }}>
                <Text style={{ 
                  color: item.status === 'completed' ? '#166534' : '#991b1b',
                  fontSize: 11, fontWeight: '700', textTransform: 'uppercase'
                }}>
                  {item.status}
                </Text>
              </View>
              <MaterialIcons 
                name={isExpanded ? "expand-less" : "expand-more"} 
                size={24} 
                color="#64748b" 
              />
            </View>
          </View>
          {isExpanded && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: '#475569' }}>
                  <Text style={{ fontWeight: 'bold' }}>Created At: </Text>
                  {formatTime(createdAt)}
                </Text>
                <Text style={{ fontSize: 13, color: '#475569' }}>
                  <Text style={{ fontWeight: 'bold' }}>{item.status === 'completed' ? 'Completed At: ' : 'Cancelled At: '}</Text>
                  {formatTime(completedAt)}
                </Text>
              </View>
              {(item.originalRequest?.type || item.originalTask?.type || item.originalReminder?.type || item.type) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <MaterialIcons name="category" size={14} color="#64748b" />
                  <Text style={{ fontSize: 13, color: '#475569', marginLeft: 4 }}>
                    <Text style={{ fontWeight: 'bold' }}>Type: </Text>
                    {(item.originalRequest?.type || item.originalTask?.type || item.originalReminder?.type || item.type)
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </Text>
                </View>
              )}
              {item.scheduledAt && (
                <View style={{ backgroundColor: '#eff6ff', padding: 8, borderRadius: 8, marginTop: 8 }}>
                  <Text style={{ fontSize: 13, color: '#1e40af', fontWeight: '700' }}>
                    <MaterialIcons name="alarm" size={14} color="#2563eb" /> Required At: {formatDate(item.scheduledAt)} {formatTime(item.scheduledAt)}
                  </Text>
                </View>
              )}
              {(item.description || item.taskDescription) && (
                <Text style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>
                  <Text style={{ fontWeight: 'bold' }}>Description: </Text>
                  {item.description || item.taskDescription}
                </Text>
              )}
              {item.notes && (
                <Text style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  <Text style={{ fontWeight: 'bold' }}>Notes: </Text>{item.notes}
                </Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ backgroundColor: 'white', borderRadius: 20, maxHeight: '85%' }}>
        <Dialog.Title style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
          {translations.history || 'Task History'}
        </Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 0, flexShrink: 1 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            {role !== 'senior' && seniors.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setHistoryMenuType(prev => prev === 'senior' ? null : 'senior')}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'
                  }}
                >
                  <Text style={{ color: '#1e293b', fontWeight: '600' }}>
                    {historySeniorId === 'all' ? 'All Seniors' : seniors.find(s => (s.id || s.userId) === historySeniorId)?.name || 'Select Senior'}
                  </Text>
                  <MaterialIcons name={historyMenuType === 'senior' ? "expand-less" : "expand-more"} size={24} color="#1e293b" />
                </TouchableOpacity>
                {historyMenuType === 'senior' && (
                  <View style={{
                    position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: 'white',
                    borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 5, zIndex: 3000, maxHeight: 200
                  }}>
                    <ScrollView>
                      <TouchableOpacity onPress={() => { setHistorySeniorId('all'); setHistoryMenuType(null); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text>All Seniors</Text>
                      </TouchableOpacity>
                      {seniors.filter(s => s.id !== 'all' && s.userId !== 'all').map(s => (
                        <TouchableOpacity key={s.id || s.userId} onPress={() => { setHistorySeniorId(s.id || s.userId); setHistoryMenuType(null); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                          <Text>{s.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
            <SegmentedButtons
              value={historyTab}
              onValueChange={setHistoryTab}
              buttons={[
                { value: 'completed', label: 'Completed', icon: 'check-circle' },
                { value: 'cancelled', label: 'Cancelled', icon: 'close-circle' },
              ]}
              theme={{ colors: { secondaryContainer: colors.primary + '20', onSecondaryContainer: colors.primary } }}
            />
          </View>

          {loadingHistory && historyTasks.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredHistoryTasks}
              renderItem={renderHistoryItem}
              keyExtractor={item => `${item.type}-${item.id || item.taskId}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8' }}>No history found</Text>
                </View>
              }
            />
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} textColor={colors.primary}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default TaskHistoryModal;
