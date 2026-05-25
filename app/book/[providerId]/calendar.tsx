import { useState, useMemo, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft } from 'lucide-react-native'

function buildCalendar(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days: { date: Date; inMonth: boolean; disabled: boolean }[] = []
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(first); d.setDate(first.getDate() - (startOffset - i))
    days.push({ date: d, inMonth: false, disabled: true })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(month.getFullYear(), month.getMonth(), d)
    days.push({ date, inMonth: true, disabled: date < today })
  }
  while (days.length % 7 !== 0) {
    const lastDay = days[days.length - 1].date
    const d = new Date(lastDay); d.setDate(lastDay.getDate() + 1)
    days.push({ date: d, inMonth: false, disabled: true })
  }
  return days
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CalendarPage() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>()
  const router = useRouter()
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [provider, setProvider] = useState<any>(null)
  const [slots, setSlots] = useState<any[]>([])
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { loadData() }, [month, providerId])

  async function loadData() {
    setLoading(true)
    const { data: pData } = await supabase
      .from('profiles')
      .select('*, provider_profiles(*)')
      .eq('id', providerId)
      .single()
    setProvider(pData)

    const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString()
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString()

    const { data: oppData } = await supabase
      .from('opportunities')
      .select('id')
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (oppData) {
      const { data: sData } = await supabase
        .from('opportunity_slots')
        .select('id, starts_at, ends_at, slots_remaining')
        .eq('opportunity_id', oppData.id)
        .gte('starts_at', start)
        .lt('starts_at', end)
        .order('starts_at')
      setSlots(sData ?? [])
    }

    const { data: bData } = await supabase
      .from('bookings')
      .select('starts_at, status')
      .eq('provider_id', providerId)
      .gte('starts_at', start)
      .lt('starts_at', end)
    const set = new Set<string>()
    ;(bData ?? []).filter((b: any) => b.status !== 'cancelled').forEach((b: any) => set.add(b.starts_at))
    setBookedKeys(set)
    setLoading(false)
  }

  const availableByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    slots.forEach((s) => {
      if (bookedKeys.has(s.starts_at)) return
      const key = new Date(s.starts_at).toDateString()
      const arr = map.get(key) ?? []; arr.push(s); map.set(key, arr)
    })
    return map
  }, [slots, bookedKeys])

  const days = useMemo(() => buildCalendar(month), [month])
  const daySlots = selected ? availableByDay.get(selected.toDateString()) ?? [] : []
  const slot = daySlots.find((s) => s.id === slotId) ?? daySlots[0]

  function onContinue() {
    if (!selected || !slot) return
    if (!user) { router.push('/(auth)/login'); return }
    router.push({
      pathname: '/book/[providerId]/review',
      params: { providerId, starts: slot.starts_at, ends: slot.ends_at },
    })
  }

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {selected ? selected.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' }) : 'Pick a date'}
          </Text>
          <Text style={styles.headerSub}>
            {provider?.provider_profiles?.category ?? 'Service'}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Text style={styles.navBtn}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Text style={styles.navBtn}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {days.map(({ date, inMonth, disabled }, i) => {
            const isSel = selected && date.toDateString() === selected.toDateString()
            const hasAvail = availableByDay.has(date.toDateString())
            const effectivelyDisabled = disabled || !hasAvail
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.gridCell,
                  isSel && styles.gridCellSelected,
                  !inMonth && styles.gridCellFaded,
                ]}
                onPress={() => !effectivelyDisabled && setSelected(date)}
                disabled={effectivelyDisabled}
              >
                <Text style={[
                  styles.gridDay,
                  isSel && styles.gridDaySelected,
                  effectivelyDisabled && styles.gridDayDisabled,
                ]}>
                  {date.getDate()}
                </Text>
                {hasAvail && !isSel && inMonth && <View style={styles.availDot} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Time slots */}
        {selected && daySlots.length === 0 && (
          <Text style={styles.noSlots}>No open slots that day.</Text>
        )}
        {daySlots.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slots} contentContainerStyle={styles.slotsContent}>
            {daySlots.map((s) => {
              const isActive = slot?.id === s.id
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.slotBtn, isActive && styles.slotBtnActive]}
                  onPress={() => setSlotId(s.id)}
                >
                  <Text style={[styles.slotTime, isActive && styles.slotTimeActive]}>
                    {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}
                  </Text>
                  <View style={styles.slotDot} />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerPrice}>
            {slot ? `£${(slot.slots_remaining ?? 0)} slots left` : 'Select a slot'}
          </Text>
          <Text style={styles.footerSub}>
            {provider?.provider_profiles?.category}
            {selected && ` · ${selected.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.continueBtn, (!selected || !slot) && styles.continueBtnDisabled]}
          onPress={onContinue}
          disabled={!selected || !slot}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  dayLabels: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { fontSize: 14, color: '#888' },
  monthLabel: { fontSize: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  gridCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  gridCellSelected: { borderWidth: 1, borderColor: '#111' },
  gridCellFaded: { opacity: 0.3 },
  gridDay: { fontSize: 14, color: '#111' },
  gridDaySelected: { fontWeight: '600' },
  gridDayDisabled: { color: '#ccc' },
  availDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' },
  noSlots: { textAlign: 'center', fontSize: 14, color: '#888', marginBottom: 16 },
  slots: { marginBottom: 16 },
  slotsContent: { gap: 8, paddingHorizontal: 2 },
  slotBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f5f5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  slotBtnActive: { backgroundColor: '#111' },
  slotTime: { fontSize: 14, color: '#111' },
  slotTimeActive: { color: '#fff' },
  slotDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerPrice: { fontSize: 18, fontWeight: '600' },
  footerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  continueBtn: { backgroundColor: '#ff5a1f', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})