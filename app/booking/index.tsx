import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Calendar, MapPin, Hash } from 'lucide-react-native'

function t(d: Date) {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function Row({ icon: Icon, title, value, mono, last }: { icon: any; title: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Icon size={16} color="#888" />
      </View>
      <View>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={[styles.rowValue, mono && styles.rowMono]}>{value}</Text>
      </View>
    </View>
  )
}

export default function BookingDetail() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadBooking() }, [])

  async function loadBooking() {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_provider_id_fkey(full_name, location)')
      .eq('id', bookingId)
      .single()
    setBooking(data)
    setLoading(false)
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>
  }

  if (!booking) {
    return <View style={styles.center}><Text>Booking not found.</Text></View>
  }

  const start = new Date(booking.starts_at)
  const provider = booking.profiles

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your booking</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Status */}
        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{booking.status}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Booking</Text>
          <Text style={styles.providerName}>with {provider?.full_name ?? 'Provider'}</Text>
        </View>

        {/* Details card */}
        <View style={styles.card}>
          <Row
            icon={Calendar}
            title="When"
            value={`${start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${t(start)}`}
          />
          <Row
            icon={MapPin}
            title="Where"
            value={provider?.location ?? booking.location ?? '—'}
          />
          <Row
            icon={Hash}
            title="Reference"
            value={booking.id.slice(0, 8).toUpperCase()}
            mono
            last
          />
        </View>

        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total paid</Text>
          <Text style={styles.amountValue}>£{(booking.amount_paid ?? 0).toFixed(0)}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 60, gap: 20 },
  statusSection: { gap: 6 },
  statusLabel: { fontSize: 11, color: '#888', letterSpacing: 0.5 },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#fff0eb', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#ff5a1f', textTransform: 'capitalize' },
  titleSection: { gap: 4 },
  title: { fontSize: 24, fontWeight: '700' },
  providerName: { fontSize: 14, color: '#888' },
  card: { backgroundColor: '#f9f9f9', borderRadius: 16, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 12, color: '#888', marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '500' },
  rowMono: { fontFamily: 'monospace', letterSpacing: 1 },
  amountCard: { backgroundColor: '#f9f9f9', borderRadius: 16, padding: 20 },
  amountLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  amountValue: { fontSize: 24, fontWeight: '700' },
})