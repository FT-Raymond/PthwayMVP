import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, TrendingUp, Plus, Lock, Clock, X } from 'lucide-react-native'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function initials(s: string) {
  return s.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function ProviderCalendar() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [bookings, setBookings] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  useEffect(() => { loadData() }, [year, month])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 1).toISOString()

    const { data: bData } = await supabase
      .from('bookings')
      .select('id, customer_id, starts_at, status, amount_paid')
      .gte('starts_at', start).lt('starts_at', end).order('starts_at')

    if (bData) {
      const ids = Array.from(new Set(bData.map((b: any) => b.customer_id)))
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Client'))
      }
      setBookings(bData.map((b: any) => ({ ...b, client_name: names.get(b.customer_id) ?? 'Client' })))
    }

    const { data: sData } = await supabase
      .from('opportunity_slots')
      .select('id, starts_at, ends_at, slots_remaining')
      .gte('starts_at', start).lt('starts_at', end).order('starts_at')
    setSlots(sData ?? [])
    setLoading(false)
  }

  const byDay = useMemo(() => {
    const map = new Map<number, any[]>()
    bookings.forEach((b) => {
      const d = new Date(b.starts_at).getDate()
      const arr = map.get(d) ?? []; arr.push(b); map.set(d, arr)
    })
    return map
  }, [bookings])

  const slotsByDay = useMemo(() => {
    const map = new Map<number, any[]>()
    slots.forEach((s) => {
      const d = new Date(s.starts_at).getDate()
      const arr = map.get(d) ?? []; arr.push(s); map.set(d, arr)
    })
    return map
  }, [slots])

  const active = bookings.filter((b) => b.status !== 'cancelled')
  const monthEarnings = active.reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
  const daySlots = byDay.get(selectedDay) ?? []
  const dayAvail = slotsByDay.get(selectedDay) ?? []
  const dayEarnings = daySlots.filter((b) => b.status !== 'cancelled').reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0)
  const selectedDate = new Date(year, month, selectedDay)

  async function deleteSlot(id: string) {
    await supabase.from('opportunity_slots').delete().eq('id', id)
    setSlots(slots.filter((s) => s.id !== id))
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.monthRow}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft size={15} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight size={15} color="#111" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Earnings card */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsTop}>
          <Text style={styles.earningsLabel}>Monthly earnings</Text>
          <View style={styles.liveBadge}>
            <TrendingUp size={9} color="#ff5a1f" />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        </View>
        <Text style={styles.earningsValue}>£{monthEarnings.toFixed(0)}</Text>
        <Text style={styles.earningsSub}>From {active.length} bookings this month</Text>
      </View>

      {/* Calendar grid */}
      <View style={styles.calCard}>
        <View style={styles.dayLabels}>
          {DAYS.map((d) => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
        </View>
        <View style={styles.grid}>
          {Array.from({ length: firstDayOffset }).map((_, i) => <View key={`e-${i}`} style={styles.gridCell} />)}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1
            const isSelected = day === selectedDay
            const isBooked = byDay.has(day)
            const hasSlot = slotsByDay.has(day)
            return (
              <TouchableOpacity
                key={day}
                style={[styles.gridCell, isSelected && styles.gridCellSelected]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.gridDay, isSelected && styles.gridDaySelected]}>{day}</Text>
                {(isBooked || hasSlot) && !isSelected && (
                  <View style={styles.dots}>
                    {isBooked && <View style={[styles.dot, { backgroundColor: '#ff5a1f' }]} />}
                    {hasSlot && <View style={[styles.dot, { backgroundColor: '#10b981' }]} />}
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Day header */}
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {selectedDate.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })}
          </Text>
          {dayEarnings > 0 && (
            <Text style={styles.dayEarnings}>Earned · <Text style={styles.dayEarningsAmount}>£{dayEarnings.toFixed(0)}</Text></Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setSheetOpen(true)}>
          <Plus size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Open slots */}
      {dayAvail.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionMeta}>OPEN SLOTS</Text>
          {dayAvail.map((s) => (
            <View key={s.id} style={styles.slotCard}>
              <View style={styles.slotTime}>
                <Text style={styles.slotTimeText}>{fmtTime(s.starts_at)}</Text>
                <Text style={styles.slotTimeEnd}>{fmtTime(s.ends_at)}</Text>
              </View>
              <View style={styles.slotDivider} />
              <View style={styles.slotInfo}>
                <Text style={styles.slotTitle}>Available</Text>
                <Text style={styles.slotSub}>{s.slots_remaining} slots remaining</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteSlot(s.id)}>
                <X size={13} color="#666" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Bookings */}
      {daySlots.length === 0 && dayAvail.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No bookings or open slots for this day.</Text>
          <Text style={styles.emptySub}>Tap + to add availability.</Text>
        </View>
      ) : daySlots.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionMeta}>BOOKINGS</Text>
          {daySlots.map((b) => (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.slotTime}>
                <Text style={styles.slotTimeText}>{fmtTime(b.starts_at)}</Text>
              </View>
              <View style={styles.slotDivider} />
              <View style={styles.bookingAvatar}>
                <Text style={styles.bookingAvatarText}>{initials(b.client_name)}</Text>
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotTitle}>{b.client_name}</Text>
                <Text style={[styles.slotSub, { textTransform: 'capitalize' }]}>{b.status}</Text>
              </View>
              <Text style={styles.bookingAmount}>£{(b.amount_paid ?? 0).toFixed(0)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Lock size={15} color="#666" />
          <Text style={styles.actionBtnText}>Block time</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setSheetOpen(true)}>
          <Plus size={15} color="#666" />
          <Text style={styles.actionBtnText}>Set availability</Text>
        </TouchableOpacity>
      </View>

      {/* Add slot modal */}
      <AddSlotModal
        visible={sheetOpen}
        defaultDate={selectedDate}
        userId={userId}
        onClose={() => setSheetOpen(false)}
        onDone={() => { setSheetOpen(false); loadData() }}
      />
    </ScrollView>
  )
}

