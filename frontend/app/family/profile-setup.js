import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { City, Country, State } from 'country-state-city';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback, 
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput as PaperTextInput, RadioButton, ActivityIndicator } from 'react-native-paper';
import { getCityByPincode } from 'pincode-info';
import { colors } from '../../theme/colors';
import logger from '../../utils/logger';
import '../../global.css';
import { translations as translationData, loadLanguage, toggleLanguage, addLanguageChangeListener } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { createUserProfile } from '../../services/auth';
import { initializeNotifications } from '../../services/notifications';

export default function FamilyProfileSetupScreen() {
  const params = useLocalSearchParams();
  const { phoneNumber, callingCode, userId, fullPhoneNumber } = params;
  const { setUserProfile } = useAuth();

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage];

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  
  // Use parsed phone number if available, otherwise use full phone number
  const displayPhone = fullPhoneNumber || (phoneNumber && callingCode ? `+${callingCode} ${phoneNumber}` : '');
  const [contactNum] = useState(displayPhone);

  // Address
  const [fullAddress, setFullAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Country/State/City data
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // Relationship to Senior
  const [relationshipToSenior, setRelationshipToSenior] = useState('');

  // Preferences
  const [preferredLang, setPreferredLang] = useState(currentLanguage);

  // Loading and modal states
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLinkingOptions, setShowLinkingOptions] = useState(false);

  // Load saved language preference
  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
      setPreferredLang(lang);
    };
    initLanguage();

    // Listen for language changes
    const removeListener = addLanguageChangeListener((newLang) => {
      setCurrentLanguage(newLang);
    });

    // Set default country to India
    const india = Country.getAllCountries().find(c => c.isoCode === 'IN');
    if (india) {
      setSelectedCountry(india);
      setCountry(india.name);
    }

    return removeListener;
  }, []);

  // Reset state and city when country changes
  useEffect(() => {
    if (selectedCountry) {
      setSelectedState(null);
      setSelectedCity(null);
      setState('');
      setCity('');
    }
  }, [selectedCountry]);

  // Reset city when state changes
  useEffect(() => {
    if (selectedState) {
      setSelectedCity(null);
      setCity('');
    }
  }, [selectedState]);

  // Handle PIN code change with geocoding
  const handlePinCodeChange = async (text) => {
    setPinCode(text);

    if (text.length === 6) {
      try {
        const postOffices = await getCityByPincode(text);
        
        if (postOffices && postOffices.length > 0) {
          const postOffice = postOffices[0]; // Use the first post office
          
          // Set country to India
          const india = Country.getAllCountries().find(c => c.isoCode === 'IN');
          if (india) {
            setSelectedCountry(india);
            setCountry(india.name);
          }

          // Set state
          const stateObj = State.getStatesOfCountry('IN').find(s => s.name === postOffice.state);
          if (stateObj) {
            setSelectedState(stateObj);
            setState(postOffice.state);
          }

          // Set city (district)
          if (stateObj) {
            const cityObj = City.getCitiesOfState('IN', stateObj.isoCode).find(c => c.name === postOffice.district);
            if (cityObj) {
              setSelectedCity(cityObj);
              setCity(postOffice.district);
            } else {
              // If exact match not found, try partial match or set district name directly
              setCity(postOffice.district);
              // Create a mock city object for display
              setSelectedCity({ name: postOffice.district });
            }
          }
        } else {
          // No data found
        }
      } catch (_error) {
        // Don't show error to user
      }
    }
  };

  // Handle getting current location
  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to get your current address. Please enable location access in your device settings and try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Your device\'s location services are turned off. Please go to Settings > Location and enable location services, then try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address && address.length > 0) {
        const place = address[0];
        // Set country
        const countryName = place.country || '';
        const countryObj = Country.getAllCountries().find(c => c.name === countryName);
        if (countryObj) {
          setSelectedCountry(countryObj);
          setCountry(countryObj.name);
        }

        // Set state/region
        const stateName = place.region || place.administrativeArea || '';
        let stateObj = null;
        if (countryObj && stateName) {
          stateObj = State.getStatesOfCountry(countryObj.isoCode).find(s => s.name === stateName);
          if (stateObj) {
            setSelectedState(stateObj);
            setState(stateObj.name);
          } else {
            // State name from location doesn't match our database, set manually
            setState(stateName);
            setSelectedState(null);
          }
        } else if (countryObj) {
          // No state name from location
          setSelectedState(null);
          setState('');
        }

        // Set city
        const cityName = place.city || place.subregion || place.district || '';
        if (stateObj) {
          const cityObj = City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode).find(c => c.name === cityName);
          if (cityObj) {
            setSelectedCity(cityObj);
            setCity(cityObj.name);
          } else if (cityName) {
            setCity(cityName);
            setSelectedCity(null);
          }
        } else if (cityName) {
          setCity(cityName);
          setSelectedCity(null);
        }

        // Set full address
        const street = place.street || '';
        const streetNumber = place.streetNumber || '';
        const district = place.district || '';
        const postalCode = place.postalCode || '';
        const subregion = place.subregion || '';
        const region = place.region || '';

        let fullAddressText = '';
        
        // Build comprehensive address
        if (streetNumber && street) {
          fullAddressText += `${streetNumber} ${street}`;
        } else if (street) {
          fullAddressText += street;
        }

        // Add district/locality if available
        if (district && district !== cityName) {
          fullAddressText += fullAddressText ? `, ${district}` : district;
        } else if (subregion && subregion !== cityName) {
          fullAddressText += fullAddressText ? `, ${subregion}` : subregion;
        }

        // Add city if not already included
        if (cityName && !fullAddressText.includes(cityName)) {
          fullAddressText += fullAddressText ? `, ${cityName}` : cityName;
        }

        // Add state if not already included
        if (region && !fullAddressText.includes(region)) {
          fullAddressText += fullAddressText ? `, ${region}` : region;
        }

        // Add postal code if not already set separately
        if (postalCode && !fullAddressText.includes(postalCode)) {
          fullAddressText += fullAddressText ? ` - ${postalCode}` : postalCode;
        }

        setFullAddress(fullAddressText);

        // Set PIN code if available
        if (postalCode) {
          setPinCode(postalCode);
        }
        Alert.alert('Success', 'Your current location has been detected and address fields have been filled.');
      } else {
        Alert.alert('Location Detected', 'Location found but address could not be determined. Please enter your address manually.');
      }
    } catch (error) {
      // Check for specific location service errors
      if (error.message && error.message.includes('location services are enabled')) {
        Alert.alert(
          'Location Services Disabled',
          'Your device\'s location services are turned off. Please go to Settings > Location and enable location services, then try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message && error.message.includes('permission')) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to get your current address. Please enable location access in your device settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Location Error',
          'Unable to get your current location. Please check your GPS settings and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle language toggle
  const handleLanguageToggle = async () => {
    const newLang = await toggleLanguage();
    setCurrentLanguage(newLang);
    setPreferredLang(newLang);
  };

  // Handle form submission
  const handleSaveProfile = async () => {
    // Simple validation
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name');
      return;
    }
    if (!age.trim()) {
      Alert.alert('Required Field', 'Please enter your age');
      return;
    }
    if (!gender) {
      Alert.alert('Required Field', 'Please select your gender');
      return;
    }
    if (!relationshipToSenior) {
      Alert.alert('Required Field', 'Please select your relationship to senior');
      return;
    }

    // Validate phone number exists and is not empty
    if (!contactNum || contactNum.trim() === '') {
      logger.error('familyProfileSetup', 'Phone number is empty or invalid', { contactNum, phoneNumber, callingCode, fullPhoneNumber });
      Alert.alert('Error', 'Phone number is invalid. Please go back and try again.');
      return;
    }

    setLoading(true);

    try {
      // Prepare profile data with proper structure (matching senior schema)
      const profileData = {
        phone: contactNum,
        role: 'family',
        name: fullName.trim(),
        age: parseInt(age),
        gender,
        language: preferredLang,
        relationshipToSenior,
        
        // Address as nested object (like senior)
        address: {
          fullAddress: fullAddress.trim(),
          city: selectedCity ? selectedCity.name : city.trim(),
          state: selectedState ? selectedState.name : state.trim(),
          country: selectedCountry ? selectedCountry.name : country.trim(),
          pinCode: pinCode.trim(),
        },
        
        // Initialize empty linked seniors array
        linkedSeniors: [],
        createdAt: new Date().toISOString(),
      };

      logger.info('familyProfileSetup', 'Creating profile with data', { userId, phone: contactNum, name: fullName });

      // Create profile in Firestore
      const result = await createUserProfile(userId, profileData);
      if (!result.success) {
        logger.error('familyProfileSetup', 'Failed to create user profile', { error: result.error, userId });
        Alert.alert('Error', 'Failed to create profile. Please try again.');
        setLoading(false);
        return;
      }

      logger.info('familyProfileSetup', `Profile created successfully for user ${userId}`);
      
      // Update the auth context with the new profile
      setUserProfile(profileData);
      
      // Initialize notifications for the newly created user
      try {
        await initializeNotifications(userId);
        logger.info('familyProfileSetup', 'Notifications initialized successfully');
      } catch (notifErr) {
        logger.error('familyProfileSetup', 'Failed to initialize notifications', notifErr);
      }
      
      // Show success alert and redirect to linking options
      Alert.alert(
        'Success',
        'Profile created successfully!',
        [
          {
            text: 'Continue',
            onPress: () => {
              setShowLinkingOptions(true);
              setLoading(false);
            }
          }
        ]
      );
      
    } catch (error) {
      logger.error('familyProfileSetup', 'Error during profile creation', { error: error.message, stack: error.stack, userId });
      Alert.alert('Error', 'Failed to create profile. Please try again.');
      setLoading(false);
    }
  };

  // Validate userId exists before rendering
  if (!userId) {
    logger.error('familyProfileSetup', 'Missing userId in route params', params);
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-lg text-red-600 mb-4">Invalid session</Text>
        <Text className="text-base text-gray-600 mb-6">Please restart signup.</Text>
        <Button mode="contained" onPress={() => router.replace('/family')}>
          Go to Login
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View className="px-4 py-3 mt-10 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 24, height: 24, resizeMode: 'contain'} }
            />
            <Text className="text-lg font-bold text-slate-900">
              {translations.appName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLanguageToggle}
            className="flex-row items-center gap-1 px-3 py-2 rounded-lg active:bg-gray-100"
            activeOpacity={0.7}
          >
            <MaterialIcons name="language" size={18} color={colors.text.primary} />
            <Text className="text-sm font-semibold text-slate-600">
              {currentLanguage === 'en' ? 'English' : 'தமிழ்'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView className="flex-1 px-4 pb-32">
            {/* Personal Info Section */}
            <View className="mb-6 mt-6">
              <Text className="text-lg font-bold text-slate-900 mb-4">
                {translations.personalInfo}
              </Text>

              {/* Full Name */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.fullName}
                  value={fullName}
                  onChangeText={setFullName}
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Age */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.age}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Gender */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.gender}
                </Text>
                <RadioButton.Group onValueChange={setGender} value={gender}>
                  <View className="flex-row gap-2">
                    <View className="flex-row items-center">
                      <RadioButton value="male" color={colors.primary} />
                      <Text className="ml-1">{translations.male}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="female" color={colors.primary} />
                      <Text className="ml-1">{translations.female}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <RadioButton value="other" color={colors.primary} />
                      <Text className="ml-1">{translations.other}</Text>
                    </View>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Contact Number (Conditional) */}
              {phoneNumber && (
                <View className="mb-4">
                  <PaperTextInput
                    mode="outlined"
                    label={translations.contactNumber}
                    value={contactNum}
                    editable={false}
                    className="bg-gray-100"
                    theme={{ colors: { primary: colors.primary } }}
                  />
                </View>
              )}

              {/* Relationship to Senior */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.relationshipToSenior}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { key: 'son', label: translations.son },
                    { key: 'daughter', label: translations.daughter },
                    { key: 'spouse', label: translations.spouse },
                    { key: 'sibling', label: translations.sibling },
                    { key: 'friend', label: translations.friend },
                    { key: 'other', label: translations.other }
                  ].map((relation) => (
                    <TouchableOpacity
                      key={relation.key}
                      onPress={() => setRelationshipToSenior(relation.key)}
                      className={`px-4 py-2.5 rounded-lg border ${
                        relationshipToSenior === relation.key
                          ? 'border-primary bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm ${
                          relationshipToSenior === relation.key
                            ? 'text-primary font-semibold'
                            : 'text-slate-700'
                        }`}
                      >
                        {relation.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Address Details Section */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-4">
                {translations.addressDetails}
              </Text>

              {/* Select from my location button */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={handleGetCurrentLocation}
                  disabled={locationLoading}
                  className="flex-row items-center justify-center gap-2 bg-primary rounded-lg py-3 active:bg-blue-700"
                  activeOpacity={0.8}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <MaterialIcons name="location-on" size={20} color={colors.white} />
                  )}
                  <Text className="text-white font-semibold text-base">
                    {locationLoading ? 'Getting Location...' : 'Select from my location'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* PIN Code */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.pinCode}
                  value={pinCode}
                  onChangeText={handlePinCodeChange}
                  keyboardType="number-pad"
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Add your whole address */}
              <View className="mb-4">
                <PaperTextInput
                  mode="outlined"
                  label={translations.addYourWholeAddress}
                  value={fullAddress}
                  onChangeText={setFullAddress}
                  multiline
                  numberOfLines={3}
                  className="bg-blue-50"
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>

              {/* Country */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.country}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-blue-50">
                  <Picker
                    selectedValue={selectedCountry ? selectedCountry.isoCode : ''}
                    onValueChange={(value) => {
                      const country = Country.getAllCountries().find(c => c.isoCode === value);
                      setSelectedCountry(country);
                      setCountry(country ? country.name : '');
                    }}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectCountry} value="" />
                    {Country.getAllCountries().map((country) => (
                      <Picker.Item key={country.isoCode} label={country.name} value={country.isoCode} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* State */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.state}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-blue-50">
                  <Picker
                    selectedValue={selectedState ? selectedState.isoCode : ''}
                    onValueChange={(value) => {
                      const state = State.getStatesOfCountry(selectedCountry?.isoCode || 'IN').find(s => s.isoCode === value);
                      setSelectedState(state);
                      setState(state ? state.name : '');
                    }}
                    enabled={!!selectedCountry}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectState} value="" />
                    {selectedCountry && State.getStatesOfCountry(selectedCountry.isoCode).map((state) => (
                      <Picker.Item key={state.isoCode} label={state.name} value={state.isoCode} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* City */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-2">
                  {translations.city}
                </Text>
                <View className="border border-gray-300 rounded-lg bg-blue-50">
                  <Picker
                    selectedValue={selectedCity ? selectedCity.name : ''}
                    onValueChange={(value) => {
                      if (selectedCountry && selectedState) {
                        const city = City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).find(c => c.name === value);
                        setSelectedCity(city || { name: value });
                        setCity(value);
                      }
                    }}
                    enabled={!!selectedState}
                    className="h-12"
                  >
                    <Picker.Item label={translations.selectCity} value="" />
                    {selectedCountry && selectedState && City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((city) => (
                      <Picker.Item key={city.name} label={city.name} value={city.name} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Preferences Section */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-4">
                {translations.preferences}
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100">
        <Button
          mode="contained"
          onPress={handleSaveProfile}
          disabled={loading}
          className="bg-primary"
          buttonColor={colors.primary}
          contentStyle={{ paddingVertical: 8 }}
        >
          {loading ? 'Creating Profile...' : translations.saveContinue}
        </Button>
      </View>

      {/* Linking Options Modal */}
      {showLinkingOptions && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Profile Created! 🎉
            </Text>
            <Text className="text-base text-gray-600 mb-6 text-center">
              Now link to a senior to start caring for them
            </Text>

            {/* Register New Senior Button */}
            <TouchableOpacity
              onPress={() => router.replace({
                pathname: '/family/register-senior',
                params: {
                  familyUID: userId,
                  familyPhone: phoneNumber,
                  familyCallingCode: callingCode
                }
              })}
              className="w-full h-14 bg-primary rounded-lg items-center justify-center mb-3"
              style={{
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Text className="text-white text-base font-bold">
                {translations.registerNewSenior}
              </Text>
            </TouchableOpacity>

            {/* Link Existing Senior Button */}
            <TouchableOpacity
              onPress={() => router.replace({
                pathname: '/family/link-senior',
                params: { familyUID: userId }
              })}
              className="w-full h-14 bg-white border-2 border-primary rounded-lg items-center justify-center mb-3"
            >
              <Text className="text-primary text-base font-bold">
                {translations.linkExistingSenior}
              </Text>
            </TouchableOpacity>

            {/* Skip for Now Button */}
            <TouchableOpacity
              onPress={() => router.replace('/family/dashboard')}
              className="w-full h-12 items-center justify-center"
            >
              <Text className="text-gray-600 text-sm font-medium">
                Skip for Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
