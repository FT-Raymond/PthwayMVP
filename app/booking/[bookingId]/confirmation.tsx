import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Calendar, MapPin, Hash, User } from 'lucide-react-native'

function time(d: Date) {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function Detail({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <Icon size={16} color="#888" />
      </View>
      <View style={styles.detailInfo}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, mono && styles.detailMono]}>{value}</Text>
      </View>
    </View>
  )
}

export default function ConfirmationPage() {
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

  return (
    <View style={styles.container}>
      {/* Success icon */}
      <View style={styles.iconBox}>
        <CheckCircle2 size={48} color="#ff5a1f" strokeWidth={2} />
      </View>
      <Text style={styles.title}>Booking Confirmed</Text>
      <Text style={styles.subtitle}>Your booking is locked in. We've sent the details to your inbox.</Text>

      {/* Details card */}
      <View style={styles.card}>
        <Detail
          icon={User}
          label="Provider"
          value={booking.profiles?.full_name ?? '—'}
        />
        <Detail
          icon={Calendar}
          label="Date & time"
          value={`${start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${time(start)}`}
        />
        <Detail
          icon={MapPin}
          label="Location"
          value={booking.profiles?.location ?? 'TBC'}
        />
        <Detail
          icon={Hash}
          label="Booking reference"
          value={booking.id.slice(0, 8).toUpperCase()}
          mono
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push(`/booking/${bookingId}` as any)}
        >
          <Text style={styles.primaryBtnText}>View booking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.secondaryBtnText}>Return home</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff0eb', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  card: { backgroundColor: '#f9f9f9', borderRadius: 16, padding: 20, gap: 16, marginBottom: 'auto' },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600' },
  detailMono: { fontFamily: 'monospace', letterSpacing: 1 },
  actions: { gap: 12, marginTop: 32 },
  primaryBtn: { backgroundColor: '#ff5a1f', borderRadius: 24, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#f5f5f5', borderRadius: 24, padding: 16, alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
})