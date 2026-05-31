// app/book/[providerId]/calendar.tsx
// Uses get-available-slots edge function — single source of truth

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatSlot(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}

// Get timezone offset in minutes from UTC (e.g. BST = -60)
function getTZOffset(): number {
  return new Date().getTimezoneOffset()
}

export default function BookingCalendar() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    providerId: string
    serviceId: string
    serviceName: string
    servicePrice: string
    serviceDuration: string
    answers: string
  }>()

  const today = new Date(); today.setHours(0,0,0,0)
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slots, setSlots] = useState<any[]>([])
  const [slotsReason, setSlotsReason] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingMonth, setLoadingMonth] = useState(false)

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const firstDay = new Date(cursor.year, cursor.month, 1).getDay()

  // Pre-check which days in the month have any availability
  // We do this by checking service_availability for the days of week in this month
  useEffect(() => {
    checkMonthAvailability()
  }, [cursor.month, cursor.year])

  async function checkMonthAvailability() {
    setLoadingMonth(true)
    try {
      // Check which days of week this service is available
      const { data: serviceAvail } = await supabase
        .from('service_availability')
        .select('day_of_week')
        .eq('opportunity_id', params.serviceId)
        .eq('is_active', true)

      // Also check provider hours as fallback
      const { data: providerHours } = await supabase
        .from('provider_hours')
        .select('day_of_week')
        .eq('provider_id', params.providerId)
        .eq('is_active', true)

      const activeDOWs = new Set<number>()
      if (serviceAvail && serviceAvail.length > 0) {
        serviceAvail.forEach((r: any) => activeDOWs.add(r.day_of_week))
      } else if (providerHours) {
        providerHours.forEach((r: any) => activeDOWs.add(r.day_of_week))
      }

      // Check provider-level overrides/blocks for this month
      const monthStart = `${cursor.year}-${String(cursor.month+1).padStart(2,'0')}-01`
      const monthEnd = `${cursor.year}-${String(cursor.month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`

      const { data: blocks } = await supabase
        .from('provider_availability')
        .select('date, end_date, status')
        .eq('provider_id', params.providerId)
        .eq('status', 'blocked')
        .not('date', 'is', null)
        .gte('date', monthStart)
        .lte('date', monthEnd)

      const blockedDates = new Set<string>()
      ;(blocks ?? []).forEach((b: any) => {
        const start = new Date(b.date + 'T12:00:00Z')
        const end = new Date((b.end_date ?? b.date) + 'T12:00:00Z')
        const cur = new Date(start)
        while (cur <= end) {
          blockedDates.add(toDateStr(cur))
          cur.setDate(cur.getDate() + 1)
        }
      })

      // Recurring blocks
      const { data: recurringBlocks } = await supabase
        .from('provider_availability')
        .select('day_of_week')
        .eq('provider_id', params.providerId)
        .eq('is_recurring', true)
        .eq('status', 'blocked')

      const recurringBlockedDOWs = new Set<number>()
      ;(recurringBlocks ?? []).forEach((r: any) => recurringBlockedDOWs.add(r.day_of_week))

      // Build available dates set
      const available = new Set<string>()
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(cursor.year, cursor.month, d)
        if (date < today) continue
        const ds = toDateStr(date)
        const dow = date.getDay()
        if (blockedDates.has(ds)) continue
        if (recurringBlockedDOWs.has(dow)) continue
        if (activeDOWs.has(dow)) available.add(ds)
      }
      setAvailableDates(available)
    } catch (e) {
      console.error('checkMonthAvailability error:', e)
    }
    setLoadingMonth(false)
  }

  async function loadSlots(dateStr: string) {
    setLoadingSlots(true)
    setSlots([])
    setSlotsReason(null)
    setSelectedSlot(null)

    try {
      const { data, error } = await supabase.functions.invoke('get-available-slots', {
        body: {
          opportunityId: params.serviceId,
          dateStr,
          tzOffset: getTZOffset(),
        },
      })

      if (error) throw new Error(error.message)

      setSlots(data.slots ?? [])
      setSlotsReason(data.reason ?? null)
    } catch (e) {
      console.error('loadSlots error:', e)
      Alert.alert('Could not load slots', 'Please try again.')
    }
    setLoadingSlots(false)
  }

  function selectDate(dateStr: string) {
    setSelectedDate(dateStr)
    loadSlots(dateStr)
  }

  function navPrev() {
    if (cursor.month === 0) setCursor({ year: cursor.year - 1, month: 11 })
    else setCursor({ year: cursor.year, month: cursor.month - 1 })
    setSelectedDate(null); setSlots([])
  }

  function navNext() {
    if (cursor.month === 11) setCursor({ year: cursor.year + 1, month: 0 })
    else setCursor({ year: cursor.year, month: cursor.month + 1 })
    setSelectedDate(null); setSlots([])
  }

  function goToReview() {
    if (!selectedDate || !selectedSlot) return
    router.push({
      pathname: '/book/[providerId]/review' as any,
      params: {
        providerId: params.providerId,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        servicePrice: params.servicePrice,
        serviceDuration: params.serviceDuration,
        selectedDate,
        selectedTime: selectedSlot.start,
        selectedTimeUTC: selectedSlot.startUTC,
        selectedEndUTC: selectedSlot.endUTC,
        answers: params.answers ?? '[]',
      },
    })
  }

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const availableSlots = slots.filter(s => s.available)

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#222" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Choose a date & time</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Service info strip */}
        <View style={s.serviceStrip}>
          <Text style={s.serviceName}>{params.serviceName}</Text>
          <Text style={s.serviceDuration}>{params.serviceDuration ?? 60} min · £{((parseInt(params.servicePrice ?? '0')) / 100).toFixed(2)}</Text>
        </View>

        {/* Month nav */}
        <View style={s.monthNav}>
          <TouchableOpacity style={s.monthBtn} onPress={navPrev}>
            <ChevronLeft size={20} color="#222" />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTHS[cursor.month]} {cursor.year}</Text>
          <TouchableOpacity style={s.monthBtn} onPress={navNext}>
            <ChevronRight size={20} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={s.dayLabels}>
          {DAYS_SHORT.map(d => <Text key={d} style={s.dayLabel}>{d}</Text>)}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDay + 1
            if (dayNum < 1 || dayNum > daysInMonth) return <View key={i} style={s.cell} />

            const date = new Date(cursor.year, cursor.month, dayNum)
            const ds = toDateStr(date)
            const isPast = date < today
            const isSelected = ds === selectedDate
            const hasSlots = availableDates.has(ds)

            return (
              <TouchableOpacity
                key={ds}
                style={s.cell}
                onPress={() => !isPast && hasSlots && selectDate(ds)}
                disabled={isPast || !hasSlots}
                activeOpacity={0.7}
              >
                <View style={[
                  s.cellInner,
                  isSelected && s.cellSelected,
                  !isSelected && hasSlots && !isPast && s.cellAvailable,
                ]}>
                  <Text style={[
                    s.cellText,
                    isPast && s.cellTextPast,
                    !isPast && !hasSlots && s.cellTextUnavailable,
                    isSelected && s.cellTextSelected,
                  ]}>{dayNum}</Text>
                  {!isPast && hasSlots && !isSelected && <View style={s.availDot} />}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {loadingMonth && (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color="#888" />
            <Text style={s.loadingText}>Checking availability...</Text>
          </View>
        )}

        {/* Slots */}
        {selectedDate && (
          <View style={s.slotsSection}>
            <Text style={s.slotsTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>

            {loadingSlots ? (
              <View style={s.slotsLoading}>
                <ActivityIndicator color="#222" />
                <Text style={s.slotsLoadingText}>Loading times...</Text>
              </View>
            ) : availableSlots.length === 0 ? (
              <View style={s.slotsEmpty}>
                <Text style={s.slotsEmptyTitle}>No available times</Text>
                <Text style={s.slotsEmptyDesc}>
                  {slotsReason === 'fully_booked' ? 'This day is fully booked.'
                    : slotsReason === 'provider_blocked' ? 'Provider is unavailable on this day.'
                    : 'No slots available. Try another date.'}
                </Text>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {availableSlots.map((slot, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.slotChip, selectedSlot?.start === slot.start && s.slotChipSelected]}
                    onPress={() => setSelectedSlot(slot)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.slotChipText, selectedSlot?.start === slot.start && s.slotChipTextSelected]}>
                      {formatSlot(slot.start)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {!selectedDate && !loadingMonth && (
          <View style={s.nudge}>
            <Text style={s.nudgeText}>Select a highlighted date to see available times</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CTA */}
      {selectedSlot && (
        <View style={s.footer}>
          <View style={s.footerInfo}>
            <Text style={s.footerTime}>{formatSlot(selectedSlot.start)}</Text>
            <Text style={s.footerDate}>
              {new Date(selectedDate! + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <TouchableOpacity style={s.continueBtn} onPress={goToReview} activeOpacity={0.88}>
            <Text style={s.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  content: { paddingHorizontal: 20, paddingTop: 20 },

  serviceStrip: { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceName: { fontSize: 15, fontWeight: '700', color: '#222' },
  serviceDuration: { fontSize: 13, color: '#888' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#222' },

  dayLabels: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#bbb', fontWeight: '600', textTransform: 'uppercase' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  cellInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  cellSelected: { backgroundColor: '#222' },
  cellAvailable: { borderWidth: 1.5, borderColor: '#222' },
  cellText: { fontSize: 14, color: '#222', fontWeight: '500' },
  cellTextPast: { color: '#ddd' },
  cellTextUnavailable: { color: '#ccc' },
  cellTextSelected: { color: '#fff', fontWeight: '700' },
  availDot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: '#222' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  loadingText: { fontSize: 13, color: '#888' },

  slotsSection: { marginTop: 28 },
  slotsTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 16 },
  slotsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  slotsLoadingText: { fontSize: 14, color: '#888' },
  slotsEmpty: { paddingVertical: 32, alignItems: 'center' },
  slotsEmptyTitle: { fontSize: 15, fontWeight: '700', color: '#888', marginBottom: 6 },
  slotsEmptyDesc: { fontSize: 13, color: '#bbb', textAlign: 'center', lineHeight: 19 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0' },
  slotChipSelected: { backgroundColor: '#222', borderColor: '#222' },
  slotChipText: { fontSize: 14, fontWeight: '600', color: '#222' },
  slotChipTextSelected: { color: '#fff' },

  nudge: { paddingVertical: 32, alignItems: 'center' },
  nudgeText: { fontSize: 14, color: '#bbb', textAlign: 'center' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerInfo: {},
  footerTime: { fontSize: 18, fontWeight: '700', color: '#222' },
  footerDate: { fontSize: 13, color: '#888', marginTop: 2 },
  continueBtn: { backgroundColor: '#222', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
