import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Switch, TextInput, SafeAreaView,
  Dimensions, Animated, PanResponder,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, X, Search,
  Calendar, CalendarDays, LayoutGrid, AlignJustify, Plus, Clock,
  Trash2, SlidersHorizontal, Palmtree, Check,
} from 'lucide-react-native'
import { getCache, setCache } from '@/lib/cache'
import { ProviderNav } from '@/components/ProviderNav'

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window')
const HOUR_H     = 64          // px per hour in time grid
const START_HOUR = 7
const END_HOUR   = 21
const TIME_COL_W = 52
const PAD        = 16

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DOW_LETTER = ['S','M','T','W','T','F','S']

// Day config — used in availability sheet
const DAY_CONFIG = [
  { name: 'Monday',    short: 'Mon', dow: 1, chip: '#e8f0fe', chipText: '#1565c0' },
  { name: 'Tuesday',   short: 'Tue', dow: 2, chip: '#fce4ec', chipText: '#c62828' },
  { name: 'Wednesday', short: 'Wed', dow: 3, chip: '#e8f5e9', chipText: '#2e7d32' },
  { name: 'Thursday',  short: 'Thu', dow: 4, chip: '#fff8e1', chipText: '#e65100' },
  { name: 'Friday',    short: 'Fri', dow: 5, chip: '#ede7f6', chipText: '#4527a0' },
  { name: 'Saturday',  short: 'Sat', dow: 6, chip: '#fbe9e7', chipText: '#bf360c' },
  { name: 'Sunday',    short: 'Sun', dow: 0, chip: '#f5f5f5', chipText: '#616161' },
]

// Muted pastels — calm, not noisy
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

function addDays(ds: string, n: number) {
  const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return toDateStr(d)
}

// Current time as fractional hour (e.g. 9.5 = 9:30 am)
function nowFractionalHour() {
  const n = new Date()
  return n.getHours() + n.getMinutes() / 60
}

type CalendarView = 'schedule' | 'day' | 'week' | 'month'
type DayStatus = 'available' | 'booked' | 'blocked' | 'past'

