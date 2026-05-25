import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { LayoutDashboard, Calendar, ClipboardList, Users, User } from 'lucide-react-native'

const items = [
  { route: '/provider/studio', label: 'Studio', icon: LayoutDashboard },
  { route: '/provider/bookings', label: 'Bookings', icon: ClipboardList },
  { route: '/provider/clients', label: 'Clients', icon: Users },
  { route: '/provider/profile', label: 'Profile', icon: User },
]

export function ProviderNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        {items.map((item) => {
          const isActive = pathname === item.route
          const Icon = item.icon
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => router.push(item.route as any)}
            >
              <Icon size={22} color={isActive ? '#ff5a1f' : '#999'} strokeWidth={isActive ? 2.2 : 1.7} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <TouchableOpacity style={styles.switchBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.switchText}>← Switch to customer view</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingBottom: 20,
  },
  nav: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    color: '#999',
  },
  navLabelActive: {
    color: '#ff5a1f',
    fontWeight: '600',
  },
  switchBtn: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 11,
    color: '#bbb',
  },
})