import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { Calendar, ChevronRight } from 'lucide-react-native'

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const router = useRouter()

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('bookings')
      .select(`
        id, starts_at, status, amount_paid,
        profiles!bookings_provider_id_fkey(full_name, location)
      `)
      .eq('customer_id', user.id)
      .order('starts_at', { ascending: false })

    setBookings(data ?? [])
    setLoading(false)
  }

  const now = new Date()
  const filtered = bookings.filter((b) => {
    const start = new Date(b.starts_at)
    return filter === 'upcoming' ? start >= now : start < now
  })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bookings</Text>

      {/* Filter */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'upcoming' && styles.filterBtnActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'past' && styles.filterBtnActive]}
          onPress={() => setFilter('past')}
        >
          <Text style={[styles.filterText, filter === 'past' && styles.filterTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff5a1f" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Calendar size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No {filter} bookings</Text>
          <Text style={styles.emptySub}>
            {filter === 'upcoming'
              ? 'Browse the feed and book a service'
              : 'Your past bookings will appear here'}
          </Text>
          {filter === 'upcoming' && (
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.browseBtnText}>Browse Feed</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const start = new Date(item.starts_at)
            const provider = item.profiles
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/booking/${item.id}` as any)}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{start.getDate()}</Text>
                    <Text style={styles.dateMonth}>
                      {start.toLocaleDateString('en-GB', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardProvider}>{provider?.full_name ?? 'Provider'}</Text>
                    <Text style={styles.cardTime}>
                      {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    {provider?.location && (
                      <Text style={styles.cardLocation}>{provider.location}</Text>
                    )}
                    <View style={[styles.statusBadge, {
                      backgroundColor: item.status === 'confirmed' ? '#fff0eb' : '#f5f5f5'
                    }]}>
                      <Text style={[styles.statusText, {
                        color: item.status === 'confirmed' ? '#ff5a1f' : '#666'
                      }]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={18} color="#ccc" />
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  title: { fontSize: 32, fontWeight: '700', paddingHorizontal: 20, marginBottom: 20, letterSpacing: -0.8 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  filterBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0',
  },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  browseBtn: {
    backgroundColor: '#ff5a1f', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  browseBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#f0f0f0',
    borderRadius: 16, padding: 16,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  dateBox: {
    width: 48, alignItems: 'center',
    backgroundColor: '#f9f9f9', borderRadius: 12, padding: 8,
  },
  dateDay: { fontSize: 20, fontWeight: '700', color: '#111' },
  dateMonth: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  cardInfo: { flex: 1, gap: 3 },
  cardProvider: { fontSize: 15, fontWeight: '600', color: '#111' },
  cardTime: { fontSize: 13, color: '#888' },
  cardLocation: { fontSize: 12, color: '#aaa' },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 20, marginTop: 4,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
})