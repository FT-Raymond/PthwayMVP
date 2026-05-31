import { useState, useEffect, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Modal, ActivityIndicator, FlatList,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import {
  ChevronRight, Check, Calendar, MapPin, Info,
  Repeat, Star, X, MoreVertical, Clock,
} from 'lucide-react-native'

const { width } = Dimensions.get('window')

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatTimeRange(startIso: string, endIso?: string) {
  const fmt = (d: Date) => {
    let hh = d.getHours()
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ap = hh >= 12 ? 'PM' : 'AM'
    hh = hh % 12 || 12
    return `${hh}:${mm} ${ap}`
  }
  const start = fmt(new Date(startIso))
  if (!endIso) return start
  return `${start} – ${fmt(new Date(endIso))}`
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Awaiting confirmation', bg: '#fff9e6', text: '#d97706' },
  confirmed: { label: 'Confirmed',             bg: '#e7f7ef', text: '#059669' },
  cancelled: { label: 'Cancelled',             bg: '#fff0f0', text: '#dc2626' },
  completed: { label: 'Completed',             bg: '#f0f0f0', text: '#666'    },
}

function DayPill({ n, active, isToday }: { n: number; active?: boolean; isToday?: boolean }) {
  if (active) return (
    <View style={styles.dayPillActive}>
      <Text style={styles.dayPillActiveText}>{n}</Text>
    </View>
  )
  return (
    <View style={[styles.dayPill, isToday && styles.dayPillToday]}>
      <Text style={[styles.dayPillText, isToday && styles.dayPillTodayText]}>{n}</Text>
    </View>
  )
}

function BookingRow({ booking, onOpen }: { booking: any; onOpen: () => void }) {
  const d = new Date(booking.starts_at)
  const monthLabel = MONTHS[d.getMonth()].slice(0, 3)
  const dayLabel = String(d.getDate()).padStart(2, '0')
  const initials = (booking.service_name ?? '?').slice(0, 2).toUpperCase()
  const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending

  return (
    <TouchableOpacity style={styles.bookingRow} onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.bookingRowInner}>
        <View style={styles.dateCol}>
          <Text style={styles.dateMonth}>{monthLabel}</Text>
          <Text style={styles.dateDay}>{dayLabel}</Text>
        </View>
        <View style={styles.dateDivider} />
        <View style={styles.serviceIcon}>
          <Text style={styles.serviceIconText}>{initials}</Text>
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingName}>{booking.service_name ?? 'Appointment'}</Text>
          <Text style={styles.bookingTime}>
            {new Date(booking.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {/* Status pill */}
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: sc.text }]} />
            <Text style={[styles.statusPillText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  )
}

