import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Star } from 'lucide-react-native'

function pad(n: number) { return n.toString().padStart(2, '0') }

function fmtRange(starts: string, ends: string) {
  const s = new Date(starts)
  const e = new Date(ends)
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`
}

function Row({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {action}
    </View>
  )
}

export default function ReviewPage() {
  const { providerId, starts, ends } = useLocalSearchParams<{ providerId: string; starts: string; ends: string }>()
  const router = useRouter()
  const [provider, setProvider] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const { data } = await supabase
      .from('profiles')
      .select('*, provider_profiles(*)')
      .eq('id', providerId)
      .single()
    setProvider(data)
    setLoading(false)
  }

  async function book() {
    if (!user) { router.push('/(auth)/login'); return }
    if (!provider) return
    setBusy(true)

    const { data: oppData } = await supabase
      .from('opportunities')
      .select('id')
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!oppData) {
      Alert.alert('Error', 'No active opportunity found')
      setBusy(false)
      return
    }

    const { data: slotData } = await supabase
      .from('opportunity_slots')
      .select('id')
      .eq('opportunity_id', oppData.id)
      .eq('starts_at', starts)
      .single()

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: user.id,
        provider_id: providerId,
        opportunity_id: oppData.id,
        slot_id: slotData?.id ?? null,
        starts_at: starts,
        status: 'confirmed',
      })
      .select('id')
      .single()

    setBusy(false)
    if (error || !data) { Alert.alert('Error', error?.message ?? 'Could not create booking'); return }
    router.push(`/booking/${data.id}/confirmation` as any)
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>
  }

  const range = starts && ends ? fmtRange(starts, ends) : ''
  const name = provider?.full_name ?? 'Provider'
  const category = provider?.provider_profiles?.category ?? 'Service'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & book</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {/* Provider info */}
          <View style={styles.providerRow}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerAvatarText}>
                {name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{name} · {category}</Text>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} color="#ccc" fill="#ccc" />
                ))}
              </View>
            </View>
          </View>

          {/* Booking details */}
          <Row label="Date & Time" value={range} action={
            <TouchableOpacity style={styles.changeBtn} onPress={() => router.back()}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          } />
          <Row label="Location" value={provider?.location ?? 'TBC'} />
          <Row label="Category" value={category} />
          <Row label="Cancellation" value="Contact provider for policy" />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.payBtn, busy && styles.payBtnDisabled]} onPress={book} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.terms}>
          By confirming, you agree to our booking terms and Terms of Service.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '500' },
  scroll: { flex: 1 },
  content: { padding: 20 },
  card: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16, gap: 0 },
  providerRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  providerAvatar: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  providerAvatarText: { fontSize: 20, fontWeight: '600' },
  providerInfo: { flex: 1, justifyContent: 'center' },
  providerName: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, marginTop: 12 },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  rowValue: { fontSize: 13, color: '#666' },
  changeBtn: { backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  changeBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  payBtn: { backgroundColor: '#ff5a1f', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  terms: { fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 16 },
})