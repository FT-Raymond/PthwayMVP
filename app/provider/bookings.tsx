import { useState, useEffect } from 'react'
import { ProviderNav } from '@/components/ProviderNav'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Clock, TrendingUp, AlertCircle } from 'lucide-react-native'

type Filter = 'all' | 'confirmed' | 'pending' | 'cancelled'

function initials(s: string) {
  return s.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })

const statusStyle: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#fff0eb', text: '#ff5a1f' },
  pending: { bg: '#f5f5f5', text: '#666' },
  cancelled: { bg: '#fff0f0', text: '#e00' },
}

export default function ProviderBookings() {
  const [filter, setFilter] = useState<Filter>('all')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('bookings')
      .select('id, customer_id, starts_at, status, amount_paid, created_at')
      .eq('provider_id', user.id)
      .order('starts_at', { ascending: true })

    if (data) {
      const ids = Array.from(new Set(data.map((b: any) => b.customer_id)))
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Client'))
      }
      setBookings(data.map((b: any) => ({ ...b, client_name: names.get(b.customer_id) ?? 'Client' })))
    }
    setLoading(false)
  }

  const all = bookings
  const filtered = filter === 'all' ? all : all.filter((b) => b.status === filter)
  const pendingCount = all.filter((b) => b.status === 'pending').length
  const revenue = all.filter((b) => b.status !== 'cancelled').reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)

return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>{all.length} total · {pendingCount} need a reply</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <TrendingUp size={12} color="#ff5a1f" />
            <Text style={styles.statCardLabel}>REVENUE</Text>
          </View>
          <Text style={styles.statCardValue}>£{revenue.toFixed(0)}</Text>
          <Text style={styles.statCardSub}>All bookings</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <AlertCircle size={12} color="#ff5a1f" />
            <Text style={styles.statCardLabel}>PENDING</Text>
          </View>
          <Text style={styles.statCardValue}>{pendingCount}</Text>
          <Text style={styles.statCardSub}>Awaiting reply</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        {(['all', 'confirmed', 'pending', 'cancelled'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f[0].toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <Text style={styles.listCount}>{filtered.length} bookings</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No bookings yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((b) => {
            const s = statusStyle[b.status] ?? statusStyle.pending
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingCard}
                onPress={() => router.push(`/booking/${b.id}` as any)}
              >
                <View style={styles.bookingAvatar}>
                  <Text style={styles.bookingAvatarText}>{initials(b.client_name)}</Text>
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingName}>{b.client_name}</Text>
                  <View style={styles.bookingTimeRow}>
                    <Clock size={11} color="#999" />
                    <Text style={styles.bookingTime}>{fmtDate(b.starts_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusText, { color: s.text }]}>
                      {b.status[0].toUpperCase() + b.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingRight}>
                  <Text style={styles.bookingAmount}>£{(b.amount_paid ?? 0).toFixed(0)}</Text>
                  <ChevronRight size={15} color="#ccc" />
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </ScrollView>
    <ProviderNav />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 36 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16 },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  statCardLabel: { fontSize: 10, fontWeight: '600', color: '#888', letterSpacing: 0.5 },
  statCardValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statCardSub: { fontSize: 12, color: '#888', marginTop: 8 },
  filters: { marginBottom: 20 },
  filtersContent: { gap: 8, paddingHorizontal: 2 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  listCount: { fontSize: 12, color: '#888' },
  center: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#888' },
  list: { gap: 10 },
  bookingCard: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 14, gap: 12 },
  bookingAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  bookingAvatarText: { fontSize: 12, fontWeight: '600' },
  bookingInfo: { flex: 1 },
  bookingName: { fontSize: 14, fontWeight: '600' },
  bookingTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bookingTime: { fontSize: 12, color: '#888' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 8 },
  statusText: { fontSize: 10, fontWeight: '600' },
  bookingRight: { alignItems: 'flex-end', gap: 4 },
  bookingAmount: { fontSize: 15, fontWeight: '700' },
})