function BookingModal({ item, onClose }: { item: any; onClose: () => void }) {
  if (!item) return null
  const d = new Date(item.starts_at)
  const dateLabel = `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  const initials = (item.service_name ?? '?').slice(0, 2).toUpperCase()
  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending
  const answers: any[] = item.booking_answers ?? []

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <TouchableOpacity style={modal.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={modal.sheet}>
          <View style={modal.handle} />

          <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false}>
            {/* Status row */}
            <View style={modal.statusRow}>
              <View style={[modal.statusBadge, { backgroundColor: sc.bg }]}>
                <View style={[modal.statusDot, { backgroundColor: sc.text }]} />
                <Text style={[modal.statusText, { color: sc.text }]}>{sc.label}</Text>
              </View>
              <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
                <X size={14} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Service title */}
            <View style={modal.titleRow}>
              <View style={modal.titleIcon}>
                <Text style={modal.titleIconText}>{initials}</Text>
              </View>
              <View style={modal.titleInfo}>
                <Text style={modal.titleText}>{item.service_name ?? 'Appointment'}</Text>
                <Text style={modal.titleSub}>Booked via Pthway</Text>
              </View>
            </View>

            {/* Provider */}
            <View style={modal.providerCard}>
              <View style={modal.providerAvatar}>
                <Text style={modal.providerAvatarText}>{(item.providerName ?? 'P').slice(0, 1)}</Text>
              </View>
              <View style={modal.providerInfo}>
                <Text style={modal.providerLabel}>Your provider</Text>
                <Text style={modal.providerName}>{item.providerName ?? 'Provider'}</Text>
              </View>
              <ChevronRight size={16} color="#ccc" />
            </View>

            {/* Date & time */}
            <View style={modal.detailRow}>
              <View style={modal.detailIcon}>
                <Calendar size={16} color="#ff6b35" />
              </View>
              <View style={modal.detailInfo}>
                <Text style={modal.detailLabel}>Date & time</Text>
                <Text style={modal.detailValue}>{dateLabel}</Text>
                <Text style={modal.detailValue}>{formatTimeRange(item.starts_at, item.ends_at)}</Text>
              </View>
            </View>

            <View style={modal.divider} />

            {/* Booking answers */}
            {answers.filter((a: any) => a.answer).length > 0 && (
              <>
                <Text style={modal.answersTitle}>Your booking answers</Text>
                {answers.filter((a: any) => a.answer).map((a: any, i: number) => (
                  <View key={i} style={modal.answerRow}>
                    <Text style={modal.answerQ}>{a.question}</Text>
                    <Text style={modal.answerA}>{String(a.answer)}</Text>
                  </View>
                ))}
                <View style={modal.divider} />
              </>
            )}

            {/* Pending message */}
            {item.status === 'pending' && (
              <View style={modal.pendingNote}>
                <Clock size={14} color="#d97706" />
                <Text style={modal.pendingNoteText}>
                  Waiting for the provider to confirm your booking.
                </Text>
              </View>
            )}

            {/* Confirmed message */}
            {item.status === 'confirmed' && (
              <View style={modal.confirmedNote}>
                <Check size={14} color="#059669" strokeWidth={3} />
                <Text style={modal.confirmedNoteText}>
                  Your booking is confirmed. See you there!
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export default function ClientBookings() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const dates = useMemo(() => {
    const arr: Date[] = []
    const start = new Date(today)
    start.setDate(start.getDate() - 14)
    for (let i = 0; i < 60; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [today])

  const [selected, setSelected] = useState<Date>(today)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState<any>(null)
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    fetchBookings()
    setupRealtime()
  }, [])

  async function fetchBookings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('starts_at')

    if (!data) { setLoading(false); return }

    const ids = Array.from(new Set(data.map((b: any) => b.provider_id)))
    const names = new Map<string, string>()
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', ids)
      ;(profiles ?? []).forEach((p: any) => names.set(p.id, p.full_name ?? 'Provider'))
    }

    setBookings(data.map((b: any) => ({
      ...b,
      providerName: names.get(b.provider_id) ?? 'Provider',
    })))
    setLoading(false)
  }

  function setupRealtime() {
    // Listen for status changes on customer's bookings
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const channel = supabase
        .channel('customer-bookings-rt')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${user.id}`,
        }, (payload) => {
          // Update booking status in state
          setBookings(prev => prev.map(b =>
            b.id === payload.new.id ? { ...b, ...payload.new } : b
          ))
          // Update open modal if showing this booking
          setOpenItem((prev: any) => {
            if (prev?.id === payload.new.id) return { ...prev, ...payload.new }
            return prev
          })
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }

  const dayBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = new Date(b.starts_at)
      d.setHours(0, 0, 0, 0)
      return sameDay(d, selected)
    })
  }, [bookings, selected])

  const todayIndex = dates.findIndex(d => sameDay(d, today))

  useEffect(() => {
    setTimeout(() => {
      flatRef.current?.scrollToIndex({ index: todayIndex, animated: false, viewPosition: 0.5 })
    }, 100)
  }, [])

  const headerLabel = sameDay(selected, today)
    ? 'Today'
    : `${MONTHS[selected.getMonth()].slice(0, 3)} ${selected.getDate()}`

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>{headerLabel}</Text>
              <Text style={styles.headerSub}>
                {dayBookings.length === 0
                  ? 'Nothing booked'
                  : `${dayBookings.length} ${dayBookings.length === 1 ? 'booking' : 'bookings'}`}
              </Text>
            </View>
            <MoreVertical size={20} color="rgba(255,255,255,0.4)" />
          </View>

          <FlatList
            ref={flatRef}
            data={dates}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.dateStrip}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item: d }) => {
              const isSel = sameDay(d, selected)
              const isToday = sameDay(d, today)
              return (
                <TouchableOpacity style={styles.dayBtn} onPress={() => setSelected(d)} activeOpacity={0.7}>
                  <Text style={[styles.dowText, isSel && styles.dowTextActive]}>{DOW[d.getDay()]}</Text>
                  <DayPill n={d.getDate()} active={isSel} isToday={isToday && !isSel} />
                </TouchableOpacity>
              )
            }}
          />
        </View>

        <View style={styles.bookingsList}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#ff6b35" />
            </View>
          ) : dayBookings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nothing booked for this day.</Text>
            </View>
          ) : (
            dayBookings.map((b) => (
              <BookingRow key={b.id} booking={b} onOpen={() => setOpenItem(b)} />
            ))
          )}
        </View>
      </ScrollView>

      {openItem && <BookingModal item={openItem} onClose={() => setOpenItem(null)} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100, gap: 12 },
  headerCard: { backgroundColor: '#1c1c1c', borderRadius: 24, padding: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '500', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 18, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  dateStrip: { gap: 8, paddingHorizontal: 4 },
  dayBtn: { width: 44, alignItems: 'center', gap: 6 },
  dowText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dowTextActive: { color: '#fff' },
  dayPill: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  dayPillToday: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  dayPillActive: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff6b35', alignItems: 'center', justifyContent: 'center' },
  dayPillText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  dayPillTodayText: { color: '#fff' },
  dayPillActiveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  bookingsList: { gap: 10 },
  emptyBox: { borderRadius: 20, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0', padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#aaa' },
  bookingRow: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden' },
  bookingRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 16 },
  dateCol: { width: 44, alignItems: 'center' },
  dateMonth: { fontSize: 11, color: '#aaa' },
  dateDay: { fontSize: 20, fontWeight: '500', color: '#444' },
  dateDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,107,53,0.1)', alignItems: 'center', justifyContent: 'center' },
  serviceIconText: { fontSize: 12, fontWeight: '700', color: '#ff6b35' },
  bookingInfo: { flex: 1 },
  bookingName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  bookingTime: { fontSize: 12, color: '#aaa', marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: '600' },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%' },
  handle: { width: 40, height: 6, borderRadius: 3, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  scroll: { paddingHorizontal: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '700' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  titleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ff6b35', alignItems: 'center', justifyContent: 'center' },
  titleIconText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  titleInfo: { flex: 1 },
  titleText: { fontSize: 18, fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  titleSub: { fontSize: 12, color: '#ff6b35', marginTop: 2 },
  providerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 16, padding: 12, marginBottom: 12 },
  providerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  providerAvatarText: { fontSize: 16, fontWeight: '700', color: '#666' },
  providerInfo: { flex: 1 },
  providerLabel: { fontSize: 11, color: '#aaa' },
  providerName: { fontSize: 14, fontWeight: '700', color: '#111' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  detailIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,107,53,0.1)', alignItems: 'center', justifyContent: 'center' },
  detailInfo: {},
  detailLabel: { fontSize: 11, color: '#aaa' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginBottom: 14, marginTop: 2 },
  answersTitle: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 10 },
  answerRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  answerQ: { fontSize: 11, color: '#aaa', marginBottom: 3 },
  answerA: { fontSize: 14, fontWeight: '500', color: '#111' },
  pendingNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff9e6', borderRadius: 14, padding: 14, marginBottom: 16 },
  pendingNoteText: { flex: 1, fontSize: 13, color: '#d97706', lineHeight: 18 },
  confirmedNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e7f7ef', borderRadius: 14, padding: 14, marginBottom: 16 },
  confirmedNoteText: { flex: 1, fontSize: 13, color: '#059669', lineHeight: 18 },
})
