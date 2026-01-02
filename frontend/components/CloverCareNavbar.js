import React from 'react';
import { View, TouchableOpacity, Image, Text as RNText } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const CloverCareNavbar = ({
  showLogo = true,
  showBackButton = false,
  onBackPress,
  subtitle,
  rightAction,
  backgroundColor = '#ffffff',
  logoSize = 40,
  appName = 'Clover Care',
  testID = 'clover-care-navbar'
}) => {
  return (
    <View 
      testID={testID}
      style={{
        backgroundColor,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      {/* Left Section: Back Button + Logo + Text */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {/* Back Button */}
        {showBackButton && (
          <TouchableOpacity
            onPress={onBackPress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              activeOpacity: 0.7
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
          </TouchableOpacity>
        )}

        {/* Logo */}
        {showLogo && (
          <Image
            source={require('../assets/logo.png')}
            style={{
              width: logoSize,
              height: logoSize,
              marginLeft: -18,
              marginRight: 2,
              marginTop: 2,
              resizeMode: 'contain'
            }}
          />
        )}

        {/* Text Section */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RNText
              numberOfLines={1}
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#5B718A',
                letterSpacing: 0.3,
                marginTop: 3
              }}
            >
              {appName.split(' ')[0]}
            </RNText>
            <RNText
              numberOfLines={1}
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#8DAAA5',
                letterSpacing: 0.3,
                marginTop: 3,
                marginLeft: 4
              }}
            >
              {appName.split(' ')[1]}
            </RNText>
          </View>
          {subtitle && (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginTop: 3
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Right Section: Action Button */}
      {rightAction && (
        <TouchableOpacity
          onPress={rightAction.onPress}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={rightAction.icon} 
            size={24} 
            color={rightAction.color || '#6b7280'}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CloverCareNavbar;
