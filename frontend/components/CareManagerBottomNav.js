import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { translations as translationData, loadLanguage } from '../utils/i18n';

export default function CareManagerBottomNav() {
  const pathname = usePathname();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(translationData.en);

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();
  }, []);

  useEffect(() => {
    setTranslations(translationData[currentLanguage]);
  }, [currentLanguage]);

  const tabs = [
    { name: translations.dashboard || 'Dashboard', icon: 'dashboard', path: '/caremanager/dashboard' },
    { name: translations.alerts || 'Alerts', icon: 'notifications', path: '/caremanager/alerts' },
    { name: translations.tasks || 'Tasks', icon: 'checklist', path: '/caremanager/tasks' },
    { name: translations.seniors || 'Seniors', icon: 'people', path: '/caremanager/seniors' },
    { name: translations.routines || 'Routines', icon: 'event-repeat', path: '/caremanager/routines' },
    { name: translations.settings || 'Settings', icon: 'settings', path: '/caremanager/settings' },
  ];

  const handleTabPress = (path) => {
    router.replace(path);
  };

  return (
    <View className="bg-white border-t border-gray-200">
      <View className="flex-row justify-around items-center h-20 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => handleTabPress(tab.path)}
              className="flex-1 items-center justify-center py-2"
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={tab.icon}
                size={24}
                color={isActive ? '#5B718A' : '#94a3b8'}
              />
              <Text
                className={`text-xs mt-1 ${
                  isActive ? 'text-primary font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
