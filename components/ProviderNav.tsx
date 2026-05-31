import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Home, Calendar, Plus, MessageCircle, User } from 'lucide-react-native'

const items = [
  { route: '/provider/studio', label: 'Home', icon: Home },
  { route: '/provider/calendar', label: 'Calendar', icon: Calendar },
  { route: '/provider/create-post', label: 'Post', icon: Plus },
  { route: '/provider/messages', label: 'Messages', icon: MessageCircle },
  { route: '/provider/profile', label: 'Profile', icon: User },
]

export function ProviderNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const isActive = pathname === item.route
        const Icon = item.icon
        return (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <Icon
              size={22}
              color={isActive ? '#111' : '#777'}
              strokeWidth={isActive ? 2.3 : 1.8}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    color: '#777',
  },
  navLabelActive: {
    color: '#111',
    fontWeight: '700',
  },
})