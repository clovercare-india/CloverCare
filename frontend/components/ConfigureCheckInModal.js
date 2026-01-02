import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput
} from 'react-native';
import { Portal, Dialog, Button } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import '../global.css';

const DEFAULT_CHECK_IN_OPTIONS = [
  { id: 1, label: 'Happy', icon: 'sentiment-satisfied', color: '#10B981' },
  { id: 2, label: 'Okay', icon: 'sentiment-neutral', color: '#3B82F6' },
  { id: 3, label: 'Sad', icon: 'sentiment-dissatisfied', color: '#FBBF24' },
  { id: 4, label: 'Unwell', icon: 'sick', color: '#EF4444' },
];

const ICON_OPTIONS = [
  'sentiment-satisfied',
  'sentiment-neutral',
  'sentiment-dissatisfied',
  'sick',
  'favorite',
  'thumb-up',
  'thumb-down',
  'star',
  'mood-bad',
  'sentiment-very-satisfied',
  'sentiment-very-dissatisfied',
  'local-hospital',
];

export default function ConfigureCheckInModal({
  visible,
  onDismiss,
  seniorId,
  seniorName,
  onSave,
  existingConfig,
  loading: externalLoading
}) {
  const [checkInTimes, setCheckInTimes] = useState([]);
  const [checkInOptions, setCheckInOptions] = useState(DEFAULT_CHECK_IN_OPTIONS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());
  const [saving, setSaving] = useState(false);

  // Option editing states
  const [editingOption, setEditingOption] = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (visible && existingConfig) {
      setCheckInTimes(existingConfig.checkInTimes || []);
      setCheckInOptions(existingConfig.checkInOptions || DEFAULT_CHECK_IN_OPTIONS);
    } else if (visible && !existingConfig) {
      setCheckInTimes([]);
      setCheckInOptions(DEFAULT_CHECK_IN_OPTIONS);
    }
  }, [visible, existingConfig]);

  const handleAddTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    setTempTime(now);
    setSelectedTimeIndex(null);
    setShowTimePicker(true);
  };

  const handleEditTime = (index) => {
    const [hours, minutes] = checkInTimes[index].split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    setTempTime(time);
    setSelectedTimeIndex(index);
    setShowTimePicker(true);
  };

  const handleDeleteTime = (index) => {
    Alert.alert(
      'Delete Check-In Time',
      'Are you sure you want to remove this check-in time?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newTimes = checkInTimes.filter((_, i) => i !== index);
            setCheckInTimes(newTimes);
          }
        }
      ]
    );
  };

  const handleTimeChange = (event, date) => {
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }

    if (date) {
      if (Platform.OS === 'android') {
        // On Android, immediately save the selected time
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        if (selectedTimeIndex !== null) {
          // Edit existing
          const newTimes = [...checkInTimes];
          newTimes[selectedTimeIndex] = timeString;
          setCheckInTimes(newTimes);
        } else {
          // Add new
          setCheckInTimes([...checkInTimes, timeString]);
        }

        setShowTimePicker(false);
        setSelectedTimeIndex(null);
      } else {
        // On iOS, just update temp time for confirmation
        setTempTime(date);
      }
    }
  };

  const handleTimeConfirm = () => {
    const hours = tempTime.getHours().toString().padStart(2, '0');
    const minutes = tempTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    if (selectedTimeIndex !== null) {
      // Edit existing
      const newTimes = [...checkInTimes];
      newTimes[selectedTimeIndex] = timeString;
      setCheckInTimes(newTimes);
    } else {
      // Add new
      setCheckInTimes([...checkInTimes, timeString]);
    }

    setShowTimePicker(false);
    setSelectedTimeIndex(null);
  };

  const handleEditOption = (option) => {
    setEditingOption({ ...option });
  };

  const handleSaveOption = () => {
    if (!editingOption.label.trim()) {
      Alert.alert('Error', 'Please enter a label for the check-in option');
      return;
    }

    const newOptions = checkInOptions.map(opt =>
      opt.id === editingOption.id ? editingOption : opt
    );
    setCheckInOptions(newOptions);
    setEditingOption(null);
  };

  const handleAddOption = () => {
    const newId = Math.max(...checkInOptions.map(o => o.id), 0) + 1;
    const newOption = {
      id: newId,
      label: 'New Option',
      icon: 'sentiment-satisfied',
      color: '#3B82F6'
    };
    setCheckInOptions([...checkInOptions, newOption]);
    setEditingOption(newOption);
  };

  const handleDeleteOption = (optionId) => {
    if (checkInOptions.length <= 1) {
      Alert.alert('Error', 'You must have at least one check-in option');
      return;
    }

    Alert.alert(
      'Delete Option',
      'Are you sure you want to remove this check-in option?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCheckInOptions(checkInOptions.filter(opt => opt.id !== optionId));
          }
        }
      ]
    );
  };

  const handleSelectIcon = (icon) => {
    setEditingOption({ ...editingOption, icon });
    setShowIconPicker(false);
  };

  const handleSaveAll = async () => {
    if (checkInTimes.length === 0) {
      Alert.alert('Error', 'Please add at least one check-in time');
      return;
    }

    if (checkInOptions.length === 0) {
      Alert.alert('Error', 'Please configure at least one check-in option');
      return;
    }

    // Sort times chronologically
    const sortedTimes = [...checkInTimes].sort();

    const configData = {
      checkInTimes: sortedTimes,
      checkInOptions
    };

    setSaving(true);
    const success = await onSave(configData);
    setSaving(false);

    if (success) {
      onDismiss();
    }
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={{ maxHeight: '90%', backgroundColor: colors.background.light }}
      >
        <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 20, color: colors.text.primary }}>
          Configure Check-In
        </Dialog.Title>

        <Dialog.ScrollArea style={{ maxHeight: 500, paddingHorizontal: 0 }}>
          <ScrollView>
            {/* Senior Info */}
            {seniorName && (
              <View style={{ 
                backgroundColor: colors.background.lighter, 
                borderWidth: 1,
                borderColor: colors.border.subtle,
                borderRadius: 12, 
                padding: 16, 
                marginHorizontal: 16, 
                marginBottom: 24,
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 12, color: colors.text.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Senior</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.dark }}>{seniorName}</Text>
              </View>
            )}

            {/* Check-In Times Section */}
            <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
                  Check-In Times
                </Text>
                <TouchableOpacity
                  onPress={handleAddTime}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    elevation: 2,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                >
                  <MaterialIcons name="add" size={18} color={colors.text.light} />
                  <Text style={{ color: colors.text.light, fontSize: 14, fontWeight: '600' }}>Add Time</Text>
                </TouchableOpacity>
              </View>

              {checkInTimes.length === 0 ? (
                <View style={{ 
                  backgroundColor: colors.background.lighter, 
                  borderRadius: 12, 
                  padding: 24, 
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  borderStyle: 'dashed'
                }}>
                  <MaterialIcons name="schedule" size={40} color={colors.text.muted} />
                  <Text style={{ color: colors.text.muted, marginTop: 12, textAlign: 'center', fontSize: 14 }}>
                    No check-in times configured yet
                  </Text>
                </View>
              ) : (
                checkInTimes.map((time, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: colors.background.light,
                      borderWidth: 1,
                      borderColor: colors.border.light,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      elevation: 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: colors.background.lighter, 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <MaterialIcons name="access-time" size={24} color={colors.primary} />
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.dark }}>
                        {formatTime(time)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => handleEditTime(index)}
                        style={{ padding: 8 }}
                      >
                        <MaterialIcons name="edit" size={20} color={colors.text.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteTime(index)}
                        style={{ padding: 8 }}
                      >
                        <MaterialIcons name="delete" size={20} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Check-In Options Section */}
            <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
                  Check-In Options
                </Text>
                <TouchableOpacity
                  onPress={handleAddOption}
                  style={{
                    backgroundColor: colors.secondary,
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    elevation: 2,
                    shadowColor: colors.secondary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                >
                  <MaterialIcons name="add" size={18} color={colors.text.light} />
                  <Text style={{ color: colors.text.light, fontSize: 14, fontWeight: '600' }}>Add Option</Text>
                </TouchableOpacity>
              </View>

              {checkInOptions.map((option) => (
                <View
                  key={option.id}
                  style={{
                    backgroundColor: colors.background.light,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    elevation: 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: option.color + '15',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <MaterialIcons name={option.icon} size={28} color={option.color} />
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.dark, flex: 1 }}>
                        {option.label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => handleEditOption(option)}
                        style={{ padding: 8 }}
                      >
                        <MaterialIcons name="edit" size={20} color={colors.text.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteOption(option.id)}
                        style={{ padding: 8 }}
                      >
                        <MaterialIcons name="delete" size={20} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}>
          <Button
            onPress={onDismiss}
            mode="outlined"
            textColor={colors.text.muted}
            style={{ flex: 1, marginRight: 8, borderColor: colors.border.light }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onPress={handleSaveAll}
            mode="contained"
            buttonColor={colors.primary}
            style={{ flex: 1, marginLeft: 8 }}
            disabled={saving}
            loading={saving}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>

      {/* Time Picker - Android shows native picker, iOS shows in dialog */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Time Picker Dialog for iOS */}
      {showTimePicker && Platform.OS === 'ios' && (
        <Portal>
          <Dialog visible={showTimePicker} onDismiss={() => setShowTimePicker(false)}>
            <Dialog.Title style={{ textAlign: 'center' }}>
              {selectedTimeIndex !== null ? 'Edit Time' : 'Add Check-In Time'}
            </Dialog.Title>
            <Dialog.Content>
              <DateTimePicker
                value={tempTime}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleTimeChange}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowTimePicker(false)}>Cancel</Button>
              <Button onPress={handleTimeConfirm}>Confirm</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}

      {/* Edit Option Dialog */}
      {editingOption && (
        <Portal>
          <Dialog visible={!!editingOption} onDismiss={() => setEditingOption(null)} style={{ backgroundColor: colors.background.light }}>
            <Dialog.Title style={{ textAlign: 'center', color: colors.text.primary }}>Edit Check-In Option</Dialog.Title>
            <Dialog.Content>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.dark }}>
                Label
              </Text>
              <TextInput
                value={editingOption.label}
                onChangeText={(text) => setEditingOption({ ...editingOption, label: text })}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border.light,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 16,
                  color: colors.text.dark,
                  backgroundColor: colors.background.lighter
                }}
                placeholder="Enter label"
                placeholderTextColor={colors.text.muted}
              />

              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.dark }}>
                Icon
              </Text>
              <TouchableOpacity
                onPress={() => setShowIconPicker(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.border.light,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  backgroundColor: colors.background.lighter
                }}
              >
                <MaterialIcons name={editingOption.icon} size={32} color={editingOption.color} />
                <Text style={{ fontSize: 16, color: colors.text.dark }}>{editingOption.icon}</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.dark }}>
                Color
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { name: 'green', value: '#10B981' },
                  { name: 'blue', value: '#3B82F6' },
                  { name: 'yellow', value: '#FBBF24' },
                  { name: 'red', value: '#EF4444' },
                  { name: 'purple', value: '#8B5CF6' },
                  { name: 'pink', value: '#EC4899' }
                ].map(({ name, value }) => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => setEditingOption({ ...editingOption, color: value })}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: value,
                      borderWidth: editingOption.color === value ? 3 : 0,
                      borderColor: colors.text.dark
                    }}
                  />
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditingOption(null)} textColor={colors.text.muted}>Cancel</Button>
              <Button onPress={handleSaveOption} textColor={colors.primary}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}

      {/* Icon Picker Dialog */}
      {showIconPicker && (
        <Portal>
          <Dialog visible={showIconPicker} onDismiss={() => setShowIconPicker(false)} style={{ backgroundColor: colors.background.light }}>
            <Dialog.Title style={{ textAlign: 'center', color: colors.text.primary }}>Select Icon</Dialog.Title>
            <Dialog.ScrollArea style={{ maxHeight: 400 }}>
              <ScrollView>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
                  {ICON_OPTIONS.map(icon => (
                    <TouchableOpacity
                      key={icon}
                      onPress={() => handleSelectIcon(icon)}
                      style={{
                        width: 60,
                        height: 60,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        backgroundColor: colors.background.lighter,
                        borderWidth: editingOption?.icon === icon ? 2 : 0,
                        borderColor: colors.accent
                      }}
                    >
                      <MaterialIcons name={icon} size={32} color={colors.text.dark} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setShowIconPicker(false)} textColor={colors.primary}>Close</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </Portal>
  );
}