// ── Day detail sheet ──────────────────────────────────────────────────────────
function DaySheet({ dateStr, status, bookings, hours, saving, onClose, onToggleBlock, onSaveHours, onOpenBooking }: any) {
  const d       = new Date(dateStr + 'T12:00:00')
  const label   = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const isAvail = status === 'available'
  const isBooked= status === 'booked'

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

// ── Week strip ────────────────────────────────────────────────────────────────
function WeekStrip({ weekDates, selectedDate, today, bookingsByDate, onSelectDay, onPrevWeek, onNextWeek }: any) {
  return (
    <View style={ws.wrap}>
      <TouchableOpacity style={ws.navBtn} onPress={onPrevWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronLeft size={16} color="#aaa" strokeWidth={2} />
      </TouchableOpacity>

      {weekDates.map((d: Date, i: number) => {
        const ds      = toDateStr(d)
        const isToday = ds === toDateStr(today)
        const isSel   = ds === selectedDate
        const count   = bookingsByDate.get(ds)?.length ?? 0

        return (
          <TouchableOpacity key={i} style={ws.dayCol} onPress={() => onSelectDay(ds)} activeOpacity={0.6}>
            <Text style={[ws.letter, isSel && ws.letterSel, isToday && !isSel && ws.letterToday]}>
              {DOW_LETTER[i]}
            </Text>
            <View style={[ws.circle, isSel && ws.circleSel, isToday && !isSel && ws.circleToday]}>
              <Text style={[ws.num, isSel && ws.numSel, isToday && !isSel && ws.numToday]}>
                {d.getDate()}
              </Text>
            </View>
            {/* Booking indicator: dot for 1, count for 2+ */}
            {count > 0 && (
              <View style={[ws.countBadge, isSel && ws.countBadgeSel]}>
                {count > 1
                  ? <Text style={[ws.countText, isSel && ws.countTextSel]}>{count}</Text>
                  : <View style={[ws.dot, isSel && ws.dotSel]} />
                }
              </View>
            )}
            {count === 0 && <View style={{ height: 10 }} />}
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity style={ws.navBtn} onPress={onNextWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <ChevronRight size={16} color="#aaa" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

// ── Day context bar ────────────────────────────────────────────────────────────
// One quiet line of operational intelligence below the week strip.
function DayContextBar({ selectedDate, bookingsByDate, hours }: any) {
  const d   = new Date(selectedDate + 'T12:00:00')
  const dow = DOW_FULL[d.getDay()]
  const bks = bookingsByDate.get(selectedDate) ?? []
  const h   = hours.find((x: any) => x.day_of_week === d.getDay() && x.is_active)

  const parts: string[] = []
  if (bks.length === 0) parts.push('No bookings')
  else if (bks.length === 1) parts.push('1 booking')
  else parts.push(`${bks.length} bookings`)
  if (h) parts.push(`${h.start_time} – ${h.end_time}`)

  return (
    <View style={cx.bar}>
      <Text style={cx.text}>{dow}  ·  {parts.join('  ·  ')}</Text>
    </View>
  )
}

// ── View picker ───────────────────────────────────────────────────────────────
const VIEW_OPTIONS: { key: CalendarView; label: string; Icon: any }[] = [
  { key: 'schedule', label: 'Schedule', Icon: AlignJustify },
  { key: 'day',      label: 'Day',      Icon: CalendarDays },
  { key: 'week',     label: 'Week',     Icon: LayoutGrid },
  { key: 'month',    label: 'Month',    Icon: Calendar },
]

function ViewPicker({ current, onSelect, onClose, anim }: any) {
  return (
    <Animated.View style={[vp.wrap, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
      {VIEW_OPTIONS.map(({ key, label, Icon }) => (
        <TouchableOpacity key={key} style={[vp.row, current === key && vp.rowActive]}
          onPress={() => { onSelect(key); onClose() }} activeOpacity={0.7}>
          <Icon size={17} color={current === key ? '#1e88e5' : '#666'} strokeWidth={1.8} />
          <Text style={[vp.label, current === key && vp.labelActive]}>{label}</Text>
          {current === key && <View style={vp.check} />}
        </TouchableOpacity>
      ))}
    </Animated.View>
  )
}

// ── Time grid (Day / Week) ────────────────────────────────────────────────────
function TimeGrid({ view, weekDates, selectedDate, bookingsByDate, today, hours, onEventPress, onDayChange }: any) {
  const scrollRef = useRef<ScrollView>(null)
  const [nowFrac, setNowFrac] = useState(nowFractionalHour)
  const todayStr = toDateStr(today)

  // Update "now" line every minute
  useEffect(() => {
    const id = setInterval(() => setNowFrac(nowFractionalHour()), 60000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to current time (1 hour before now) on mount
  useEffect(() => {
    if (view === 'day') {
      const targetY = Math.max(0, (nowFrac - START_HOUR - 1) * HOUR_H)
      setTimeout(() => scrollRef.current?.scrollTo({ y: targetY, animated: false }), 100)
    }
  }, [view])

  const hourSlots = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const totalH    = hourSlots.length * HOUR_H

  const days: string[] = view === 'week'
    ? weekDates.map((d: Date) => toDateStr(d))
    : [selectedDate]

  const dayColW = view === 'week'
    ? (SCREEN_W - TIME_COL_W - PAD * 2) / 7
    : SCREEN_W - TIME_COL_W - PAD * 2

  // Swipe to change day (day view only)
  const panRef = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => view === 'day' && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 12,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 40) onDayChange(g.dx < 0 ? 1 : -1)
    },
  }))

  function getEventsForDay(ds: string) {
    return (bookingsByDate.get(ds) ?? []).filter((b: any) => b.starts_at)
  }

  function eventPos(b: any) {
    const start  = new Date(b.starts_at)
    const end    = b.ends_at ? new Date(b.ends_at) : new Date(start.getTime() + 3600000)
    const topH   = (start.getHours() - START_HOUR + start.getMinutes() / 60) * HOUR_H
    const height = Math.max((end.getTime() - start.getTime()) / 3600000 * HOUR_H, 28)
    return { top: topH, height }
  }

  // Working hours for a given day
  function getWorkingHours(ds: string) {
    const d = new Date(ds + 'T12:00:00')
    return hours.find((h: any) => h.day_of_week === d.getDay() && h.is_active) ?? null
  }

  const nowTop = (nowFrac - START_HOUR) * HOUR_H

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}
      {...(view === 'day' ? panRef.current.panHandlers : {})}
    >
      {/* Week view column headers */}
      {view === 'week' && (
        <View style={[tg.dayHeaderRow, { paddingLeft: TIME_COL_W + PAD }]}>
          {weekDates.map((d: Date, i: number) => {
            const ds      = toDateStr(d)
            const isToday = ds === todayStr
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
          {hourSlots.map(h => (
            <View key={h} style={[tg.timeRow, { height: HOUR_H }]}>
              <Text style={[tg.timeLabel, h === 12 && tg.timeLabelNoon]}>
                {formatHour(h)}
              </Text>
            </View>
          ))}
        </View>

        {/* Event area */}
        <View style={{ flex: 1, position: 'relative' }}>

          {/* Hour grid lines */}
          {hourSlots.map(h => (
            <View key={h} style={[tg.hourLine, { top: (h - START_HOUR) * HOUR_H }]} />
          ))}

          {/* Day columns */}
          <View style={{ flexDirection: 'row', height: totalH }}>
            {days.map((ds) => {
              const events = getEventsForDay(ds)
              const wh     = getWorkingHours(ds)
              const isToday = ds === todayStr

              // Off-hours zones (before work start, after work end)
              const workStart = wh ? parseFloat(wh.start_time.split(':')[0]) + parseFloat(wh.start_time.split(':')[1]) / 60 : null
              const workEnd   = wh ? parseFloat(wh.end_time.split(':')[0])   + parseFloat(wh.end_time.split(':')[1])   / 60 : null

              return (
                <View key={ds} style={[tg.dayCol, { width: dayColW }]}>

                  {/* Off-hours background — before working hours */}
                  {workStart != null && (
                    <View style={[tg.offHours, {
                      top: 0,
                      height: (workStart - START_HOUR) * HOUR_H,
                    }]} />
                  )}

                  {/* Off-hours background — after working hours */}
                  {workEnd != null && (
                    <View style={[tg.offHours, {
                      top: (workEnd - START_HOUR) * HOUR_H,
                      bottom: 0,
                    }]} />
                  )}

                  {/* Booking events */}
                  {events.map((b: any) => {
                    const { top, height } = eventPos(b)
                    const color = getEventColor(b.id)
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[tg.event, { top, height, backgroundColor: color.bg, borderLeftColor: color.left }]}
                        onPress={() => onEventPress(b)}
                        activeOpacity={0.75}
                      >
                        <Text style={[tg.eventTitle, { color: color.left }]} numberOfLines={1}>
                          {b.service_name ?? b.client_name ?? 'Booking'}
                        </Text>
                        {height > 38 && (
                          <Text style={tg.eventTime} numberOfLines={1}>
                            {formatTime12(b.starts_at)}
                            {b.ends_at ? ` – ${formatTime12(b.ends_at)}` : ''}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}

                  {/* Current time indicator — only on today's column */}
                  {isToday && nowFrac >= START_HOUR && nowFrac <= END_HOUR && (
                    <View style={[tg.nowLine, { top: nowTop }]}>
                      <View style={tg.nowDot} />
                      <View style={tg.nowBar} />
                    </View>
                  )}
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

  for (let i = 0; i < 90; i++) {
    const d  = new Date(now); d.setDate(now.getDate() + i)
    const ds = toDateStr(d)
    const bks = bookingsByDate.get(ds)
    if (bks?.length) entries.push({ ds, bookings: bks })
  }

  if (entries.length === 0) {
    return (
      <View style={sv.empty}>
        <Calendar size={36} color="#e5e7eb" strokeWidth={1.5} />
        <Text style={sv.emptyTitle}>All clear</Text>
        <Text style={sv.emptySub}>No upcoming bookings in the next 90 days</Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      {entries.map(({ ds, bookings }) => {
        const d       = new Date(ds + 'T12:00:00')
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
                <TouchableOpacity key={b.id}
                  style={[sv.card, { borderLeftColor: color.left, backgroundColor: color.bg }]}
                  onPress={() => onEventPress(b)} activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <Text style={[sv.cardTitle, { color: color.left }]}>
                      {b.service_name ?? 'Booking'}
                    </Text>
                    <Text style={sv.cardSub}>
                      {formatTime12(b.starts_at)}
                      {b.ends_at ? ` – ${formatTime12(b.ends_at)}` : ''}
                      {b.client_name ? `  ·  ${b.client_name}` : ''}
                    </Text>
                  </View>
                  <View style={[sv.badge, {
                    backgroundColor: b.status === 'confirmed' ? '#e8f5e9' : '#fff8e1'
                  }]}>
                    <Text style={[sv.badgeText, {
                      color: b.status === 'confirmed' ? '#2e7d32' : '#e65100'
                    }]}>
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
    <View>
      <View style={mo.dowRow}>
        {['S','M','T','W','T','F','S'].map((l, i) => (
          <Text key={i} style={mo.dowText}>{l}</Text>
        ))}
      </View>
      <View style={mo.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={{ width: CELL_W, height: CELL_W }} />
          const ds        = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const status    = getStatus(ds)
          const isSel     = ds === selectedDate
          const isToday   = ds === toDateStr(today)
          const isPast    = status === 'past'
          const isBooked  = status === 'booked'
          const isBlocked = status === 'blocked'
          const count     = bookingsByDate.get(ds)?.length ?? 0

          return (
            <TouchableOpacity key={i} style={mo.cell}
              onPress={() => !isPast && onDayPress(ds)}
              activeOpacity={isPast ? 1 : 0.65} disabled={isPast}>
              <View style={[mo.dayInner, isSel && mo.dayInnerSel, isToday && !isSel && mo.dayInnerToday]}>
                <Text style={[
                  mo.dayNum,
                  isPast     && mo.dayNumPast,
                  isBlocked  && !isSel && mo.dayNumBlocked,
                  isSel      && mo.dayNumSel,
                  isToday    && !isSel && mo.dayNumToday,
                ]}>
                  {day}
                </Text>
              </View>
              {/* Booking dot(s) */}
              {isBooked && count === 1 && <View style={[mo.dot, isSel && mo.dotSel]} />}
              {isBooked && count > 1  && (
                <View style={[mo.countPill, isSel && mo.countPillSel]}>
                  <Text style={[mo.countPillText, isSel && mo.countPillTextSel]}>{count}</Text>
                </View>
              )}
              {isBlocked && !isSel && <View style={mo.blockedLine} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── Availability settings sheet ───────────────────────────────────────────────
function AvailabilitySheet({ visible, onClose, hours, holidays, saving, onToggleDay, onSaveHours, onAddHoliday, onRemoveHoliday }: any) {
  const [editingDow, setEditingDow] = useState<number | null>(null)
  const [editStart, setEditStart]   = useState('')
  const [editEnd, setEditEnd]       = useState('')
  const [addingOff, setAddingOff]   = useState(false)
  const [offLabel, setOffLabel]     = useState('')
  const [offStart, setOffStart]     = useState('')
  const [offEnd, setOffEnd]         = useState('')
  const [savingOff, setSavingOff]   = useState(false)

  function openEdit(dow: number, h: any) {
    setEditStart(h?.start_time ?? '09:00')
    setEditEnd(h?.end_time ?? '17:00')
    setEditingDow(dow)
  }

  async function confirmEdit() {
    if (editingDow === null) return
    await onSaveHours(editingDow, editStart, editEnd)
    setEditingDow(null)
  }

  async function handleAddOff() {
    if (!offStart) return
    setSavingOff(true)
    await onAddHoliday(offLabel || 'Time off', offStart, offEnd || offStart)
    setOffLabel(''); setOffStart(''); setOffEnd('')
    setAddingOff(false)
    setSavingOff(false)
  }

  function formatDateRange(start: string, end: string) {
    const s = new Date(start + 'T12:00:00')
    const e = new Date((end || start) + 'T12:00:00')
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return start === (end || start) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={av.overlay}>
        <TouchableOpacity style={av.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={av.sheet}>
          <View style={av.handle} />

          {/* Sheet header */}
          <View style={av.header}>
            <View style={av.headerIcon}>
              <SlidersHorizontal size={18} color="#1e88e5" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={av.headerTitle}>Availability</Text>
              <Text style={av.headerSub}>Manage your schedule & time off</Text>
            </View>
            <TouchableOpacity style={av.closeBtn} onPress={onClose}>
              <X size={15} color="#888" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

            {/* ── Weekly schedule card ── */}
            <View style={av.sectionLabel}>
              <Text style={av.sectionLabelText}>WEEKLY SCHEDULE</Text>
            </View>

            <View style={av.card}>
              {DAY_CONFIG.map((day, i) => {
                const h      = hours.find((x: any) => x.day_of_week === day.dow)
                const isOn   = h?.is_active ?? false
                const isEdit = editingDow === day.dow
                const isLast = i === DAY_CONFIG.length - 1

                return (
                  <View key={day.dow}>
                    <View style={[av.dayRow, !isLast && av.dayRowBorder]}>
                      {/* Day chip */}
                      <View style={[av.dayChip, { backgroundColor: isOn ? day.chip : '#f5f5f5' }]}>
                        <Text style={[av.dayChipText, { color: isOn ? day.chipText : '#ccc' }]}>
                          {day.short}
                        </Text>
                      </View>

                      {/* Day name + hours */}
                      <View style={{ flex: 1 }}>
                        <Text style={[av.dayName, !isOn && av.dayNameOff]}>{day.name}</Text>
                        {isOn && !isEdit && (
                          <TouchableOpacity onPress={() => openEdit(day.dow, h)} activeOpacity={0.7}>
                            <Text style={av.dayHours}>
                              {h?.start_time ?? '09:00'} – {h?.end_time ?? '17:00'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {!isOn && <Text style={av.dayClosed}>Closed</Text>}
                      </View>

                      {/* Toggle */}
                      {saving && editingDow === day.dow
                        ? <ActivityIndicator size="small" color="#1e88e5" />
                        : <Switch
                            value={isOn}
                            onValueChange={() => onToggleDay(day.dow, h)}
                            trackColor={{ false: '#e9e9eb', true: '#1e88e5' }}
                            thumbColor="#fff"
                            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                          />
                      }
                    </View>

                    {/* Inline time editor */}
                    {isEdit && (
                      <View style={av.timeEditor}>
                        <View style={av.timeEditorInner}>
                          <View style={av.timeField}>
                            <Text style={av.timeFieldLabel}>Opens</Text>
                            <TextInput
                              style={av.timeFieldInput}
                              value={editStart}
                              onChangeText={setEditStart}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                              autoFocus
                              selectTextOnFocus
                            />
                          </View>
                          <View style={av.timeFieldDivider} />
                          <View style={av.timeField}>
                            <Text style={av.timeFieldLabel}>Closes</Text>
                            <TextInput
                              style={av.timeFieldInput}
                              value={editEnd}
                              onChangeText={setEditEnd}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                              selectTextOnFocus
                            />
                          </View>
                          <TouchableOpacity style={av.timeConfirmBtn} onPress={confirmEdit}>
                            <Check size={16} color="#fff" strokeWidth={2.5} />
                          </TouchableOpacity>
                          <TouchableOpacity style={av.timeCancelBtn} onPress={() => setEditingDow(null)}>
                            <X size={14} color="#aaa" strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>

            {/* ── Time off & holidays ── */}
            <View style={av.sectionLabel}>
              <Text style={av.sectionLabelText}>TIME OFF & HOLIDAYS</Text>
            </View>

            {holidays.length === 0 && !addingOff && (
              <View style={av.emptyHolidays}>
                <Palmtree size={22} color="#e0e0e0" strokeWidth={1.5} />
                <Text style={av.emptyHolidaysText}>No time off scheduled</Text>
              </View>
            )}

            {holidays.map((h: any, i: number) => (
              <View key={h.id ?? i} style={av.holidayCard}>
                <View style={av.holidayIconWrap}>
                  <Palmtree size={16} color="#fb8c00" strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={av.holidayLabel}>{h.label ?? 'Time off'}</Text>
                  <Text style={av.holidayRange}>
                    {formatDateRange(h.date, h.end_date)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={av.holidayDeleteBtn}
                  onPress={() => onRemoveHoliday(h)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={14} color="#ccc" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add time off form */}
            {addingOff ? (
              <View style={av.addOffCard}>
                <Text style={av.addOffTitle}>New time off</Text>

                <View style={av.addOffField}>
                  <Text style={av.addOffLabel}>Label</Text>
                  <TextInput
                    style={av.addOffInput}
                    value={offLabel}
                    onChangeText={setOffLabel}
                    placeholder="e.g. Vacation, Holiday"
                    placeholderTextColor="#d1d5db"
                    autoFocus
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[av.addOffField, { flex: 1 }]}>
                    <Text style={av.addOffLabel}>From</Text>
                    <TextInput
                      style={av.addOffInput}
                      value={offStart}
                      onChangeText={setOffStart}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#d1d5db"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                  <View style={[av.addOffField, { flex: 1 }]}>
                    <Text style={av.addOffLabel}>To</Text>
                    <TextInput
                      style={av.addOffInput}
                      value={offEnd}
                      onChangeText={setOffEnd}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#d1d5db"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                </View>

                <View style={av.addOffActions}>
                  <TouchableOpacity style={av.addOffCancel} onPress={() => { setAddingOff(false); setOffLabel(''); setOffStart(''); setOffEnd('') }}>
                    <Text style={av.addOffCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[av.addOffSave, (!offStart || savingOff) && { opacity: 0.5 }]}
                    onPress={handleAddOff} disabled={!offStart || savingOff}>
                    {savingOff
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={av.addOffSaveText}>Save</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={av.addOffTrigger} onPress={() => setAddingOff(true)} activeOpacity={0.7}>
                <View style={av.addOffTriggerIcon}>
                  <Plus size={14} color="#1e88e5" strokeWidth={2.5} />
                </View>
                <Text style={av.addOffTriggerText}>Add time off</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProviderCalendar() {
  const router = useRouter()
  const today  = new Date(); today.setHours(0,0,0,0)
  const todayStr = toDateStr(today)

  const [view, setView]                     = useState<CalendarView>('day')
  const [showViewPicker, setShowViewPicker] = useState(false)
  const [selectedDate, setSelectedDate]     = useState(todayStr)
  const [weekRef, setWeekRef]               = useState(today)
  const [monthCursor, setMonthCursor]       = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [sheetDate, setSheetDate]           = useState<string | null>(null)
  const [showFab, setShowFab]               = useState(false)
  const [showSettings, setShowSettings]     = useState(false)

  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [blocked, setBlocked]             = useState<Set<string>>(new Set())
  const [recurring, setRecurring]         = useState<Set<number>>(new Set())
  const [holidays, setHolidays]           = useState<any[]>([])
  const [hours, setHours]                 = useState<any[]>([])
  const [bookingsByDate, setBookingsByDate] = useState<Map<string, any[]>>(new Map())

  // Animation values
  const viewPickerAnim = useRef(new Animated.Value(0)).current
  const fabSecondaryAnim = useRef(new Animated.Value(0)).current

  // Animate view picker in/out
  useEffect(() => {
    Animated.spring(viewPickerAnim, {
      toValue: showViewPicker ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start()
  }, [showViewPicker])

  // Animate FAB secondary action
  useEffect(() => {
    Animated.spring(fabSecondaryAnim, {
      toValue: showFab ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 9,
    }).start()
  }, [showFab])

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
      const ds       = b.starts_at.slice(0, 10)
      const enriched = { ...b, client_name: nameMap.get(b.customer_id) ?? 'Client' }
      byDate.set(ds, [...(byDate.get(ds) ?? []), enriched])
    })
    setBookingsByDate(byDate)

    const { data: hoursData } = await supabase
      .from('provider_hours').select('*').eq('provider_id', user.id).order('day_of_week')
    if (!hoursData || hoursData.length === 0) {
      const defaults = [1,2,3,4,5].map(d => ({
        provider_id: user.id, day_of_week: d,
        start_time: '09:00', end_time: '17:00', is_active: true,
      }))
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

  async function toggleDayActive(dayOfWeek: number, h: any) {
    if (!userId) return
    setSaving(true)
    const newActive = !(h?.is_active ?? false)
    await supabase.from('provider_hours').upsert(
      { provider_id: userId, day_of_week: dayOfWeek, start_time: h?.start_time ?? '09:00', end_time: h?.end_time ?? '17:00', is_active: newActive },
      { onConflict: 'provider_id,day_of_week' }
    )
    setHours(prev => {
      const exists = prev.find(x => x.day_of_week === dayOfWeek)
      if (exists) return prev.map(x => x.day_of_week === dayOfWeek ? { ...x, is_active: newActive } : x)
      return [...prev, { provider_id: userId, day_of_week: dayOfWeek, start_time: '09:00', end_time: '17:00', is_active: newActive }]
    })
    setSaving(false)
  }

  async function addHoliday(label: string, startDate: string, endDate: string) {
    if (!userId) return
    const row = { provider_id: userId, date: startDate, end_date: endDate, label, status: 'blocked', is_recurring: false }
    const { data } = await supabase.from('provider_availability').insert(row).select().single()
    if (data) setHolidays(prev => [...prev, data])
  }

  async function removeHoliday(h: any) {
    if (!userId) return
    if (h.id) {
      await supabase.from('provider_availability').delete().eq('id', h.id)
    } else {
      await supabase.from('provider_availability').delete().eq('provider_id', userId).eq('date', h.date)
    }
    setHolidays(prev => prev.filter(x => x !== h))
  }

  async function saveHours(dayOfWeek: number, startTime: string, endTime: string) {
    if (!userId) return
    setSaving(true)
    await supabase.from('provider_hours').upsert(
      { provider_id: userId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_active: true },
      { onConflict: 'provider_id,day_of_week' }
    )
    setHours(prev => prev.map(h => h.day_of_week === dayOfWeek
      ? { ...h, start_time: startTime, end_time: endTime, is_active: true } : h))
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

  const isOnToday = selectedDate === todayStr

  function jumpToToday() {
    setSelectedDate(todayStr)
    setWeekRef(today)
    setMonthCursor({ year: today.getFullYear(), month: today.getMonth() })
  }

  function handlePrevWeek() {
    const d = new Date(weekRef); d.setDate(d.getDate() - 7); setWeekRef(d)
  }
  function handleNextWeek() {
    const d = new Date(weekRef); d.setDate(d.getDate() + 7); setWeekRef(d)
  }

  function handleSelectDay(ds: string) {
    setSelectedDate(ds)
    setWeekRef(new Date(ds + 'T12:00:00'))
    if (view === 'month') setSheetDate(ds)
  }

  function handleDayChange(direction: number) {
    const next = addDays(selectedDate, direction)
    setSelectedDate(next)
    setWeekRef(new Date(next + 'T12:00:00'))
  }

  function handleEventPress(b: any) {
    setSheetDate(b.starts_at.slice(0, 10))
  }

  const sheetStatus   = sheetDate ? getDayStatus(sheetDate) : null
  const sheetBookings = sheetDate ? (bookingsByDate.get(sheetDate) ?? []) : []
  const sheetHours    = sheetDate ? getHoursForDate(sheetDate) : null

  const currentViewOption = VIEW_OPTIONS.find(v => v.key === view)!

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator color="#1e88e5" size="small" />
    </View>
  )

  return (
    <View style={s.root}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />

      {/* ── Header ── */}
      <View style={s.header}>
        {/* Today jump — visible only when not on today */}
        {!isOnToday ? (
          <TouchableOpacity style={s.todayPill} onPress={jumpToToday} activeOpacity={0.7}>
            <Text style={s.todayPillText}>Today</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}

        <Text style={s.headerTitle}>{headerTitle}</Text>

        <TouchableOpacity style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Search size={19} color="#444" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Week strip (non-month views) ── */}
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

      {/* ── Day context bar (day view only) ── */}
      {view === 'day' && (
        <DayContextBar
          selectedDate={selectedDate}
          bookingsByDate={bookingsByDate}
          hours={hours}
        />
      )}

      {/* ── View toggle bar ── */}
      <View style={s.viewBar}>
        <TouchableOpacity
          style={s.viewBtn}
          onPress={() => setShowViewPicker(p => !p)}
          activeOpacity={0.75}
        >
          {showViewPicker
            ? <X size={14} color="#1e88e5" strokeWidth={2.5} />
            : <currentViewOption.Icon size={14} color="#1e88e5" strokeWidth={1.8} />
          }
          <Text style={s.viewBtnLabel}>{currentViewOption.label}</Text>
          <ChevronRight
            size={12} color="#1e88e5" strokeWidth={2.5}
            style={{ transform: [{ rotate: showViewPicker ? '-90deg' : '90deg' }] }}
          />
        </TouchableOpacity>

        {view === 'month' && (
          <View style={s.monthNav}>
            <TouchableOpacity style={s.navBtn} onPress={() => {
              let { year, month } = monthCursor
              month--; if (month < 0) { month = 11; year-- }
              setMonthCursor({ year, month })
            }}>
              <ChevronLeft size={15} color="#444" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={s.navBtn} onPress={() => {
              let { year, month } = monthCursor
              month++; if (month > 11) { month = 0; year++ }
              setMonthCursor({ year, month })
            }}>
              <ChevronRight size={15} color="#444" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── View picker dropdown (animated) ── */}
      {showViewPicker && (
        <ViewPicker
          current={view}
          onSelect={(v: CalendarView) => { setView(v); if (v === 'month') setMonthCursor({ year: today.getFullYear(), month: today.getMonth() }) }}
          onClose={() => setShowViewPicker(false)}
          anim={viewPickerAnim}
        />
      )}

      {/* ── Main content ── */}
      <View style={s.content}>
        {(view === 'day' || view === 'week') && (
          <TimeGrid
            view={view}
            weekDates={weekDates}
            selectedDate={selectedDate}
            bookingsByDate={bookingsByDate}
            today={today}
            hours={hours}
            onEventPress={handleEventPress}
            onDayChange={handleDayChange}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView bookingsByDate={bookingsByDate} today={today} onEventPress={handleEventPress} />
        )}
        {view === 'month' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 120 }}>
            {[0, 1, 2, 3].map(offset => {
              let m = monthCursor.month + offset, y = monthCursor.year
              while (m > 11) { m -= 12; y++ }
              return (
                <View key={`${y}-${m}`} style={{ marginBottom: 36 }}>
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

      {/* ── FAB ── */}
      <View style={s.fabWrap}>
        {/* Secondary: block/manage selected day */}
        <Animated.View style={{
          opacity: fabSecondaryAnim,
          transform: [{
            translateY: fabSecondaryAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
          }],
          marginBottom: 10,
        }}
          pointerEvents={showFab ? 'auto' : 'none'}
        >
          <TouchableOpacity style={[s.fab, s.fabSecondary]}
            onPress={() => { setShowFab(false); setShowSettings(true) }}
            activeOpacity={0.85}>
            <Clock size={19} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[s.fab, showFab ? s.fabClose : s.fabPrimary]}
          onPress={() => setShowFab(p => !p)}
          activeOpacity={0.85}
        >
          <Animated.View style={{
            transform: [{
              rotate: fabSecondaryAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }),
            }],
          }}>
            <Plus size={22} color="#fff" strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ProviderNav />

      {/* ── Availability settings sheet ── */}
      <AvailabilitySheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        hours={hours}
        holidays={holidays}
        saving={saving}
        onToggleDay={toggleDayActive}
        onSaveHours={saveHours}
        onAddHoliday={addHoliday}
        onRemoveHoliday={removeHoliday}
      />

      {/* ── Day sheet ── */}
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
          onOpenBooking={(id: string) => {
            setSheetDate(null)
            router.push(`/provider/booking-detail?id=${id}` as any)
          }}
        />
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', letterSpacing: -0.4, flex: 1, textAlign: 'center' },
  iconBtn:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  // "Today" pill — appears when navigated away from today
  todayPill:     { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#e8f0fe', borderRadius: 20 },
  todayPillText: { fontSize: 12, fontWeight: '700', color: '#1e88e5', letterSpacing: 0.1 },

  viewBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  viewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#f0f7ff', borderRadius: 20 },
  viewBtnLabel:{ fontSize: 12, fontWeight: '600', color: '#1e88e5' },
  monthNav:    { flexDirection: 'row', gap: 6 },
  navBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },

  fabWrap:     { position: 'absolute', right: 20, bottom: 92, alignItems: 'center' },
  fab:         {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  fabPrimary:  { backgroundColor: '#1e88e5' },
  fabSecondary:{ backgroundColor: '#546e7a' },
  fabClose:    { backgroundColor: '#90a4ae' },
})

// Day context bar
const cx = StyleSheet.create({
  bar:  { paddingHorizontal: PAD + 4, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f5f5f5' },
  text: { fontSize: 11, color: '#aaa', fontWeight: '500', letterSpacing: 0.1 },
})

// Week strip
const ws = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 2, paddingTop: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  navBtn:  { width: 24, height: 52, alignItems: 'center', justifyContent: 'center' },
  dayCol:  { flex: 1, alignItems: 'center', gap: 3 },

  letter:      { fontSize: 10, fontWeight: '600', color: '#bbb', letterSpacing: 0.3 },
  letterSel:   { color: '#1e88e5' },
  letterToday: { color: '#1e88e5' },

  circle:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  circleSel:   { backgroundColor: '#1e88e5' },
  circleToday: { backgroundColor: '#e8f0fe' },

  num:       { fontSize: 13, fontWeight: '500', color: '#333' },
  numSel:    { color: '#fff', fontWeight: '700' },
  numToday:  { color: '#1e88e5', fontWeight: '700' },

  countBadge:    { minWidth: 14, height: 10, alignItems: 'center', justifyContent: 'center' },
  countBadgeSel: {},
  dot:           { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1e88e5' },
  dotSel:        { backgroundColor: 'rgba(255,255,255,0.7)' },
  countText:     { fontSize: 9, fontWeight: '700', color: '#1e88e5' },
  countTextSel:  { color: 'rgba(255,255,255,0.8)' },
})

// View picker
const vp = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 124, right: PAD,
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 6, width: 172,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
    zIndex: 200,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#f0f0f0',
  },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  rowActive: { backgroundColor: '#f5f9ff' },
  label:     { fontSize: 14, fontWeight: '500', color: '#333', flex: 1 },
  labelActive: { color: '#1e88e5', fontWeight: '600' },
  check:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1e88e5' },
})

// Time grid
const tg = StyleSheet.create({
  dayHeaderRow:  { flexDirection: 'row', paddingBottom: 4, paddingLeft: TIME_COL_W + PAD, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  dayHeaderCell: { alignItems: 'center', gap: 3 },
  dayHeaderLetter: { fontSize: 9, fontWeight: '600', color: '#bbb', letterSpacing: 0.3 },
  dayHeaderCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayHeaderCircleToday: { backgroundColor: '#1e88e5' },
  dayHeaderNum:  { fontSize: 11, fontWeight: '500', color: '#555' },
  dayHeaderNumToday: { color: '#fff', fontWeight: '700' },

  grid:    { flexDirection: 'row', paddingLeft: PAD },
  timeCol: { width: TIME_COL_W },
  timeRow: { justifyContent: 'flex-start', paddingTop: 3 },
  timeLabel: { fontSize: 10, color: '#bbb', fontWeight: '500', textAlign: 'right', paddingRight: 10, letterSpacing: 0.1 },
  timeLabelNoon: { color: '#e53935', fontWeight: '700', fontSize: 10 },

  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#efefef' },

  dayCol: { position: 'relative', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#f5f5f5' },

  // Off-hours zone — whisper gray, not visible noise
  offHours: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.018)' },

  event: {
    position: 'absolute', left: 3, right: 3,
    borderRadius: 7, borderLeftWidth: 3,
    paddingHorizontal: 7, paddingVertical: 4,
    overflow: 'hidden',
  },
  eventTitle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  eventTime:  { fontSize: 9.5, color: '#666', marginTop: 1 },

  // Current time line
  nowLine: { position: 'absolute', left: -1, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  nowDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e53935', marginLeft: -3 },
  nowBar:  { flex: 1, height: 1.5, backgroundColor: '#e53935', opacity: 0.8 },
})

// Schedule view
const sv = StyleSheet.create({
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#ccc' },
  emptySub:   { fontSize: 13, color: '#ddd', textAlign: 'center', paddingHorizontal: 40 },

  group:   { paddingHorizontal: PAD, paddingTop: 22 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },

  dateBadge:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  dateBadgeToday: { backgroundColor: '#1e88e5' },
  dateNum:        { fontSize: 15, fontWeight: '700', color: '#333' },
  dateNumToday:   { color: '#fff' },
  dateDow:        { fontSize: 14, fontWeight: '700', color: '#111' },
  dateDowToday:   { color: '#1e88e5' },
  dateMon:        { fontSize: 11, color: '#aaa', marginTop: 1 },

  card:      { flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderLeftWidth: 3, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600' },
  cardSub:   { fontSize: 11, color: '#888', marginTop: 2 },
  badge:     { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
})

// Month grid
const mo = StyleSheet.create({
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 10, letterSpacing: -0.3 },
  dowRow:     { flexDirection: 'row', marginBottom: 2 },
  dowText:    { width: CELL_W, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#ccc', letterSpacing: 0.3 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:       { width: CELL_W, height: CELL_W * 1.05, alignItems: 'center', justifyContent: 'center' },

  dayInner:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayInnerSel:   { backgroundColor: '#1e88e5' },
  dayInnerToday: { borderWidth: 1.5, borderColor: '#1e88e5' },

  dayNum:        { fontSize: 14, fontWeight: '400', color: '#222' },
  dayNumPast:    { color: '#ddd', fontWeight: '300' },
  dayNumBlocked: { color: '#ccc' },
  dayNumSel:     { color: '#fff', fontWeight: '700' },
  dayNumToday:   { color: '#1e88e5', fontWeight: '700' },

  // Single booking dot
  dot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1e88e5', marginTop: 2 },
  dotSel: { backgroundColor: 'rgba(255,255,255,0.7)' },

  // Multi-booking count pill
  countPill:     { paddingHorizontal: 4, paddingVertical: 0.5, backgroundColor: '#e8f0fe', borderRadius: 6, marginTop: 1 },
  countPillSel:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  countPillText: { fontSize: 8, fontWeight: '700', color: '#1e88e5' },
  countPillTextSel: { color: '#fff' },

  blockedLine: { position: 'absolute', width: 18, height: 1, backgroundColor: '#e0e0e0', borderRadius: 1, transform: [{ rotate: '-45deg' }] },
})

// Day sheet
const sh = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 8, maxHeight: '82%' },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginTop: 12, marginBottom: 22 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  dateLabel:{ fontSize: 19, fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  statusRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  statusDot:{ width: 6, height: 6, borderRadius: 3 },
  statusText:{ fontSize: 12, color: '#888' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },

  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 11, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle:    { fontSize: 15, fontWeight: '600', color: '#111' },
  rowSub:      { fontSize: 12, color: '#bbb', marginTop: 2 },

  hoursDisplay:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa', borderRadius: 12, padding: 14 },
  hoursTime:      { fontSize: 16, fontWeight: '600', color: '#111' },
  hoursEdit:      { fontSize: 12, color: '#aaa', fontWeight: '500' },
  hoursEditWrap:  { gap: 12 },
  hoursInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hoursInputWrap: { flex: 1, backgroundColor: '#fafafa', borderRadius: 12, padding: 12 },
  hoursInputLabel:{ fontSize: 10, color: '#bbb', marginBottom: 4, fontWeight: '600', letterSpacing: 0.5 },
  hoursInput:     { fontSize: 17, fontWeight: '600', color: '#111' },
  hoursSep:       { fontSize: 16, color: '#e0e0e0' },
  saveHoursBtn:   { backgroundColor: '#1e88e5', borderRadius: 14, padding: 14, alignItems: 'center' },
  saveHoursBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  bookingCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 14, padding: 14 },
  bookingAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { fontSize: 12, fontWeight: '700', color: '#555' },
  bookingName:       { fontSize: 14, fontWeight: '600', color: '#111' },
  bookingTime:       { fontSize: 11, color: '#aaa', marginTop: 2 },
  bookingStatus:     { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  bookingStatusText: { fontSize: 10, fontWeight: '700' },
})

// ── Availability sheet styles ─────────────────────────────────────────────────
const av = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#f8f8f8',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 10,
    maxHeight: '92%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 12, marginBottom: 18 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: 18, fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  headerSub:  { fontSize: 12, color: '#aaa', marginTop: 2 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#efefef', alignItems: 'center', justifyContent: 'center' },

  sectionLabel:     { marginBottom: 8, marginTop: 4, paddingLeft: 4 },
  sectionLabelText: { fontSize: 11, fontWeight: '700', color: '#bbb', letterSpacing: 0.8 },

  // Weekly schedule card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  dayRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  dayRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f3f3' },

  dayChip:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  dayName:    { fontSize: 15, fontWeight: '600', color: '#111' },
  dayNameOff: { color: '#ccc' },
  dayHours:   { fontSize: 12, color: '#1e88e5', marginTop: 2, fontWeight: '500' },
  dayClosed:  { fontSize: 12, color: '#d1d5db', marginTop: 2 },

  // Inline time editor
  timeEditor: { backgroundColor: '#f8fbff', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eef3fb' },
  timeEditorInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeField:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e8f0fe' },
  timeFieldLabel: { fontSize: 9, fontWeight: '700', color: '#1e88e5', letterSpacing: 0.5, marginBottom: 2 },
  timeFieldInput: { fontSize: 16, fontWeight: '600', color: '#111' },
  timeFieldDivider: { width: 12, height: 1, backgroundColor: '#d1d5db' },
  timeConfirmBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e88e5', alignItems: 'center', justifyContent: 'center' },
  timeCancelBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },

  // Holiday cards
  emptyHolidays:    { alignItems: 'center', gap: 6, paddingVertical: 20, marginBottom: 12 },
  emptyHolidaysText:{ fontSize: 13, color: '#d1d5db' },

  holidayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  holidayIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff8e1', alignItems: 'center', justifyContent: 'center' },
  holidayLabel:    { fontSize: 14, fontWeight: '600', color: '#111' },
  holidayRange:    { fontSize: 12, color: '#aaa', marginTop: 2 },
  holidayDeleteBtn:{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center' },

  // Add time off trigger
  addOffTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: '#e8f0fe', borderStyle: 'dashed',
    marginBottom: 24,
  },
  addOffTriggerIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  addOffTriggerText: { fontSize: 14, fontWeight: '600', color: '#1e88e5' },

  // Add time off form card
  addOffCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  addOffTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 16 },
  addOffField: { marginBottom: 12 },
  addOffLabel: { fontSize: 10, fontWeight: '700', color: '#bbb', letterSpacing: 0.6, marginBottom: 6 },
  addOffInput: {
    backgroundColor: '#f8f8f8', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontWeight: '500', color: '#111',
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  addOffActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addOffCancel:  { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  addOffCancelText: { fontSize: 14, fontWeight: '600', color: '#999' },
  addOffSave:    { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#1e88e5', alignItems: 'center', justifyContent: 'center' },
  addOffSaveText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})