function AddSlotModal({ visible, defaultDate, userId, onClose, onDone }: {
  visible: boolean; defaultDate: Date; userId: string | null
  onClose: () => void; onDone: () => void
}) {
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState('2')
  const [slots, setSlots] = useState('1')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!userId) { Alert.alert('Error', 'Not signed in'); return }
    setSaving(true)
    try {
      const [h, m] = time.split(':').map(Number)
      const startsAt = new Date(defaultDate)
      startsAt.setHours(h, m, 0, 0)
      const endsAt = new Date(startsAt.getTime() + Number(duration) * 3600_000)

      const { data: opp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('provider_id', userId)
        .limit(1)
        .single()

      if (!opp) { Alert.alert('Error', 'Create an opportunity first'); setSaving(false); return }

      const { error } = await supabase.from('opportunity_slots').insert({
        opportunity_id: opp.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        slots_remaining: Number(slots),
      })
      if (error) throw error
      onDone()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>Add availability</Text>

          <Text style={modal.label}>Start time (HH:MM)</Text>
          <TextInput style={modal.input} value={time} onChangeText={setTime} placeholder="09:00" placeholderTextColor="#999" />

          <Text style={modal.label}>Duration (hours)</Text>
          <TextInput style={modal.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="2" placeholderTextColor="#999" />

          <Text style={modal.label}>Slots available</Text>
          <TextInput style={modal.input} value={slots} onChangeText={setSlots} keyboardType="numeric" placeholder="1" placeholderTextColor="#999" />

          <TouchableOpacity style={modal.button} onPress={submit} disabled={saving}>
            <Text style={modal.buttonText}>{saving ? 'Saving…' : 'Add slot'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={modal.cancelButton} onPress={onClose}>
            <Text style={modal.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  monthLabel: { fontSize: 14, fontWeight: '600' },
  monthNav: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  earningsCard: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 20, marginBottom: 24 },
  earningsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  earningsLabel: { fontSize: 11, color: '#888' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff0eb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  liveBadgeText: { fontSize: 10, fontWeight: '600', color: '#ff5a1f' },
  earningsValue: { fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  earningsSub: { fontSize: 12, color: '#888', marginTop: 8 },
  calCard: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16, marginBottom: 24 },
  dayLabels: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  gridCellSelected: { backgroundColor: '#111' },
  gridDay: { fontSize: 13, color: '#111' },
  gridDaySelected: { color: '#fff', fontWeight: '600' },
  dots: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  dayEarnings: { fontSize: 12, color: '#888', marginTop: 2 },
  dayEarningsAmount: { color: '#ff5a1f', fontWeight: '600' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ff5a1f', justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 16 },
  sectionMeta: { fontSize: 10, color: '#888', letterSpacing: 0.5, marginBottom: 8 },
  slotCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1fae5', backgroundColor: '#f0fdf4', borderRadius: 16, padding: 14, gap: 12, marginBottom: 8 },
  bookingCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 14, gap: 12, marginBottom: 8 },
  slotTime: { width: 48 },
  slotTimeText: { fontSize: 13, fontWeight: '600' },
  slotTimeEnd: { fontSize: 11, color: '#888' },
  slotDivider: { width: 1, height: 32, backgroundColor: '#e0e0e0' },
  slotInfo: { flex: 1 },
  slotTitle: { fontSize: 14, fontWeight: '600' },
  slotSub: { fontSize: 11, color: '#888', marginTop: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  bookingAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  bookingAvatarText: { fontSize: 10, fontWeight: '600' },
  bookingAmount: { fontSize: 14, fontWeight: '700' },
  emptyBox: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 24, alignItems: 'center', borderStyle: 'dashed' },
  emptyText: { fontSize: 14, color: '#888' },
  emptySub: { fontSize: 12, color: '#aaa', marginTop: 4 },
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, color: '#111' },
  button: { backgroundColor: '#111', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#888', fontSize: 16 },
})