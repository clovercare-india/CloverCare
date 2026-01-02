import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { View, Platform } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

export default function BottomNav({ navItems }) {
  const pathname = usePathname();

  const handleNavigation = (route) => {
    if (pathname === route) return;
    router.replace(route);
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 16,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
      }}
    >
      <View className="flex-row justify-around items-center py-2 pb-4">
        {navItems.map((item) => {
          const isActive = pathname === item.route;

          return (
            <TouchableRipple
              key={item.name}
              onPress={() => handleNavigation(item.route)}
              rippleColor="rgba(91, 113, 138, 0.15)"
              className="flex-1 items-center py-2"
              style={{ borderRadius: 12 }}
            >
              <View className="items-center w-full">
                <View
                  className={`items-center justify-center px-2 py-1 rounded-xl ${
                    isActive ? 'bg-primary-100' : ''
                  }`}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={24}
                    color={isActive ? '#5B718A' : '#64748b'}
                  />
                  <Text
                    className={`text-xs font-semibold mt-1 ${
                      isActive ? 'text-primary' : 'text-slate-500'
                    }`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
              </View>
            </TouchableRipple>
          );
        })}
      </View>
    </View>
  );
}
