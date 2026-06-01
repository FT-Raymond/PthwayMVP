import { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Switch, TextInput, SafeAreaView,
  Dimensions, Animated,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, X, Menu, Search,
  Calendar, CalendarDays, LayoutGrid, AlignJustify, Plus, Clock,
} from 'lucide-react-native'
import { getCache, setCache } from '@/lib/cache'
import { ProviderNav } from '@/components/ProviderNav'

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window')
const HOUR_H     = 64
const START_HOUR = 7
const END_HOUR   = 21
const TIME_COL_W = 52
const PAD        = 16

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW_LETTER = ['S','M','T','W','T','F','S']
const DOW_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const EVENT_COLORS = [
  { bg: '#fce4ec', left: '#e91e63' },
  { bg: '#ede7f6', left: '#7c3aed' },
  { bg: '#e8f5e9', left: '#43a047' },
  { bg: '#fff8e1', left: '#fb8c00' },
  { bg: '#e3f2fd', left: '#1e88e5' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekDates(ref: Date): Date[] {
  const sun = new Date(ref)
  sun.setDate(ref.getDate() - ref.getDay())
  sun.setHours(0,0,0,0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun); d.setDate(sun.getDate() + i); return d
  })
}

function getEventColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length]
}

function formatHour(h: number) {
  if (h === 0)  return '12 am'
  if (h === 12) return 'Noon'
  return h < 12 ? `${h} am` : `${h - 12} pm`
}

