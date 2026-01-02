import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Portal, Dialog, Button, Text, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { firestore } from '../config/firebase';
import { colors } from '../theme/colors';
import { getUserName } from '../firestore/sharedFirestore';
import logger from '../utils/logger';

const AlertHistoryModal = ({ 
  visible, 
  onDismiss, 
  seniors = [], 
  translations = {} 
}) => {
  const [historySeniorId, setHistorySeniorId] = useState('all');
  const [historyAlerts, setHistoryAlerts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [historyMenuType, setHistoryMenuType] = useState(null);
  const unsubscribeRef = useRef(null);

  // Set up real-time listener for resolved alerts
  useEffect(() => {
    if (!visible) return;

    const setupResolvedAlertsListener = () => {
      try {
        setLoadingHistory(true);
        setHistoryAlerts([]);

        let seniorIds = [];
        if (historySeniorId === 'all') {
          seniorIds = seniors.filter(s => s.id !== 'all').map(s => s.userId);
        } else {
          seniorIds = [historySeniorId];
        }

        if (!seniorIds.length) {
          setLoadingHistory(false);
          return () => {};
        }

        // Clean up previous listeners before setting up new ones
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Set up real-time listener for resolved alerts
        const alertQueries = seniorIds.map(userId =>
          query(
            collection(firestore, 'alerts'),
            where('userId', '==', userId),
            where('status', '==', 'resolved')
          )
        );

        // Track all alerts from all seniors
        const allAlertsMap = new Map();

        // Subscribe to all queries
        const unsubscribers = alertQueries.map((q) =>
          onSnapshot(q, async (snapshot) => {
            const alertsData = snapshot.docs.map(doc => ({
              alertId: doc.id,
              id: doc.id,
              ...doc.data()
            }));

            // Update the map with alerts from this senior
            alertsData.forEach(alert => {
              allAlertsMap.set(alert.id, alert);
            });

            // Get all alerts and sort by createdAt descending
            const combinedAlerts = Array.from(allAlertsMap.values());
            combinedAlerts.sort((a, b) => {
              const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
              const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
              return timeB - timeA;
            });

            // Enrich with senior names and resolver names
            const enrichedAlerts = await Promise.all(combinedAlerts.map(async (alert) => {
              const senior = seniors.find(s => s.userId === alert.userId);
              let resolverName = 'Unknown User';
              
              // Helper to detect if a string looks like a Firebase UID
              const looksLikeUID = (str) => {
                if (!str) return false;
                return /^[a-zA-Z0-9]{20,}$/.test(str);
              };
              
              // Priority order for resolver name:
              // 1. Fetch from Firestore if we have a resolvedBy UID
              if (alert.resolvedBy) {
                const fetchedName = await getUserName(alert.resolvedBy);
                if (fetchedName !== 'Unknown User') {
                  resolverName = fetchedName;
                } else if (alert.resolverName && !looksLikeUID(alert.resolverName)) {
                  resolverName = alert.resolverName;
                }
              } 
              // 2. Use stored resolverName if it's not a UID
              else if (alert.resolverName && !looksLikeUID(alert.resolverName)) {
                resolverName = alert.resolverName;
              }
              // 3. Check if acknowledgedBy looks like a UID and fetch, otherwise use as-is
              else if (alert.acknowledgedBy) {
                if (looksLikeUID(alert.acknowledgedBy)) {
                  const fetchedName = await getUserName(alert.acknowledgedBy);
                  if (fetchedName !== 'Unknown User') {
                    resolverName = fetchedName;
                  }
                } else {
                  resolverName = alert.acknowledgedBy;
                }
              }
              
              return {
                ...alert,
                seniorName: senior?.name || senior?.fullName || 'Unknown Senior',
                resolverName: resolverName
              };
            }));

            setHistoryAlerts(enrichedAlerts);
            setLoadingHistory(false);
          }, (error) => {
            logger.error('AlertHistoryModal', 'Error listening to alerts:', error);
            setLoadingHistory(false);
          })
        );

        // Store unsubscribers for cleanup
        unsubscribeRef.current = () => {
          unsubscribers.forEach(unsub => unsub());
        };

        // Return cleanup function
        return () => {
          if (unsubscribeRef.current) unsubscribeRef.current();
        };
      } catch (err) {
        logger.error('AlertHistoryModal', 'Error setting up alert listener:', err);
        setLoadingHistory(false);
        return () => {};
      }
    };

    // Set up listener and get cleanup function
    const cleanup = setupResolvedAlertsListener();
    
    // Return cleanup function for effect cleanup
    return cleanup;
  }, [visible, historySeniorId, seniors]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAlertTypeLabel = (type) => {
    return type === 'panic_button' ? 'Panic Button' : 'Missed Check-in';
  };

  const renderHistoryItem = ({ item }) => {
    const alertId = item.alertId || item.id;
    const isExpanded = expandedAlertId === alertId;
    const alertType = getAlertTypeLabel(item.type);

    return (
      <Card 
        style={{ marginBottom: 12, borderRadius: 12, backgroundColor: 'white', elevation: 2 }}
        onPress={() => setExpandedAlertId(isExpanded ? null : alertId)}
      >
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                {alertType}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>
                {item.seniorName} • {formatDate(item.createdAt)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                backgroundColor: item.status === 'active' ? '#fecaca' : '#dcfce7',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                marginRight: 8
              }}>
                <Text style={{ 
                  color: item.status === 'active' ? '#991b1b' : '#166534',
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'capitalize'
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
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#475569' }}>
                  <Text style={{ fontWeight: 'bold' }}>Alert Type: </Text>
                  {alertType}
                </Text>
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#475569' }}>
                  <Text style={{ fontWeight: 'bold' }}>Created At: </Text>
                  {formatTime(item.createdAt)} • {formatDate(item.createdAt)}
                </Text>
              </View>
              {item.status === 'resolved' && (
                <>
                  {(item.resolvedAt || item.acknowledgedAt) && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>
                        <Text style={{ fontWeight: 'bold' }}>Resolved At: </Text>
                        {formatTime(item.resolvedAt || item.acknowledgedAt)} • {formatDate(item.resolvedAt || item.acknowledgedAt)}
                      </Text>
                    </View>
                  )}
                  {(item.resolverName || item.acknowledgedBy) && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>
                        <Text style={{ fontWeight: 'bold' }}>Resolved By: </Text>
                        {item.resolverName || item.acknowledgedBy}
                      </Text>
                    </View>
                  )}
                  {item.actionTaken && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>
                        <Text style={{ fontWeight: 'bold' }}>Action Taken: </Text>
                        {item.actionTaken.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {(item.resolutionNote || item.reason) && (
                    <View style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8, marginTop: 8 }}>
                      <Text style={{ fontSize: 13, color: '#166534', fontWeight: '600' }}>
                        <Text style={{ fontWeight: 'bold' }}>Notes: </Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                        {item.resolutionNote || item.reason}
                      </Text>
                    </View>
                  )}
                </>
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
          {translations.alertHistory || 'Alert History'}
        </Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 0, flexShrink: 1 }}>
          <ScrollView 
            style={{ maxHeight: 500 }}
            scrollEventThrottle={16}
          >
            <View style={{ paddingHorizontal: 16, marginBottom: 16, marginTop: 12 }}>
              {seniors.length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setHistoryMenuType(prev => prev === 'senior' ? null : 'senior')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      backgroundColor: '#f8fafc',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e2e8f0'
                    }}
                  >
                    <Text style={{ color: '#1e293b', fontWeight: '600' }}>
                      {historySeniorId === 'all' ? 'All Seniors' : seniors.find(s => s.userId === historySeniorId)?.name || 'Select Senior'}
                    </Text>
                    <MaterialIcons name={historyMenuType === 'senior' ? "expand-less" : "expand-more"} size={24} color="#1e293b" />
                  </TouchableOpacity>
                  {historyMenuType === 'senior' && (
                    <View style={{
                      position: 'absolute',
                      top: 50,
                      left: 16,
                      right: 16,
                      backgroundColor: 'white',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      elevation: 5,
                      zIndex: 3000,
                      maxHeight: 200
                    }}>
                      <ScrollView>
                        <TouchableOpacity onPress={() => { setHistorySeniorId('all'); setHistoryMenuType(null); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                          <Text style={{ color: '#1e293b' }}>All Seniors</Text>
                        </TouchableOpacity>
                        {seniors.filter(s => s.id !== 'all').map(s => (
                          <TouchableOpacity key={s.userId} onPress={() => { setHistorySeniorId(s.userId); setHistoryMenuType(null); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ color: '#1e293b' }}>{s.name || s.fullName}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </View>

            {loadingHistory && historyAlerts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : historyAlerts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8' }}>{translations.noAlerts || 'No alerts found'}</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                {historyAlerts.map((item, index) => (
                  <View key={item.alertId || item.id || `alert-${index}`}>
                    {renderHistoryItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} textColor={colors.primary}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default AlertHistoryModal;