function formatTime12(iso: string) {
  const d = new Date(iso)
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0')
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'pm' : 'am'}`
}

function initials(n: string) {
  return (n ?? '?').split(' ').map((p: string) => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase()
}

function monFirstDow(d: Date) { return (d.getDay() + 6) % 7 }

type CalendarView = 'schedule' | 'day' | 'week' | 'month'
type DayStatus = 'available' | 'booked' | 'blocked' | 'past'

// ── Day detail sheet ──────────────────────────────────────────────────────────
function DaySheet({ dateStr, status, bookings, hours, saving, onClose, onToggleBlock, onSaveHours, onOpenBooking }: any) {
  const d     = new Date(dateStr + 'T12:00:00')
  const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const isAvail  = status === 'available'
  const isBooked = status === 'booked'

  const [editingHours, setEditingHours] = useState(false)
  const [startT, setStartT] = useState(hours?.start_time ?? '09:00')
  const [endT, setEndT]     = useState(hours?.end_time   ?? '17:00')

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.overlay}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <View style={sh.header}>
            <View>
              <Text style={sh.dateLabel}>{label}</Text>
              <View style={sh.statusRow}>
                <View style={[sh.statusDot, {
                  backgroundColor: isBooked ? '#fb8c00' : isAvail ? '#43a047' : '#d1d5db'
                }]} />
                <Text style={sh.statusText}>
                  {isBooked ? 'Booked' : isAvail ? 'Available' : 'Blocked'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={sh.closeBtn} onPress={onClose}>
              <X size={16} color="#111" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            {!isBooked && (
              <View style={sh.section}>
                <View style={sh.row}>
                  <View>
                    <Text style={sh.rowTitle}>Available for bookings</Text>
                    <Text style={sh.rowSub}>Clients can book this day</Text>
                  </View>
                  {saving
                    ? <ActivityIndicator size="small" color="#111" />
                    : <Switch
                        value={isAvail}
                        onValueChange={() => onToggleBlock(dateStr)}
                        trackColor={{ false: '#e5e7eb', true: '#1e88e5' }}
                        thumbColor="#fff"
                      />
                  }
                </View>
              </View>
            )}

            {hours && isAvail && (
              <View style={sh.section}>
                <Text style={sh.sectionTitle}>Working hours</Text>
                {editingHours ? (
                  <View style={sh.hoursEditWrap}>
                    <View style={sh.hoursInputRow}>
                      <View style={sh.hoursInputWrap}>
                        <Text style={sh.hoursInputLabel}>Start</Text>
                        <TextInput style={sh.hoursInput} value={startT} onChangeText={setStartT}
                          placeholder="09:00" placeholderTextColor="#bbb"
                          keyboardType="numbers-and-punctuation" maxLength={5} autoFocus />
                      </View>
                      <Text style={sh.hoursSep}>–</Text>
                      <View style={sh.hoursInputWrap}>
                        <Text style={sh.hoursInputLabel}>End</Text>
                        <TextInput style={sh.hoursInput} value={endT} onChangeText={setEndT}
                          placeholder="17:00" placeholderTextColor="#bbb"
                          keyboardType="numbers-and-punctuation" maxLength={5} />
                      </View>
                    </View>
                    <TouchableOpacity style={sh.saveHoursBtn}
                      onPress={() => { onSaveHours(d.getDay(), startT, endT); setEditingHours(false) }}>
                      <Text style={sh.saveHoursBtnText}>Save hours</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={sh.hoursDisplay} onPress={() => setEditingHours(true)} activeOpacity={0.7}>
                    <Text style={sh.hoursTime}>{hours.start_time} – {hours.end_time}</Text>
                    <Text style={sh.hoursEdit}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {bookings.length > 0 && (
              <View style={sh.section}>
                <Text style={sh.sectionTitle}>{bookings.length} booking{bookings.length > 1 ? 's' : ''}</Text>
                <View style={{ gap: 10 }}>
                  {bookings.map((b: any) => (
                    <TouchableOpacity key={b.id} style={sh.bookingCard}
                      onPress={() => onOpenBooking(b.id)} activeOpacity={0.75}>
                      <View style={sh.bookingAvatar}>
                        <Text style={sh.bookingAvatarText}>{initials(b.client_name ?? 'C')}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={sh.bookingName}>{b.client_name ?? 'Client'}</Text>
                        <Text style={sh.bookingTime}>
                          {formatTime12(b.starts_at)}{b.service_name ? ` · ${b.service_name}` : ''}
                        </Text>
                      </View>
                      <View style={[sh.bookingStatus, {
                        backgroundColor: b.status === 'confirmed' ? '#e8f5e9' : '#fff8e1'
                      }]}>
                        <Text style={[sh.bookingStatusText, {
                          color: b.status === 'confirmed' ? '#2e7d32' : '#e65100'
                        }]}>
                          {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </Text>
                      </View>
                      <ChevronRight size={14} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ── Week strip ─────────────────────────────────────────────────────────────────
function WeekStrip({ weekDates, selectedDate, today, bookingsByDate, onSelectDay, onPrevWeek, onNextWeek }: any) {
  return (
    <View style={ws.wrap}>
      <TouchableOpacity style={ws.navBtn} onPress={onPrevWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronLeft size={16} color="#666" strokeWidth={2} />
      </TouchableOpacity>

      {weekDates.map((d: Date, i: number) => {
        const ds       = toDateStr(d)
        const isToday  = ds === toDateStr(today)
        const isSel    = ds === selectedDate
        const hasEvent = bookingsByDate.has(ds)

        return (
          <TouchableOpacity key={i} style={ws.dayCol} onPress={() => onSelectDay(ds)} activeOpacity={0.7}>
            <Text style={[ws.letter, isSel && ws.letterSel]}>{DOW_LETTER[i]}</Text>
            <View style={[ws.circle, isSel && ws.circleSel, isToday && !isSel && ws.circleToday]}>
              <Text style={[ws.num, isSel && ws.numSel, isToday && !isSel && ws.numToday]}>
                {d.getDate()}
              </Text>
            </View>
            {hasEvent && <View style={[ws.dot, isSel && ws.dotSel]} />}
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity style={ws.navBtn} onPress={onNextWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronRight size={16} color="#666" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

// ── View picker ────────────────────────────────────────────────────────────────
const VIEW_OPTIONS: { key: CalendarView; label: string; Icon: any }[] = [
  { key: 'schedule', label: 'Schedule', Icon: AlignJustify },
  { key: 'day',      label: 'Day',      Icon: CalendarDays },
  { key: 'week',     label: 'Week',     Icon: LayoutGrid },
  { key: 'month',    label: 'Month',    Icon: Calendar },
]

function ViewPicker({ current, onSelect, onClose }: any) {
  return (
    <View style={vp.wrap}>
      {VIEW_OPTIONS.map(({ key, label, Icon }) => (
        <TouchableOpacity key={key} style={[vp.row, current === key && vp.rowActive]}
          onPress={() => { onSelect(key); onClose() }} activeOpacity={0.7}>
          <Icon size={17} color={current === key ? '#1e88e5' : '#555'} strokeWidth={1.8} />
          <Text style={[vp.label, current === key && vp.labelActive]}>{label}</Text>
          {current === key && <View style={vp.activeDot} />}
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── Time grid (Day / Week views) ───────────────────────────────────────────────
function TimeGrid({ view, weekDates, selectedDate, bookingsByDate, today, onEventPress }: any) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const totalH = hours.length * HOUR_H

  // For day view: just selected date; for week view: all 7 days
  const days: string[] = view === 'week'
    ? weekDates.map((d: Date) => toDateStr(d))
    : [selectedDate]

  const dayColW = view === 'week'
    ? (SCREEN_W - TIME_COL_W - PAD * 2) / 7
    : SCREEN_W - TIME_COL_W - PAD * 2

  function getEventsForDay(ds: string) {
    return (bookingsByDate.get(ds) ?? []).filter((b: any) => b.starts_at)
  }

  function eventStyle(b: any) {
    const start = new Date(b.starts_at)
    const end   = b.ends_at ? new Date(b.ends_at) : new Date(start.getTime() + 60 * 60 * 1000)
    const topH  = (start.getHours() - START_HOUR + start.getMinutes() / 60) * HOUR_H
    const h     = Math.max((end.getTime() - start.getTime()) / (60000 * 60) * HOUR_H, 28)
    return { top: topH, height: h }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Day headers for week view */}
      {view === 'week' && (
        <View style={[tg.dayHeaderRow, { paddingLeft: TIME_COL_W }]}>
          {weekDates.map((d: Date, i: number) => {
            const ds     = toDateStr(d)
            const isToday = ds === toDateStr(today)
            const isSel   = ds === selectedDate
            return (
              <View key={i} style={[tg.dayHeaderCell, { width: dayColW }]}>
                <Text style={tg.dayHeaderLetter}>{DOW_LETTER[i]}</Text>
                <View style={[tg.dayHeaderCircle, isToday && tg.dayHeaderCircleToday]}>
                  <Text style={[tg.dayHeaderNum, isToday && tg.dayHeaderNumToday]}>{d.getDate()}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      <View style={[tg.grid, { height: totalH }]}>
        {/* Time labels */}
        <View style={tg.timeCol}>
          {hours.map(h => (
            <View key={h} style={[tg.timeRow, { height: HOUR_H }]}>
              <Text style={[tg.timeLabel, h === 12 && tg.timeLabelNoon]}>
                {formatHour(h)}
              </Text>
            </View>
          ))}
        </View>

        {/* Horizontal hour lines + events */}
        <View style={[tg.dayArea, { flex: 1 }]}>
          {/* Hour lines */}
          {hours.map(h => (
            <View key={h} style={[tg.hourLine, { top: (h - START_HOUR) * HOUR_H }]} />
          ))}

          {/* Day columns */}
          <View style={{ flexDirection: 'row', flex: 1, height: totalH }}>
            {days.map((ds, di) => {
              const events = getEventsForDay(ds)
              return (
                <View key={ds} style={[tg.dayCol, { width: dayColW }]}>
                  {events.map((b: any) => {
                    const { top, height } = eventStyle(b)
                    const color = getEventColor(b.id)
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[tg.event, { top, height, backgroundColor: color.bg, borderLeftColor: color.left }]}
                        onPress={() => onEventPress(b)}
                        activeOpacity={0.8}
                      >
                        <Text style={[tg.eventTitle, { color: color.left }]} numberOfLines={1}>
                          {b.service_name ?? b.client_name ?? 'Booking'}
                        </Text>
                        {height > 36 && (
                          <Text style={tg.eventTime} numberOfLines={1}>
                            {formatTime12(b.starts_at)}
                            {b.ends_at ? ` - ${formatTime12(b.ends_at)}` : ''}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ── Schedule view ─────────────────────────────────────────────────────────────
function ScheduleView({ bookingsByDate, today, onEventPress }: any) {
  const entries: { ds: string; bookings: any[] }[] = []
  const now = new Date(); now.setHours(0,0,0,0)

  // Gather next 90 days with bookings
  for (let i = 0; i < 90; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i)
    const ds = toDateStr(d)
    const bks = bookingsByDate.get(ds)
    if (bks && bks.length > 0) entries.push({ ds, bookings: bks })
  }

  if (entries.length === 0) {
    return (
      <View style={sv.empty}>
        <Calendar size={40} color="#d1d5db" strokeWidth={1.5} />
        <Text style={sv.emptyText}>No upcoming bookings</Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      {entries.map(({ ds, bookings }) => {
        const d = new Date(ds + 'T12:00:00')
        const isToday = ds === toDateStr(today)
        return (
          <View key={ds} style={sv.group}>
            <View style={sv.dateRow}>
              <View style={[sv.dateBadge, isToday && sv.dateBadgeToday]}>
                <Text style={[sv.dateNum, isToday && sv.dateNumToday]}>{d.getDate()}</Text>
              </View>
              <View>
                <Text style={[sv.dateDow, isToday && sv.dateDowToday]}>
                  {isToday ? 'Today' : DOW_FULL[d.getDay()]}
                </Text>
                <Text style={sv.dateMon}>{MONTHS[d.getMonth()]} {d.getFullYear()}</Text>
              </View>
            </View>

            {bookings.map((b: any) => {
              const color = getEventColor(b.id)
              return (
                <TouchableOpacity key={b.id} style={[sv.card, { borderLeftColor: color.left, backgroundColor: color.bg }]}
                  onPress={() => onEventPress(b)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={[sv.cardTitle, { color: color.left }]}>
                      {b.service_name ?? 'Booking'}
                    </Text>
                    <Text style={sv.cardSub}>
                      {formatTime12(b.starts_at)}{b.ends_at ? ` – ${formatTime12(b.ends_at)}` : ''}
                      {b.client_name ? `  ·  ${b.client_name}` : ''}
                    </Text>
                  </View>
                  <View style={[sv.badge, { backgroundColor: b.status === 'confirmed' ? '#e8f5e9' : '#fff8e1' }]}>
                    <Text style={[sv.badgeText, { color: b.status === 'confirmed' ? '#2e7d32' : '#e65100' }]}>
                      {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )
      })}
    </ScrollView>
  )
}

// ── Month grid ────────────────────────────────────────────────────────────────
const CELL_W = (SCREEN_W - PAD * 2) / 7

function MonthGrid({ year, month, today, selectedDate, bookingsByDate, blocked, recurring, holidays, onDayPress }: any) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow    = new Date(year, month, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function getStatus(ds: string): DayStatus {
    const d = new Date(ds + 'T12:00:00')
    if (d < today) return 'past'
    const isHoliday = holidays.some((h: any) => ds >= h.date && ds <= (h.end_date ?? h.date))
    if (isHoliday || blocked.has(ds) || recurring.has(monFirstDow(d))) return 'blocked'
    if (bookingsByDate.has(ds)) return 'booked'
    return 'available'
  }

  return (
    <View style={mo.wrap}>
      {/* DOW headers */}
      <View style={mo.dowRow}>
        {['S','M','T','W','T','F','S'].map((l, i) => (
          <Text key={i} style={mo.dowText}>{l}</Text>
        ))}
      </View>

      <View style={mo.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={{ width: CELL_W, height: CELL_W }} />
          const ds       = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const status   = getStatus(ds)
          const isSel    = ds === selectedDate
          const isToday  = ds === toDateStr(today)
          const isPast   = status === 'past'
          const isBooked = status === 'booked'
          const isBlocked = status === 'blocked'

          return (
            <TouchableOpacity key={i} style={mo.cell}
              onPress={() => !isPast && onDayPress(ds)}
              activeOpacity={isPast ? 1 : 0.7} disabled={isPast}>
              <View style={[mo.dayInner, isSel && mo.dayInnerSel, isToday && !isSel && mo.dayInnerToday]}>
                <Text style={[
                  mo.dayNum,
                  isPast    && mo.dayNumPast,
                  isBlocked && !isSel && mo.dayNumBlocked,
                  isSel     && mo.dayNumSel,
                  isToday   && !isSel && mo.dayNumToday,
                ]}>
                  {day}
                </Text>
              </View>
              {isBooked && <View style={[mo.dot, isSel && mo.dotSel]} />}
              {isBlocked && !isSel && <View style={mo.blockedLine} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProviderCalendar() {
  const router = useRouter()
  const today  = new Date(); today.setHours(0,0,0,0)

  const [view, setView]                 = useState<CalendarView>('day')
  const [showViewPicker, setShowViewPicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateStr(today))
  const [weekRef, setWeekRef]           = useState(today)
  const [monthCursor, setMonthCursor]   = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [sheetDate, setSheetDate]       = useState<string | null>(null)
  const [showFab, setShowFab]           = useState(false)

  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [blocked, setBlocked]       = useState<Set<string>>(new Set())
  const [recurring, setRecurring]   = useState<Set<number>>(new Set())
  const [holidays, setHolidays]     = useState<any[]>([])
  const [hours, setHours]           = useState<any[]>([])
  const [bookingsByDate, setBookingsByDate] = useState<Map<string, any[]>>(new Map())

  useFocusEffect(useCallback(() => {
    const c = getCache<any>('calendar:data')
    if (c) {
      setBlocked(new Set(c.blocked))
      setRecurring(new Set(c.recurring))
      setHolidays(c.holidays)
      setHours(c.hours)
      setBookingsByDate(new Map(c.bookingsByDate))
      setLoading(false)
    }
    loadData()
  }, []))

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: avail } = await supabase.from('provider_availability').select('*').eq('provider_id', user.id)
    const blockedSet   = new Set<string>()
    const recurringSet = new Set<number>()
    const holidayList: any[] = []
    ;(avail ?? []).forEach((a: any) => {
      if (a.status === 'blocked') {
        if (a.label) holidayList.push(a)
        else if (a.date) blockedSet.add(a.date)
        if (a.is_recurring && a.day_of_week != null) recurringSet.add((a.day_of_week + 6) % 7)
      }
    })
    setBlocked(blockedSet); setRecurring(recurringSet); setHolidays(holidayList)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id,customer_id,starts_at,ends_at,status,service_name')
      .eq('provider_id', user.id)
      .neq('status', 'cancelled')
      .order('starts_at')

    const custIds = Array.from(new Set((bookings ?? []).map((b: any) => b.customer_id)))
    const nameMap = new Map<string, string>()
    if (custIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,full_name').in('id', custIds)
      ;(profiles ?? []).forEach((p: any) => nameMap.set(p.id, p.full_name ?? 'Client'))
    }
    const byDate = new Map<string, any[]>()
    ;(bookings ?? []).forEach((b: any) => {
      const ds      = b.starts_at.slice(0, 10)
      const enriched = { ...b, client_name: nameMap.get(b.customer_id) ?? 'Client' }
      byDate.set(ds, [...(byDate.get(ds) ?? []), enriched])
    })
    setBookingsByDate(byDate)

    const { data: hoursData } = await supabase.from('provider_hours').select('*').eq('provider_id', user.id).order('day_of_week')
    if (!hoursData || hoursData.length === 0) {
      const defaults = [1,2,3,4,5].map(d => ({ provider_id: user.id, day_of_week: d, start_time: '09:00', end_time: '17:00', is_active: true }))
      await supabase.from('provider_hours').upsert(defaults)
      setHours(Array.from({ length: 7 }, (_, i) => defaults.find(d => d.day_of_week === i) ?? { day_of_week: i, is_active: false }))
    } else {
      const existing = new Map(hoursData.map((h: any) => [h.day_of_week, h]))
      setHours(Array.from({ length: 7 }, (_, i) => existing.get(i) ?? { day_of_week: i, is_active: false }))
    }

    setCache('calendar:data', {
      blocked: Array.from(blockedSet),
      recurring: Array.from(recurringSet),
      holidays: holidayList,
      hours: hoursData ?? [],
      bookingsByDate: Array.from(byDate.entries()),
    })
    setLoading(false)
  }

  async function toggleBlock(dateStr: string) {
    if (!userId) return
    setSaving(true)
    if (blocked.has(dateStr)) {
      await supabase.from('provider_availability').delete().eq('provider_id', userId).eq('date', dateStr)
      setBlocked(prev => { const n = new Set(prev); n.delete(dateStr); return n })
    } else {
      await supabase.from('provider_availability').upsert(
        { provider_id: userId, date: dateStr, status: 'blocked', is_recurring: false },
        { onConflict: 'provider_id,date' }
      )
      setBlocked(prev => new Set([...prev, dateStr]))
    }
    setSaving(false)
  }

  async function saveHours(dayOfWeek: number, startTime: string, endTime: string) {
    if (!userId) return
    setSaving(true)
    await supabase.from('provider_hours').upsert(
      { provider_id: userId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_active: true },
      { onConflict: 'provider_id,day_of_week' }
    )
    setHours(prev => prev.map(h => h.day_of_week === dayOfWeek ? { ...h, start_time: startTime, end_time: endTime, is_active: true } : h))
    setSaving(false)
  }

  function getDayStatus(ds: string): DayStatus {
    const d = new Date(ds + 'T12:00:00')
    if (d < today) return 'past'
    const isHoliday = holidays.some(h => ds >= h.date && ds <= (h.end_date ?? h.date))
    if (isHoliday || blocked.has(ds) || recurring.has(monFirstDow(d))) return 'blocked'
    if (bookingsByDate.has(ds)) return 'booked'
    return 'available'
  }

  function getHoursForDate(ds: string) {
    const d = new Date(ds + 'T12:00:00')
    return hours.find(h => h.day_of_week === d.getDay() && h.is_active) ?? null
  }

  const weekDates = getWeekDates(weekRef)

  // Header title
  const headerTitle = (() => {
    if (view === 'month') return `${MONTHS[monthCursor.month]} ${monthCursor.year}`
    if (view === 'week') {
      const first = weekDates[0], last = weekDates[6]
      if (first.getMonth() === last.getMonth())
        return `${MONTHS[first.getMonth()]} ${first.getFullYear()}`
      return `${MONTHS[first.getMonth()].slice(0,3)} – ${MONTHS[last.getMonth()].slice(0,3)} ${last.getFullYear()}`
    }
    const d = new Date(selectedDate + 'T12:00:00')
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  })()

  function handlePrevWeek() {
    const d = new Date(weekRef); d.setDate(d.getDate() - 7); setWeekRef(d)
  }
  function handleNextWeek() {
    const d = new Date(weekRef); d.setDate(d.getDate() + 7); setWeekRef(d)
  }
  function handleSelectDay(ds: string) {
    setSelectedDate(ds)
    // Ensure week strip follows selected day
    setWeekRef(new Date(ds + 'T12:00:00'))
    if (view === 'month') {
      setSheetDate(ds)
    }
  }
  function handleEventPress(b: any) {
    const ds = b.starts_at.slice(0, 10)
    setSheetDate(ds)
  }

  const sheetStatus   = sheetDate ? getDayStatus(sheetDate) : null
  const sheetBookings = sheetDate ? (bookingsByDate.get(sheetDate) ?? []) : []
  const sheetHours    = sheetDate ? getHoursForDate(sheetDate) : null

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator color="#1e88e5" />
    </View>
  )

  const currentViewOption = VIEW_OPTIONS.find(v => v.key === view)!

  return (
    <View style={s.root}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Menu size={22} color="#333" strokeWidth={1.8} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>{headerTitle}</Text>

        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Search size={20} color="#333" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week strip — shown for schedule / day / week views */}
      {view !== 'month' && (
        <WeekStrip
          weekDates={weekDates}
          selectedDate={selectedDate}
          today={today}
          bookingsByDate={bookingsByDate}
          onSelectDay={handleSelectDay}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
        />
      )}

      {/* View toggle bar */}
      <View style={s.viewBar}>
        {/* View picker button */}
        <TouchableOpacity style={s.viewBtn} onPress={() => setShowViewPicker(p => !p)} activeOpacity={0.8}>
          {showViewPicker
            ? <X size={16} color="#1e88e5" strokeWidth={2.5} />
            : <currentViewOption.Icon size={16} color="#1e88e5" strokeWidth={1.8} />
          }
          <Text style={s.viewBtnLabel}>{showViewPicker ? 'Close' : currentViewOption.label}</Text>
          {!showViewPicker && <ChevronRight size={13} color="#1e88e5" strokeWidth={2} style={{ transform: [{ rotate: '90deg' }] }} />}
        </TouchableOpacity>

        {/* Month nav for month view */}
        {view === 'month' && (
          <View style={s.monthNav}>
            <TouchableOpacity style={s.navBtn} onPress={() => {
              let { year, month } = monthCursor
              month--; if (month < 0) { month = 11; year-- }
              setMonthCursor({ year, month })
            }}>
              <ChevronLeft size={16} color="#333" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={s.navBtn} onPress={() => {
              let { year, month } = monthCursor
              month++; if (month > 11) { month = 0; year++ }
              setMonthCursor({ year, month })
            }}>
              <ChevronRight size={16} color="#333" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* View picker dropdown */}
      {showViewPicker && (
        <ViewPicker
          current={view}
          onSelect={setView}
          onClose={() => setShowViewPicker(false)}
        />
      )}

      {/* Main content */}
      <View style={s.content}>
        {view === 'day' && (
          <TimeGrid
            view="day"
            weekDates={weekDates}
            selectedDate={selectedDate}
            bookingsByDate={bookingsByDate}
            today={today}
            onEventPress={handleEventPress}
          />
        )}
        {view === 'week' && (
          <TimeGrid
            view="week"
            weekDates={weekDates}
            selectedDate={selectedDate}
            bookingsByDate={bookingsByDate}
            today={today}
            onEventPress={handleEventPress}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView
            bookingsByDate={bookingsByDate}
            today={today}
            onEventPress={handleEventPress}
          />
        )}
        {view === 'month' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 120 }}>
            {[0, 1, 2, 3].map(offset => {
              let m = monthCursor.month + offset, y = monthCursor.year
              while (m > 11) { m -= 12; y++ }
              return (
                <View key={`${y}-${m}`} style={{ marginBottom: 32 }}>
                  <Text style={mo.monthLabel}>{MONTHS[m]} {y}</Text>
                  <MonthGrid
                    year={y} month={m} today={today}
                    selectedDate={selectedDate}
                    bookingsByDate={bookingsByDate}
                    blocked={blocked} recurring={recurring} holidays={holidays}
                    onDayPress={handleSelectDay}
                  />
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>

      {/* FAB */}
      <View style={s.fabWrap}>
        {showFab && (
          <>
            <TouchableOpacity style={[s.fab, s.fabSecondary]}
              onPress={() => { setShowFab(false); if (selectedDate) setSheetDate(selectedDate) }}
              activeOpacity={0.85}>
              <Clock size={20} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <View style={{ height: 10 }} />
          </>
        )}
        <TouchableOpacity
          style={[s.fab, s.fabPrimary, showFab && s.fabClose]}
          onPress={() => setShowFab(p => !p)}
          activeOpacity={0.85}
        >
          {showFab
            ? <X size={22} color="#fff" strokeWidth={2.5} />
            : <Plus size={22} color="#fff" strokeWidth={2.5} />
          }
        </TouchableOpacity>
      </View>

      <ProviderNav />

      {/* Day sheet */}
      {sheetDate && sheetStatus && (
        <DaySheet
          dateStr={sheetDate}
          status={sheetStatus}
          bookings={sheetBookings}
          hours={sheetHours}
          saving={saving}
          onClose={() => setSheetDate(null)}
          onToggleBlock={async (ds: string) => { await toggleBlock(ds); setSheetDate(null) }}
          onSaveHours={saveHours}
          onOpenBooking={(id: string) => { setSheetDate(null); router.push(`/provider/booking-detail?id=${id}` as any) }}
        />
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 4 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  viewBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  viewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#e8f0fe', borderRadius: 20 },
  viewBtnLabel:{ fontSize: 13, fontWeight: '600', color: '#1e88e5' },
  monthNav:    { flexDirection: 'row', gap: 4 },
  navBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },

  fabWrap:     { position: 'absolute', right: 20, bottom: 90, alignItems: 'center' },
  fab:         { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  fabPrimary:  { backgroundColor: '#1e88e5' },
  fabSecondary:{ backgroundColor: '#e65100' },
  fabClose:    { backgroundColor: '#555' },
})

// Week strip
const ws = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  navBtn:  { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  dayCol:  { flex: 1, alignItems: 'center', gap: 4 },
  letter:  { fontSize: 11, fontWeight: '600', color: '#9ca3af', letterSpacing: 0.2 },
  letterSel: { color: '#1e88e5' },
  circle:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circleSel:   { backgroundColor: '#1e88e5' },
  circleToday: { backgroundColor: '#e8f0fe' },
  num:         { fontSize: 14, fontWeight: '500', color: '#333' },
  numSel:      { color: '#fff', fontWeight: '700' },
  numToday:    { color: '#1e88e5', fontWeight: '700' },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1e88e5' },
  dotSel:      { backgroundColor: '#fff' },
})

// View picker
const vp = StyleSheet.create({
  wrap:       { position: 'absolute', top: 120, right: PAD, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8, width: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, zIndex: 100 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowActive:  { backgroundColor: '#f0f7ff' },
  label:      { fontSize: 15, fontWeight: '500', color: '#333', flex: 1 },
  labelActive:{ color: '#1e88e5', fontWeight: '600' },
  activeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1e88e5' },
})

// Time grid
const tg = StyleSheet.create({
  dayHeaderRow:   { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  dayHeaderCell:  { alignItems: 'center', gap: 2 },
  dayHeaderLetter:{ fontSize: 10, fontWeight: '600', color: '#9ca3af' },
  dayHeaderCircle:{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayHeaderCircleToday: { backgroundColor: '#1e88e5' },
  dayHeaderNum:   { fontSize: 12, fontWeight: '500', color: '#333' },
  dayHeaderNumToday: { color: '#fff', fontWeight: '700' },

  grid:    { flexDirection: 'row', paddingHorizontal: PAD },
  timeCol: { width: TIME_COL_W },
  timeRow: { justifyContent: 'flex-start', paddingTop: 2 },
  timeLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', textAlign: 'right', paddingRight: 10 },
  timeLabelNoon: { color: '#e53935', fontWeight: '700' },

  dayArea: { position: 'relative' },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },

  dayCol: { position: 'relative', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#f0f0f0' },

  event: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  eventTitle: { fontSize: 12, fontWeight: '600' },
  eventTime:  { fontSize: 10, color: '#666', marginTop: 1 },
})

// Schedule view
const sv = StyleSheet.create({
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#9ca3af' },

  group:    { paddingHorizontal: PAD, paddingTop: 20 },
  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  dateBadge:{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  dateBadgeToday: { backgroundColor: '#1e88e5' },
  dateNum:  { fontSize: 16, fontWeight: '700', color: '#333' },
  dateNumToday: { color: '#fff' },
  dateDow:  { fontSize: 14, fontWeight: '700', color: '#111' },
  dateDowToday: { color: '#1e88e5' },
  dateMon:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  card:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderLeftWidth: 3, padding: 12, marginBottom: 8 },
  cardTitle:{ fontSize: 14, fontWeight: '600' },
  cardSub:  { fontSize: 12, color: '#666', marginTop: 2 },
  badge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText:{ fontSize: 11, fontWeight: '700' },
})

// Month grid
const mo = StyleSheet.create({
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 10, letterSpacing: -0.3 },
  dowRow:  { flexDirection: 'row', marginBottom: 4 },
  dowText: { width: CELL_W, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#9ca3af' },
  grid:    { flexDirection: 'row', flexWrap: 'wrap' },
  cell:    { width: CELL_W, height: CELL_W, alignItems: 'center', justifyContent: 'center' },
  dayInner:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayInnerSel:   { backgroundColor: '#1e88e5' },
  dayInnerToday: { borderWidth: 1.5, borderColor: '#1e88e5' },
  dayNum:        { fontSize: 14, fontWeight: '500', color: '#111' },
  dayNumPast:    { color: '#d1d5db', fontWeight: '400' },
  dayNumBlocked: { color: '#9ca3af' },
  dayNumSel:     { color: '#fff', fontWeight: '700' },
  dayNumToday:   { color: '#1e88e5', fontWeight: '700' },
  dot:           { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1e88e5', marginTop: 1 },
  dotSel:        { backgroundColor: '#fff' },
  blockedLine:   { position: 'absolute', width: 20, height: 1.5, backgroundColor: '#d1d5db', borderRadius: 1, transform: [{ rotate: '-45deg' }] },
})

// Day sheet
const sh = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 8, maxHeight: '80%' },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  dateLabel:{ fontSize: 20, fontWeight: '700', color: '#111', letterSpacing: -0.4 },
  statusRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot:{ width: 7, height: 7, borderRadius: 4 },
  statusText:{ fontSize: 13, color: '#666' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },

  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle:    { fontSize: 16, fontWeight: '600', color: '#111' },
  rowSub:      { fontSize: 13, color: '#9ca3af', marginTop: 2 },

  hoursDisplay:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 14, padding: 16 },
  hoursTime:      { fontSize: 17, fontWeight: '600', color: '#111' },
  hoursEdit:      { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  hoursEditWrap:  { gap: 12 },
  hoursInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hoursInputWrap: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 },
  hoursInputLabel:{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: '500' },
  hoursInput:     { fontSize: 18, fontWeight: '600', color: '#111' },
  hoursSep:       { fontSize: 18, color: '#d1d5db' },
  saveHoursBtn:   { backgroundColor: '#1e88e5', borderRadius: 14, padding: 14, alignItems: 'center' },
  saveHoursBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  bookingCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 14, padding: 14 },
  bookingAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  bookingName:       { fontSize: 14, fontWeight: '600', color: '#111' },
  bookingTime:       { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  bookingStatus:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  bookingStatusText: { fontSize: 11, fontWeight: '700' },
})
