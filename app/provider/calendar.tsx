import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Switch, KeyboardAvoidingView,
  Platform, TextInput, Dimensions, Alert,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, X, Clock, RotateCcw,
  Eye, Calendar, Settings, TrendingUp, Users, Briefcase,
} from 'lucide-react-native'
import { ProviderNav } from '@/components/ProviderNav'
import { generateSlots, formatSlotTime } from '@/lib/slots'

const { width } = Dimensions.get('window')

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

type CalView = 'month' | 'week' | 'day'
const HOUR_HEIGHT = 56
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function initials(n: string) {
  return (n??'?').split(' ').map((p:string)=>p[0]).filter(Boolean).slice(0,2).join('').toUpperCase()
}
function formatTime(iso: string) {
  const d = new Date(iso); const h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0')
  return `${h%12||12}:${m} ${h>=12?'PM':'AM'}`
}
function formatHour(h: number) { return `${h%12||12}${h>=12?'p':'a'}` }
function getWeekStart(date: Date) {
  const d = new Date(date); const day = d.getDay()
  d.setDate(d.getDate()+(day===0?-6:1-day)); d.setHours(0,0,0,0); return d
}
function getWeekDays(ws: Date) {
  return Array.from({length:7},(_,i)=>{ const d=new Date(ws); d.setDate(ws.getDate()+i); return d })
}
function formatPence(p: number) { return `£${(p/100).toFixed(0)}` }

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ bookings, earnings }: { bookings: any[]; earnings: number }) {
  const confirmed = bookings.filter(b => b.status === 'confirmed').length
  const pending = bookings.filter(b => b.status === 'pending').length
  const clients = new Set(bookings.map(b => b.customer_id)).size

  return (
    <View style={sb.row}>
      <View style={sb.card}>
        <TrendingUp size={14} color="#ff6b35" />
        <Text style={sb.value}>{formatPence(earnings)}</Text>
        <Text style={sb.label}>Earnings</Text>
      </View>
      <View style={sb.card}>
        <Users size={14} color="#ff6b35" />
        <Text style={sb.value}>{clients}</Text>
        <Text style={sb.label}>Clients</Text>
      </View>
      <View style={sb.card}>
        <Calendar size={14} color="#10b981" />
        <Text style={sb.value}>{confirmed}</Text>
        <Text style={sb.label}>Confirmed</Text>
      </View>
      <View style={sb.card}>
        <Clock size={14} color="#f59e0b" />
        <Text style={sb.value}>{pending}</Text>
        <Text style={sb.label}>Pending</Text>
      </View>
    </View>
  )
}

// ── Appointment card (tappable) ───────────────────────────────────────────────
function AppointmentCard({ booking, onPress }: { booking: any; onPress: () => void }) {
  const statusColor = booking.status==='confirmed'?'#10b981':booking.status==='pending'?'#f59e0b':'#888'
  const answers: any[] = booking.booking_answers ?? []
  return (
    <TouchableOpacity style={appt.card} onPress={onPress} activeOpacity={0.85}>
      <View style={appt.timeCol}>
        <Text style={appt.time}>{formatTime(booking.starts_at)}</Text>
        <Text style={appt.duration}>{booking.duration_minutes??60}m</Text>
      </View>
      <View style={appt.divider} />
      <View style={appt.avatar}>
        <Text style={appt.avatarText}>{initials(booking.client_name??'C')}</Text>
      </View>
      <View style={appt.info}>
        <Text style={appt.name}>{booking.client_name??'Client'}</Text>
        <Text style={appt.service}>{booking.service_name??'Appointment'}</Text>
        {answers.length > 0 && (
          <Text style={appt.answers}>{answers.length} answer{answers.length>1?'s':''}</Text>
        )}
        <View style={[appt.statusBadge,{backgroundColor:`${statusColor}20`}]}>
          <Text style={[appt.statusText,{color:statusColor}]}>
            {booking.status?.charAt(0).toUpperCase()+booking.status?.slice(1)}
          </Text>
        </View>
      </View>
      <ChevronRight size={14} color="#ccc" />
    </TouchableOpacity>
  )
}

// ── Booking detail modal ──────────────────────────────────────────────────────
function BookingDetailModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  if (!booking) return null
  const answers: any[] = booking.booking_answers ?? []
  const statusColor = booking.status==='confirmed'?'#10b981':booking.status==='pending'?'#f59e0b':'#dc2626'
  const d = new Date(booking.starts_at)
  const dateLabel = d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const amountPence = booking.amount_pence ?? 0
  const feePence = booking.fee_pence ?? 0
  const youReceive = amountPence - feePence

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bm.overlay}>
        <TouchableOpacity style={bm.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={bm.sheet}>
          <View style={bm.handle} />
          <ScrollView style={bm.scroll} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={bm.header}>
              <View style={bm.avatar}>
                <Text style={bm.avatarText}>{initials(booking.client_name??'C')}</Text>
              </View>
              <View style={bm.headerInfo}>
                <Text style={bm.clientName}>{booking.client_name??'Client'}</Text>
                <Text style={bm.serviceName}>{booking.service_name??'Service'}</Text>
              </View>
              <TouchableOpacity style={bm.closeBtn} onPress={onClose}>
                <X size={16} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Status */}
            <View style={[bm.statusBadge,{backgroundColor:`${statusColor}18`}]}>
              <View style={[bm.statusDot,{backgroundColor:statusColor}]} />
              <Text style={[bm.statusText,{color:statusColor}]}>
                {booking.status?.charAt(0).toUpperCase()+booking.status?.slice(1)}
              </Text>
            </View>

            <View style={bm.divider} />

            {/* Date / time */}
            <View style={bm.row}>
              <Calendar size={15} color="#888" />
              <View style={bm.rowInfo}>
                <Text style={bm.rowLabel}>Date & time</Text>
                <Text style={bm.rowValue}>{dateLabel}</Text>
                <Text style={bm.rowValue}>{formatTime(booking.starts_at)} · {booking.duration_minutes??60} min</Text>
              </View>
            </View>

            {/* Price */}
            <View style={bm.priceCard}>
              <View style={bm.priceRow}>
                <Text style={bm.priceLabel}>Service fee</Text>
                <Text style={bm.priceValue}>{formatPence(amountPence)}</Text>
              </View>
              {feePence > 0 && (
                <View style={bm.priceRow}>
                  <Text style={bm.priceLabel}>Platform fee</Text>
                  <Text style={bm.priceValue}>− {formatPence(feePence)}</Text>
                </View>
              )}
              <View style={[bm.priceRow,bm.priceTotalRow]}>
                <Text style={bm.priceTotalLabel}>You receive</Text>
                <Text style={bm.priceTotalValue}>{formatPence(youReceive)}</Text>
              </View>
            </View>

            {/* Answers */}
            {answers.length > 0 && (
              <>
                <Text style={bm.sectionTitle}>Customer answers</Text>
                {answers.map((a:any,i:number) => (
                  <View key={i} style={bm.answerRow}>
                    <Text style={bm.answerQ}>{a.question}</Text>
                    <Text style={bm.answerA}>{a.answer?String(a.answer):'Not answered'}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={{height:40}} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ weekStart, bookingsByDate, blocked, recurring, holidays, onDayPress, onBookingPress }: any) {
  const today = toDateStr(new Date())
  const days = getWeekDays(weekStart)

  function getTop(iso: string) {
    const d = new Date(iso); return ((d.getHours()*60+d.getMinutes()-7*60)/60)*HOUR_HEIGHT
  }
  function getHeight(startIso: string, endIso?: string, durationMins=60) {
    if (endIso) {
      const diff = (new Date(endIso).getTime()-new Date(startIso).getTime())/60000
      return Math.max(24,(diff/60)*HOUR_HEIGHT)
    }
    return Math.max(24,(durationMins/60)*HOUR_HEIGHT)
  }

  return (
    <View style={wk.container}>
      <View style={wk.headerRow}>
        <View style={wk.timeGutter} />
        {days.map((d,i) => {
          const ds = toDateStr(d); const isToday = ds===today
          const dayBookings = bookingsByDate.get(ds)?.length ?? 0
          return (
            <TouchableOpacity key={i} style={wk.dayHeader} onPress={()=>onDayPress(ds)}>
              <Text style={[wk.dayHeaderDow,isToday&&wk.dayHeaderActive]}>{DAYS_SHORT[d.getDay()]}</Text>
              <View style={[wk.dayHeaderNum,isToday&&wk.dayHeaderNumActive]}>
                <Text style={[wk.dayHeaderNumText,isToday&&wk.dayHeaderNumTextActive]}>{d.getDate()}</Text>
              </View>
              {dayBookings > 0 && <View style={wk.dayBookingDot} />}
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={wk.gridScroll}>
        <View style={wk.grid}>
          <View style={wk.timeGutter}>
            {HOURS.map(h => (
              <View key={h} style={[wk.hourCell,{height:HOUR_HEIGHT}]}>
                <Text style={wk.hourLabel}>{formatHour(h)}</Text>
              </View>
            ))}
          </View>
          {days.map((d,di) => {
            const ds = toDateStr(d)
            const dayBookings = bookingsByDate.get(ds) ?? []
            const isBlocked = blocked.has(ds) || recurring.has(d.getDay())
            const holiday = holidays.find((h:any) => {
              const start = h.date; const end = h.end_date ?? h.date
              return ds >= start && ds <= end
            })
            return (
              <View key={di} style={wk.dayCol}>
                {HOURS.map(h => <View key={h} style={[wk.hourLine,{height:HOUR_HEIGHT}]} />)}
                {(isBlocked || holiday) && (
                  <View style={wk.blockedOverlay}>
                    <Text style={wk.blockedText}>{holiday?.label??'Blocked'}</Text>
                  </View>
                )}
                {dayBookings.map((b:any,bi:number) => {
                  const top = getTop(b.starts_at)
                  const height = getHeight(b.starts_at,b.ends_at,b.duration_minutes??60)
                  return (
                    <TouchableOpacity
                      key={bi}
                      style={[wk.bookingBlock,{top,height},b.status==='confirmed'?wk.bookingConfirmed:wk.bookingPending]}
                      onPress={()=>onBookingPress(b)}
                    >
                      <Text style={wk.bookingName} numberOfLines={1}>{b.client_name}</Text>
                      <Text style={wk.bookingService} numberOfLines={1}>{b.service_name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ dateStr, bookings, providerHours, blocked, recurring, holidays, onBookingPress }: any) {
  const d = new Date(dateStr+'T12:00:00')
  const isBlocked = blocked.has(dateStr) || recurring.has(d.getDay())
  const holiday = holidays.find((h:any) => {
    const start = h.date; const end = h.end_date ?? h.date
    return dateStr >= start && dateStr <= end
  })
  const now = new Date()
  const nowTop = ((now.getHours()*60+now.getMinutes()-7*60)/60)*HOUR_HEIGHT
  const showNow = toDateStr(now)===dateStr

  function getTop(iso:string) {
    const dt=new Date(iso); return ((dt.getHours()*60+dt.getMinutes()-7*60)/60)*HOUR_HEIGHT
  }
  function getHeight(startIso:string,endIso?:string,durationMins=60) {
    if(endIso){ const diff=(new Date(endIso).getTime()-new Date(startIso).getTime())/60000; return Math.max(28,(diff/60)*HOUR_HEIGHT) }
    return Math.max(28,(durationMins/60)*HOUR_HEIGHT)
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={dv.scroll}>
      <View style={dv.grid}>
        <View style={dv.timeGutter}>
          {HOURS.map(h => (
            <View key={h} style={[dv.hourCell,{height:HOUR_HEIGHT}]}>
              <Text style={dv.hourLabel}>{formatHour(h)}</Text>
            </View>
          ))}
        </View>
        <View style={dv.mainCol}>
          {HOURS.map(h => <View key={h} style={[dv.hourLine,{height:HOUR_HEIGHT}]} />)}
          {providerHours && !isBlocked && !holiday && (() => {
            const [sh,sm]=providerHours.start_time.split(':').map(Number)
            const [eh,em]=providerHours.end_time.split(':').map(Number)
            const top=((sh*60+sm-7*60)/60)*HOUR_HEIGHT
            const height=((eh*60+em-sh*60-sm)/60)*HOUR_HEIGHT
            return <View style={[dv.workingHours,{top,height}]} />
          })()}
          {/* Break time */}
          {providerHours?.break_start && providerHours?.break_end && (() => {
            const [bsh,bsm]=providerHours.break_start.split(':').map(Number)
            const [beh,bem]=providerHours.break_end.split(':').map(Number)
            const top=((bsh*60+bsm-7*60)/60)*HOUR_HEIGHT
            const height=((beh*60+bem-bsh*60-bsm)/60)*HOUR_HEIGHT
            return <View style={[dv.breakTime,{top,height}]}><Text style={dv.breakLabel}>Break</Text></View>
          })()}
          {(isBlocked||holiday) && (
            <View style={dv.blockedOverlay}>
              <Text style={dv.blockedText}>{holiday?.label??'Day blocked'}</Text>
            </View>
          )}
          {showNow && (
            <View style={[dv.nowLine,{top:nowTop}]}>
              <View style={dv.nowDot} />
              <View style={dv.nowLineBar} />
            </View>
          )}
          {bookings.map((b:any,i:number) => {
            const top=getTop(b.starts_at)
            const height=getHeight(b.starts_at,b.ends_at,b.duration_minutes??60)
            return (
              <TouchableOpacity
                key={i}
                style={[dv.bookingBlock,{top,height},b.status==='confirmed'?dv.bookingConfirmed:dv.bookingPending]}
                onPress={()=>onBookingPress(b)}
              >
                <Text style={dv.bookingName} numberOfLines={1}>{b.client_name}</Text>
                <Text style={dv.bookingService} numberOfLines={1}>{b.service_name}</Text>
                <Text style={dv.bookingTime}>{formatTime(b.starts_at)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

// ── Settings sheet ────────────────────────────────────────────────────────────
function SettingsSheet({ visible, onClose, userId, hours, setHours, recurring, toggleRecurring, settings, setSettings, saveAll }: any) {
  const [tab, setTab] = useState<'hours'|'daysoff'|'holidays'|'rules'>('hours')
  const [holidays, setHolidays] = useState<any[]>([])
  const [newHolidayLabel, setNewHolidayLabel] = useState('')
  const [newHolidayStart, setNewHolidayStart] = useState('')
  const [newHolidayEnd, setNewHolidayEnd] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (visible) loadHolidays() }, [visible])

  async function loadHolidays() {
    const { data } = await supabase
      .from('provider_availability')
      .select('*')
      .eq('provider_id', userId)
      .eq('status', 'blocked')
      .not('label', 'is', null)
      .order('date')
    setHolidays(data ?? [])
  }

  async function addHoliday() {
    if (!newHolidayLabel || !newHolidayStart) { Alert.alert('Enter a label and start date'); return }
    setSaving(true)
    await supabase.from('provider_availability').upsert({
      provider_id: userId,
      date: newHolidayStart,
      end_date: newHolidayEnd || newHolidayStart,
      status: 'blocked',
      is_recurring: false,
      label: newHolidayLabel,
    }, { onConflict: 'provider_id,date' })
    setNewHolidayLabel(''); setNewHolidayStart(''); setNewHolidayEnd('')
    await loadHolidays()
    setSaving(false)
  }

  async function removeHoliday(id: string) {
    await supabase.from('provider_availability').delete().eq('id', id)
    setHolidays(prev => prev.filter(h => h.id !== id))
  }

  async function saveSettings() {
    setSaving(true)
    await saveAll()
    setSaving(false)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={ss.overlay}>
          <TouchableOpacity style={ss.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={ss.sheet}>
            <View style={ss.handle} />
            <View style={ss.header}>
              <Text style={ss.title}>Calendar settings</Text>
              <TouchableOpacity style={ss.closeBtn} onPress={onClose}>
                <X size={18} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.tabs}>
              {(['hours','daysoff','holidays','rules'] as const).map(t => (
                <TouchableOpacity key={t} style={[ss.tab, tab===t && ss.tabActive]} onPress={()=>setTab(t)}>
                  <Text style={[ss.tabText, tab===t && ss.tabTextActive]}>
                    {t==='hours'?'Business hours':t==='daysoff'?'Days off':t==='holidays'?'Holidays':'Rules'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={ss.content} showsVerticalScrollIndicator={false}>

              {/* Business hours tab */}
              {tab==='hours' && hours.map((h:any) => (
                <View key={h.day_of_week} style={ss.hoursRow}>
                  <Switch value={h.is_active} onValueChange={(v)=>setHours((prev:any[])=>prev.map((x:any)=>x.day_of_week===h.day_of_week?{...x,is_active:v}:x))} trackColor={{false:'#e0e0e0',true:'#111'}} thumbColor="#fff" />
                  <Text style={[ss.hoursDay,!h.is_active&&ss.hoursDayOff]}>{DAYS_FULL[h.day_of_week]}</Text>
                  {h.is_active && (
                    <View style={{gap:4}}>
                      <View style={ss.timeRow}>
                        <TextInput style={ss.timeInput} value={h.start_time} onChangeText={v=>setHours((prev:any[])=>prev.map((x:any)=>x.day_of_week===h.day_of_week?{...x,start_time:v}:x))} placeholder="09:00" placeholderTextColor="#ccc" />
                        <Text style={ss.timeSep}>–</Text>
                        <TextInput style={ss.timeInput} value={h.end_time} onChangeText={v=>setHours((prev:any[])=>prev.map((x:any)=>x.day_of_week===h.day_of_week?{...x,end_time:v}:x))} placeholder="17:00" placeholderTextColor="#ccc" />
                      </View>
                      <View style={[ss.timeRow,{opacity:0.7}]}>
                        <Text style={{fontSize:10,color:'#888',width:40}}>Break</Text>
                        <TextInput style={[ss.timeInput,{width:50}]} value={h.break_start??''} onChangeText={v=>setHours((prev:any[])=>prev.map((x:any)=>x.day_of_week===h.day_of_week?{...x,break_start:v}:x))} placeholder="13:00" placeholderTextColor="#ccc" />
                        <Text style={ss.timeSep}>–</Text>
                        <TextInput style={[ss.timeInput,{width:50}]} value={h.break_end??''} onChangeText={v=>setHours((prev:any[])=>prev.map((x:any)=>x.day_of_week===h.day_of_week?{...x,break_end:v}:x))} placeholder="14:00" placeholderTextColor="#ccc" />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {/* Days off tab */}
              {tab==='daysoff' && DAYS_FULL.map((day,i) => (
                <TouchableOpacity key={i} style={ss.recurringRow} onPress={()=>toggleRecurring(i)}>
                  <View>
                    <Text style={ss.recurringDay}>{day}</Text>
                    <Text style={ss.recurringSub}>{recurring.has(i)?'Always blocked':'Available'}</Text>
                  </View>
                  <Switch value={recurring.has(i)} onValueChange={()=>toggleRecurring(i)} trackColor={{false:'#e0e0e0',true:'#111'}} thumbColor="#fff" />
                </TouchableOpacity>
              ))}

              {/* Holidays tab */}
              {tab==='holidays' && (
                <View style={{gap:12}}>
                  <Text style={ss.sectionLabel}>Add time off</Text>
                  <TextInput style={ss.input} value={newHolidayLabel} onChangeText={setNewHolidayLabel} placeholder="Label (e.g. Holiday, Vacation)" placeholderTextColor="#bbb" />
                  <View style={ss.timeRow}>
                    <TextInput style={[ss.input,{flex:1}]} value={newHolidayStart} onChangeText={setNewHolidayStart} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor="#bbb" />
                  </View>
                  <View style={ss.timeRow}>
                    <TextInput style={[ss.input,{flex:1}]} value={newHolidayEnd} onChangeText={setNewHolidayEnd} placeholder="End date (optional)" placeholderTextColor="#bbb" />
                  </View>
                  <TouchableOpacity style={ss.addBtn} onPress={addHoliday} disabled={saving}>
                    {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={ss.addBtnText}>Add time off</Text>}
                  </TouchableOpacity>

                  {holidays.length > 0 && (
                    <>
                      <Text style={ss.sectionLabel}>Scheduled time off</Text>
                      {holidays.map((h:any) => (
                        <View key={h.id} style={ss.holidayRow}>
                          <View style={{flex:1}}>
                            <Text style={ss.holidayLabel}>{h.label}</Text>
                            <Text style={ss.holidayDates}>
                              {h.date}{h.end_date && h.end_date !== h.date ? ` → ${h.end_date}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity style={ss.removeBtn} onPress={()=>removeHoliday(h.id)}>
                            <X size={14} color="#dc2626" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* Rules tab */}
              {tab==='rules' && (
                <View style={{gap:16}}>
                  <View style={ss.ruleRow}>
                    <View style={{flex:1}}>
                      <Text style={ss.ruleTitle}>Buffer time</Text>
                      <Text style={ss.ruleSub}>Gap between bookings</Text>
                    </View>
                    <View style={ss.bufferRow}>
                      {[0,10,15,20,30,45,60].map(b => (
                        <TouchableOpacity key={b} style={[ss.bufferBtn, settings.buffer_mins===b&&ss.bufferBtnActive]} onPress={()=>setSettings((p:any)=>({...p,buffer_mins:b}))}>
                          <Text style={[ss.bufferBtnText, settings.buffer_mins===b&&ss.bufferBtnTextActive]}>{b===0?'Off':`${b}m`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={ss.ruleRow}>
                    <View style={{flex:1}}>
                      <Text style={ss.ruleTitle}>Min notice</Text>
                      <Text style={ss.ruleSub}>How far ahead must clients book</Text>
                    </View>
                    <View style={ss.bufferRow}>
                      {[0,1,2,4,12,24,48].map(h => (
                        <TouchableOpacity key={h} style={[ss.bufferBtn, settings.min_notice_hours===h&&ss.bufferBtnActive]} onPress={()=>setSettings((p:any)=>({...p,min_notice_hours:h}))}>
                          <Text style={[ss.bufferBtnText, settings.min_notice_hours===h&&ss.bufferBtnTextActive]}>{h===0?'None':h<24?`${h}h`:`${h/24}d`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={ss.ruleRow}>
                    <View style={{flex:1}}>
                      <Text style={ss.ruleTitle}>Book ahead</Text>
                      <Text style={ss.ruleSub}>How far in advance clients can book</Text>
                    </View>
                    <View style={ss.bufferRow}>
                      {[14,30,60,90,180].map(d => (
                        <TouchableOpacity key={d} style={[ss.bufferBtn, settings.max_advance_days===d&&ss.bufferBtnActive]} onPress={()=>setSettings((p:any)=>({...p,max_advance_days:d}))}>
                          <Text style={[ss.bufferBtnText, settings.max_advance_days===d&&ss.bufferBtnTextActive]}>{d<30?`${d}d`:`${d/30}mo`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={ss.ruleRow}>
                    <View style={{flex:1}}>
                      <Text style={ss.ruleTitle}>Max per day</Text>
                      <Text style={ss.ruleSub}>0 = unlimited</Text>
                    </View>
                    <View style={ss.bufferRow}>
                      {[0,1,2,3,4,5,8,10].map(n => (
                        <TouchableOpacity key={n} style={[ss.bufferBtn, settings.max_bookings_per_day===n&&ss.bufferBtnActive]} onPress={()=>setSettings((p:any)=>({...p,max_bookings_per_day:n}))}>
                          <Text style={[ss.bufferBtnText, settings.max_bookings_per_day===n&&ss.bufferBtnTextActive]}>{n===0?'∞':String(n)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              <View style={{height:40}} />
            </ScrollView>

            <TouchableOpacity style={ss.saveBtn} onPress={saveSettings} disabled={saving}>
              {saving?<ActivityIndicator color="#fff"/>:<Text style={ss.saveBtnText}>Save settings</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProviderCalendar() {
  const today = new Date(); today.setHours(0,0,0,0)

  const [calView, setCalView] = useState<CalView>('month')
  const [cursor, setCursor] = useState({year:today.getFullYear(),month:today.getMonth()})
  const [weekStart, setWeekStart] = useState(getWeekStart(today))
  const [selectedDate, setSelectedDate] = useState(toDateStr(today))

  const [userId, setUserId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [recurring, setRecurring] = useState<Set<number>>(new Set())
  const [holidays, setHolidays] = useState<any[]>([])
  const [hours, setHours] = useState<any[]>([])
  const [bookingsByDate, setBookingsByDate] = useState<Map<string,any[]>>(new Map())
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [todayBookings, setTodayBookings] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [settings, setSettings] = useState({buffer_mins:0,min_notice_hours:2,max_advance_days:60,max_bookings_per_day:0})

  const [rangeStart, setRangeStart] = useState<string|null>(null)
  const [rangeEnd, setRangeEnd] = useState<string|null>(null)
  const [selecting, setSelecting] = useState(false)

  const [settingsSheet, setSettingsSheet] = useState(false)
  const [previewSheet, setPreviewSheet] = useState(false)
  const [previewService, setPreviewService] = useState<any>(null)
  const [daySheet, setDaySheet] = useState<string|null>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  useFocusEffect(useCallback(()=>{ loadData() },[]))

  async function loadData() {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    // Availability
    const {data:avail} = await supabase.from('provider_availability').select('*').eq('provider_id',user.id)
    const blockedSet = new Set<string>()
    const recurringSet = new Set<number>()
    const holidayList: any[] = []
    ;(avail??[]).forEach((a:any)=>{
      if (a.status==='blocked') {
        if (a.label) holidayList.push(a)
        else if (a.date) blockedSet.add(a.date)
        if (a.is_recurring && a.day_of_week!=null) recurringSet.add(a.day_of_week)
      }
    })
    setBlocked(blockedSet); setRecurring(recurringSet); setHolidays(holidayList)

    // Bookings
    const {data:bookings} = await supabase
      .from('bookings')
      .select('id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,amount_pence,fee_pence,booking_answers')
      .eq('provider_id',user.id)
      .neq('status','cancelled')
      .order('starts_at')

    const bookedSet = new Set<string>()
    const byDate = new Map<string,any[]>()
    const custIds = Array.from(new Set((bookings??[]).map((b:any)=>b.customer_id)))
    const nameMap = new Map<string,string>()
    if (custIds.length) {
      const {data:profiles} = await supabase.from('profiles').select('id,full_name').in('id',custIds)
      ;(profiles??[]).forEach((p:any)=>nameMap.set(p.id,p.full_name??'Client'))
    }
    ;(bookings??[]).forEach((b:any)=>{
      const ds = toDateStr(new Date(b.starts_at))
      bookedSet.add(ds)
      const enriched = {...b,client_name:nameMap.get(b.customer_id)??'Client'}
      const arr = byDate.get(ds)??[]; arr.push(enriched); byDate.set(ds,arr)
    })
    setBooked(bookedSet)
    setBookingsByDate(byDate)
    setAllBookings((bookings??[]).map((b:any)=>({...b,client_name:nameMap.get(b.customer_id)??'Client'})))
    setTodayBookings(byDate.get(toDateStr(today))??[])

    // Hours
    const {data:hoursData} = await supabase.from('provider_hours').select('*').eq('provider_id',user.id).order('day_of_week')
    if (!hoursData||hoursData.length===0) {
      const defaults = [1,2,3,4,5].map(d=>({provider_id:user.id,day_of_week:d,start_time:'09:00',end_time:'17:00',is_active:true}))
      await supabase.from('provider_hours').upsert(defaults)
      setHours(Array.from({length:7},(_,i)=>defaults.find(d=>d.day_of_week===i)??{provider_id:user.id,day_of_week:i,start_time:'09:00',end_time:'17:00',is_active:false}))
    } else {
      const existing = new Map(hoursData.map((h:any)=>[h.day_of_week,h]))
      setHours(Array.from({length:7},(_,i)=>existing.get(i)??{provider_id:user.id,day_of_week:i,start_time:'09:00',end_time:'17:00',is_active:false}))
    }

    // Settings
    const {data:settingsData} = await supabase.from('provider_settings').select('*').eq('provider_id',user.id).single()
    if (settingsData) setSettings(settingsData)
    else await supabase.from('provider_settings').upsert({provider_id:user.id,...settings})

    // Services
    const {data:svcs} = await supabase.from('opportunities').select('id,title,price_pence').eq('provider_id',user.id).eq('status','active')
    setServices(svcs??[])
    if (svcs&&svcs.length>0) setPreviewService(svcs[0])
    setLoading(false)
  }

  async function saveAll() {
    if (!userId) return
    await supabase.from('provider_hours').upsert(hours.map((h:any)=>({...h,provider_id:userId})),{onConflict:'provider_id,day_of_week'})
    await supabase.from('provider_settings').upsert({provider_id:userId,...settings},{onConflict:'provider_id'})
  }

  async function toggleRecurring(dow: number) {
    if (!userId) return
    if (recurring.has(dow)) {
      await supabase.from('provider_availability').delete().eq('provider_id',userId).eq('day_of_week',dow).eq('is_recurring',true)
      setRecurring(prev=>{const n=new Set(prev);n.delete(dow);return n})
    } else {
      await supabase.from('provider_availability').insert({provider_id:userId,day_of_week:dow,is_recurring:true,status:'blocked'})
      setRecurring(prev=>new Set([...prev,dow]))
    }
  }

  async function toggleDay(dateStr: string) {
    if (!userId) return
    setSaving(true)
    if (blocked.has(dateStr)) {
      await supabase.from('provider_availability').delete().eq('provider_id',userId).eq('date',dateStr)
      setBlocked(prev=>{const n=new Set(prev);n.delete(dateStr);return n})
    } else {
      await supabase.from('provider_availability').upsert({provider_id:userId,date:dateStr,status:'blocked',is_recurring:false},{onConflict:'provider_id,date'})
      setBlocked(prev=>new Set([...prev,dateStr]))
    }
    setSaving(false); setDaySheet(null)
  }

  async function blockRange(status:'blocked'|'available') {
    if (!userId||!rangeStart) return
    setSaving(true)
    const dates: string[] = []
    const start = new Date(rangeStart+'T12:00:00')
    const end = rangeEnd?new Date(rangeEnd+'T12:00:00'):new Date(rangeStart+'T12:00:00')
    const cur = new Date(start)
    while (cur<=end) { dates.push(toDateStr(cur)); cur.setDate(cur.getDate()+1) }
    if (status==='blocked') {
      await supabase.from('provider_availability').upsert(dates.map(d=>({provider_id:userId,date:d,status:'blocked',is_recurring:false})),{onConflict:'provider_id,date'})
      setBlocked(prev=>{const n=new Set(prev);dates.forEach(d=>n.add(d));return n})
    } else {
      await supabase.from('provider_availability').delete().eq('provider_id',userId).in('date',dates)
      setBlocked(prev=>{const n=new Set(prev);dates.forEach(d=>n.delete(d));return n})
    }
    setRangeStart(null); setRangeEnd(null); setSelecting(false); setSaving(false)
  }

  function getDayStatus(dateStr: string) {
    const d = new Date(dateStr+'T12:00:00')
    const isHoliday = holidays.some(h=>{ const s=h.date,e=h.end_date??h.date; return dateStr>=s&&dateStr<=e })
    if (isHoliday) return 'blocked'
    if (booked.has(dateStr)) return 'booked'
    if (blocked.has(dateStr)) return 'blocked'
    if (recurring.has(d.getDay())) return 'blocked'
    return 'available'
  }

  function getHoursForDate(dateStr: string) {
    const d = new Date(dateStr+'T12:00:00')
    return hours.find((h:any)=>h.day_of_week===d.getDay()&&h.is_active)??null
  }

  function getSlotsForDate(dateStr: string, durationMins=60) {
    const h = getHoursForDate(dateStr)
    if (!h) return []
    const booked24 = (bookingsByDate.get(dateStr)??[]).map((b:any)=>{
      const sDate=new Date(b.starts_at); const eDate=new Date(b.ends_at??new Date(b.starts_at).getTime()+durationMins*60000)
      return {start:`${String(sDate.getHours()).padStart(2,'0')}:${String(sDate.getMinutes()).padStart(2,'0')}`,end:`${String(eDate.getHours()).padStart(2,'0')}:${String(eDate.getMinutes()).padStart(2,'0')}`}
    })
    return generateSlots({workStart:h.start_time,workEnd:h.end_time,durationMins,bufferMins:settings.buffer_mins,bookedSlots:booked24})
  }

  function isInRange(ds: string) {
    if (!rangeStart||!rangeEnd) return false
    return ds>rangeStart&&ds<rangeEnd
  }

  function handleDayPress(dateStr: string) {
    const d = new Date(dateStr+'T12:00:00')
    if (d<today) return
    setSelectedDate(dateStr)
    if (calView==='week') { setCalView('day'); return }
    if (!selecting) { setSelecting(true); setRangeStart(dateStr); setRangeEnd(null) }
    else if (!rangeEnd) {
      if (dateStr===rangeStart) { setSelecting(false); setRangeStart(null); setDaySheet(dateStr) }
      else if (dateStr<rangeStart!) setRangeStart(dateStr)
      else setRangeEnd(dateStr)
    } else { setSelecting(true); setRangeStart(dateStr); setRangeEnd(null) }
  }

  function navPrev() {
    if (calView==='month') { if(cursor.month===0) setCursor({year:cursor.year-1,month:11}); else setCursor({year:cursor.year,month:cursor.month-1}) }
    else if (calView==='week') { const p=new Date(weekStart); p.setDate(p.getDate()-7); setWeekStart(p) }
    else { const p=new Date(selectedDate+'T12:00:00'); p.setDate(p.getDate()-1); setSelectedDate(toDateStr(p)) }
  }
  function navNext() {
    if (calView==='month') { if(cursor.month===11) setCursor({year:cursor.year+1,month:0}); else setCursor({year:cursor.year,month:cursor.month+1}) }
    else if (calView==='week') { const n=new Date(weekStart); n.setDate(n.getDate()+7); setWeekStart(n) }
    else { const n=new Date(selectedDate+'T12:00:00'); n.setDate(n.getDate()+1); setSelectedDate(toDateStr(n)) }
  }

  function getNavLabel() {
    if (calView==='month') return `${MONTHS[cursor.month]} ${cursor.year}`
    if (calView==='week') {
      const days=getWeekDays(weekStart); const first=days[0]; const last=days[6]
      if (first.getMonth()===last.getMonth()) return `${MONTHS_SHORT[first.getMonth()]} ${first.getDate()}–${last.getDate()}`
      return `${MONTHS_SHORT[first.getMonth()]} ${first.getDate()} – ${MONTHS_SHORT[last.getMonth()]} ${last.getDate()}`
    }
    return new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})
  }

  const {year,month} = cursor
  const daysInMonth = new Date(year,month+1,0).getDate()
  const firstDay = new Date(year,month,1).getDay()
  const totalCells = Math.ceil((firstDay+daysInMonth)/7)*7
  const selectedBookings = bookingsByDate.get(selectedDate)??[]
  const selectedSlots = getSlotsForDate(selectedDate,previewService?.duration_mins??60)
  const selectedStatus = getDayStatus(selectedDate)
  const selectedHours = getHoursForDate(selectedDate)

  // Earnings — confirmed bookings only
  const totalEarnings = allBookings
    .filter(b=>b.payment_status==='captured')
    .reduce((s,b)=>s+(b.amount_pence??0)-(b.fee_pence??0),0)

  if (loading) return <View style={styles.center}><ActivityIndicator color="#ff6b35" /></View>

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.navBtn} onPress={calView!=='month'?()=>setCalView(calView==='day'?'week':'month'):navPrev}>
          <ChevronLeft size={20} color="#111" />
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{const d=new Date();setSelectedDate(toDateStr(d));setWeekStart(getWeekStart(d));setCursor({year:d.getFullYear(),month:d.getMonth()})}}>
          <Text style={styles.navLabel}>{getNavLabel()}</Text>
        </TouchableOpacity>
        <View style={styles.topRight}>
          {calView==='month'&&<TouchableOpacity style={styles.navBtn} onPress={navNext}><ChevronRight size={20} color="#111" /></TouchableOpacity>}
          <TouchableOpacity style={[styles.navBtn,{backgroundColor:'#111'}]} onPress={()=>setSettingsSheet(true)}>
            <Settings size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* View switcher */}
      <View style={styles.switcher}>
        {(['month','week','day'] as CalView[]).map(v=>(
          <TouchableOpacity key={v} style={[styles.switchBtn,calView===v&&styles.switchBtnActive]} onPress={()=>{setCalView(v);if(v==='week')setWeekStart(getWeekStart(new Date(selectedDate+'T12:00:00')))}}>
            <Text style={[styles.switchBtnText,calView===v&&styles.switchBtnTextActive]}>{v.charAt(0).toUpperCase()+v.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats bar */}
      <StatsBar bookings={allBookings} earnings={totalEarnings} />

      {/* Month view */}
      {calView==='month' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.dayLabels}>
            {DAYS_SHORT.map(d=><Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {Array.from({length:totalCells},(_,i)=>{
              const dayNum=i-firstDay+1
              if (dayNum<1||dayNum>daysInMonth) return <View key={i} style={styles.cell}/>
              const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
              const d=new Date(dateStr+'T12:00:00')
              const isPast=d<today; const isToday=dateStr===toDateStr(today)
              const isSelected=dateStr===selectedDate; const status=getDayStatus(dateStr)
              const inRange=isInRange(dateStr)
              const holiday=holidays.find(h=>{ const s=h.date,e=h.end_date??h.date; return dateStr>=s&&dateStr<=e })
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell,inRange&&styles.cellInRange,dateStr===rangeStart&&styles.cellRangeStart,dateStr===rangeEnd&&styles.cellRangeEnd]}
                  onPress={()=>handleDayPress(dateStr)}
                  onLongPress={()=>{setDaySheet(dateStr);setSelecting(false);setRangeStart(null);setRangeEnd(null)}}
                  disabled={isPast} activeOpacity={0.7}
                >
                  <View style={[styles.cellInner,isSelected&&styles.cellSelected,isToday&&!isSelected&&styles.cellToday,status==='blocked'&&!isSelected&&styles.cellBlocked]}>
                    <Text style={[styles.cellText,isPast&&styles.cellTextPast,isSelected&&styles.cellTextSelected,isToday&&!isSelected&&styles.cellTextToday]}>{dayNum}</Text>
                    {!isPast&&!isSelected&&(
                      holiday
                        ? <View style={styles.holidayDot}/>
                        : <View style={[styles.cellDot,status==='booked'?styles.cellDotBooked:status==='blocked'?styles.cellDotBlocked:styles.cellDotAvailable]}/>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[{color:'#10b981',label:'Available'},{color:'#ff6b35',label:'Booked'},{color:'#d1d5db',label:'Blocked'},{color:'#a78bfa',label:'Holiday'}].map(item=>(
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot,{backgroundColor:item.color}]}/>
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Range selection bar */}
          {rangeStart && (
            <View style={styles.selectionBar}>
              <View style={{flex:1}}>
                <Text style={styles.selectionTitle}>
                  {rangeEnd?`${new Date(rangeStart+'T12:00:00').getDate()}–${new Date(rangeEnd+'T12:00:00').getDate()} ${MONTHS[month]}`:`${new Date(rangeStart+'T12:00:00').getDate()} ${MONTHS[month]} — tap another date`}
                </Text>
              </View>
              {rangeEnd && (
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity style={styles.selectionBtnBlock} onPress={()=>blockRange('blocked')} disabled={saving}>
                    {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.selectionBtnBlockText}>Block</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.selectionBtnUnblock} onPress={()=>blockRange('available')} disabled={saving}>
                    <Text style={styles.selectionBtnUnblockText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={()=>{setRangeStart(null);setRangeEnd(null);setSelecting(false)}}>
                <X size={18} color="#888"/>
              </TouchableOpacity>
            </View>
          )}

          {/* Day panel */}
          <View style={styles.dayPanel}>
            <View style={styles.dayPanelHeader}>
              <View>
                <Text style={styles.dayPanelTitle}>
                  {new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
                </Text>
                <Text style={styles.dayPanelSub}>
                  {selectedStatus==='blocked'?'🔴 Blocked':
                   selectedStatus==='booked'?`📅 ${selectedBookings.length} booking${selectedBookings.length>1?'s':''}`:
                   selectedHours?`🟢 Open ${selectedHours.start_time}–${selectedHours.end_time}`:'⚪ No hours set'}
                </Text>
              </View>
              <View style={{flexDirection:'row',gap:8}}>
                <TouchableOpacity style={styles.dayPanelBtn} onPress={()=>setPreviewSheet(true)}>
                  <Eye size={16} color="#111"/>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dayPanelBtn} onPress={()=>{setCalView('day')}}>
                  <Calendar size={16} color="#111"/>
                </TouchableOpacity>
              </View>
            </View>

            {selectedBookings.length>0 && (
              <View style={{gap:10,marginTop:12}}>
                <Text style={styles.sectionLabel}>Appointments</Text>
                {selectedBookings.map((b,i)=><AppointmentCard key={i} booking={b} onPress={()=>setSelectedBooking(b)}/>)}
              </View>
            )}

            {selectedStatus==='available'&&selectedHours&&selectedSlots.length>0 && (
              <View style={{marginTop:16}}>
                <Text style={styles.sectionLabel}>Available slots · {selectedSlots.filter((s:any)=>s.available).length} open</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:4}}>
                  {selectedSlots.map((slot:any,i:number)=>(
                    <View key={i} style={[styles.slotChip,!slot.available&&styles.slotChipBooked]}>
                      <Text style={[styles.slotChipText,!slot.available&&styles.slotChipTextBooked]}>{formatSlotTime(slot.start)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {selectedStatus==='available'&&!selectedHours && (
              <TouchableOpacity style={styles.setHoursPrompt} onPress={()=>setSettingsSheet(true)}>
                <Text style={styles.setHoursPromptText}>Set business hours in settings →</Text>
              </TouchableOpacity>
            )}
            {selectedStatus==='blocked' && (
              <TouchableOpacity style={styles.unblockPrompt} onPress={()=>toggleDay(selectedDate)} disabled={saving}>
                {saving?<ActivityIndicator color="#ff6b35" size="small"/>:<Text style={styles.unblockPromptText}>Tap to unblock this day</Text>}
              </TouchableOpacity>
            )}
          </View>
          <View style={{height:100}}/>
        </ScrollView>
      )}

      {/* Week view */}
      {calView==='week' && (
        <View style={{flex:1}}>
          <View style={styles.weekNavRow}>
            <TouchableOpacity style={styles.navBtn} onPress={navPrev}><ChevronLeft size={20} color="#111"/></TouchableOpacity>
            <Text style={styles.weekNavLabel}>{getNavLabel()}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={navNext}><ChevronRight size={20} color="#111"/></TouchableOpacity>
          </View>
          <WeekView weekStart={weekStart} bookingsByDate={bookingsByDate} blocked={blocked} recurring={recurring} holidays={holidays} onDayPress={ds=>{setSelectedDate(ds);setCalView('day')}} onBookingPress={setSelectedBooking} />
        </View>
      )}

      {/* Day view */}
      {calView==='day' && (
        <View style={{flex:1}}>
          <View style={styles.weekNavRow}>
            <TouchableOpacity style={styles.navBtn} onPress={navPrev}><ChevronLeft size={20} color="#111"/></TouchableOpacity>
            <Text style={styles.weekNavLabel}>{new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={navNext}><ChevronRight size={20} color="#111"/></TouchableOpacity>
          </View>
          <DayView dateStr={selectedDate} bookings={selectedBookings} providerHours={selectedHours} blocked={blocked} recurring={recurring} holidays={holidays} onBookingPress={setSelectedBooking} />
          {selectedBookings.length===0&&selectedStatus==='available'&&(
            <View style={styles.dayEmptyCard}>
              <Text style={styles.dayEmptyText}>No bookings · {selectedSlots.filter((s:any)=>s.available).length} slots open</Text>
            </View>
          )}
        </View>
      )}

      <ProviderNav />

      {/* Settings sheet */}
      <SettingsSheet
        visible={settingsSheet}
        onClose={()=>setSettingsSheet(false)}
        userId={userId}
        hours={hours}
        setHours={setHours}
        recurring={recurring}
        toggleRecurring={toggleRecurring}
        settings={settings}
        setSettings={setSettings}
        saveAll={saveAll}
      />

      {/* Booking detail modal */}
      {selectedBooking && <BookingDetailModal booking={selectedBooking} onClose={()=>setSelectedBooking(null)} />}

      {/* Day sheet */}
      <Modal visible={!!daySheet} animationType="slide" transparent>
        <View style={ms.overlay}>
          <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={()=>setDaySheet(null)}/>
          <View style={ms.container}>
            <View style={ms.handle}/>
            <View style={ms.row}>
              <Text style={ms.title}>{daySheet?new Date(daySheet+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}):''}</Text>
              <TouchableOpacity onPress={()=>setDaySheet(null)} style={ms.closeBtn}><X size={18} color="#111"/></TouchableOpacity>
            </View>
            {daySheet&&getDayStatus(daySheet)==='booked'?(
              <View style={ms.infoBox}><Text style={ms.infoText}>This day has a booking — it can't be blocked.</Text></View>
            ):(
              <>
                <TouchableOpacity style={ms.actionRow} onPress={()=>daySheet&&toggleDay(daySheet)} disabled={saving}>
                  <View style={ms.actionIcon}><Text style={{fontSize:22}}>{daySheet&&blocked.has(daySheet)?'🟢':'🔴'}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={ms.actionTitle}>{daySheet&&blocked.has(daySheet)?'Mark as available':'Block this day'}</Text>
                    <Text style={ms.actionSub}>{daySheet&&blocked.has(daySheet)?'Remove block':"Clients won't be able to book"}</Text>
                  </View>
                  {saving&&<ActivityIndicator color="#888" size="small"/>}
                </TouchableOpacity>
                <TouchableOpacity style={ms.actionRow} onPress={()=>{setDaySheet(null);setSettingsSheet(true)}}>
                  <View style={ms.actionIcon}><Text style={{fontSize:22}}>🏖️</Text></View>
                  <View style={{flex:1}}>
                    <Text style={ms.actionTitle}>Add holiday</Text>
                    <Text style={ms.actionSub}>Mark time off with a label</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Preview sheet */}
      <Modal visible={previewSheet} animationType="slide" transparent>
        <View style={ms.overlay}>
          <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={()=>setPreviewSheet(false)}/>
          <View style={[ms.container,{maxHeight:'85%'}]}>
            <View style={ms.handle}/>
            <View style={ms.row}>
              <View>
                <Text style={ms.title}>What clients see</Text>
                <Text style={ms.sub}>{new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</Text>
              </View>
              <TouchableOpacity onPress={()=>setPreviewSheet(false)} style={ms.closeBtn}><X size={18} color="#111"/></TouchableOpacity>
            </View>
            {services.length>1&&(
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,marginBottom:16}}>
                {services.map((svc:any)=>(
                  <TouchableOpacity key={svc.id} style={[ms.svcChip,previewService?.id===svc.id&&ms.svcChipActive]} onPress={()=>setPreviewService(svc)}>
                    <Text style={[ms.svcChipText,previewService?.id===svc.id&&ms.svcChipTextActive]}>{svc.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedStatus!=='available'?(
                <View style={ms.infoBox}><Text style={ms.infoText}>{selectedStatus==='blocked'?"This day is blocked — clients won't see any slots.":'This day is fully booked.'}</Text></View>
              ):!selectedHours?(
                <View style={ms.infoBox}><Text style={ms.infoText}>No business hours set for this day.</Text></View>
              ):selectedSlots.length===0?(
                <View style={ms.infoBox}><Text style={ms.infoText}>No slots fit in your working hours.</Text></View>
              ):(
                <View style={{gap:10}}>
                  <Text style={ms.previewNote}>{selectedSlots.filter((sl:any)=>sl.available).length} slots · {previewService?.title??'service'}{settings.buffer_mins>0?` · ${settings.buffer_mins}m buffer`:''}</Text>
                  {selectedSlots.map((slot:any,i:number)=>(
                    <View key={i} style={[ms.previewSlot,!slot.available&&ms.previewSlotBooked]}>
                      <Text style={[ms.previewSlotTime,!slot.available&&ms.previewSlotTimeBooked]}>{formatSlotTime(slot.start)}</Text>
                      <Text style={[ms.previewSlotEnd,!slot.available&&ms.previewSlotTimeBooked]}>→ {formatSlotTime(slot.end)}</Text>
                      <View style={[ms.previewSlotStatus,{backgroundColor:slot.available?'#d1fae5':'#fee2e2'}]}>
                        <Text style={{fontSize:11,fontWeight:'600',color:slot.available?'#065f46':'#991b1b'}}>{slot.available?'Open':'Booked'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── All styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#fff'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  content:{paddingHorizontal:20,paddingTop:8},
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:56,paddingBottom:8},
  navBtn:{width:36,height:36,borderRadius:18,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  navLabel:{fontSize:17,fontWeight:'700',color:'#111'},
  topRight:{flexDirection:'row',alignItems:'center',gap:8},
  switcher:{flexDirection:'row',marginHorizontal:20,marginBottom:8,backgroundColor:'#f5f5f5',borderRadius:12,padding:3,gap:2},
  switchBtn:{flex:1,paddingVertical:8,borderRadius:10,alignItems:'center'},
  switchBtnActive:{backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:0.08,shadowRadius:4,shadowOffset:{width:0,height:1},elevation:2},
  switchBtnText:{fontSize:13,fontWeight:'500',color:'#888'},
  switchBtnTextActive:{fontWeight:'700',color:'#111'},
  weekNavRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:8},
  weekNavLabel:{fontSize:15,fontWeight:'700',color:'#111'},
  dayLabels:{flexDirection:'row',marginBottom:4},
  dayLabel:{flex:1,textAlign:'center',fontSize:11,color:'#aaa',fontWeight:'500',textTransform:'uppercase',letterSpacing:0.3},
  grid:{flexDirection:'row',flexWrap:'wrap',marginBottom:8},
  cell:{width:'14.28%',aspectRatio:1,alignItems:'center',justifyContent:'center'},
  cellInRange:{backgroundColor:'#f5f5f5'},
  cellRangeStart:{borderTopLeftRadius:20,borderBottomLeftRadius:20},
  cellRangeEnd:{borderTopRightRadius:20,borderBottomRightRadius:20},
  cellInner:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  cellSelected:{backgroundColor:'#111'},
  cellToday:{borderWidth:1.5,borderColor:'#111'},
  cellBlocked:{opacity:0.4},
  cellText:{fontSize:14,color:'#111',fontWeight:'500'},
  cellTextPast:{color:'#d1d5db'},
  cellTextSelected:{color:'#fff',fontWeight:'700'},
  cellTextToday:{fontWeight:'700'},
  cellDot:{width:4,height:4,borderRadius:2,position:'absolute',bottom:3},
  cellDotAvailable:{backgroundColor:'#10b981'},
  cellDotBooked:{backgroundColor:'#ff6b35'},
  cellDotBlocked:{backgroundColor:'#d1d5db'},
  holidayDot:{width:4,height:4,borderRadius:2,position:'absolute',bottom:3,backgroundColor:'#a78bfa'},
  legend:{flexDirection:'row',gap:12,marginBottom:12,flexWrap:'wrap'},
  legendItem:{flexDirection:'row',alignItems:'center',gap:4},
  legendDot:{width:6,height:6,borderRadius:3},
  legendText:{fontSize:10,color:'#888'},
  selectionBar:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#f9f9f9',borderRadius:14,padding:14,marginBottom:16},
  selectionTitle:{fontSize:14,fontWeight:'600',color:'#111'},
  selectionBtnBlock:{backgroundColor:'#111',borderRadius:20,paddingHorizontal:14,paddingVertical:7},
  selectionBtnBlockText:{fontSize:13,fontWeight:'600',color:'#fff'},
  selectionBtnUnblock:{borderRadius:20,paddingHorizontal:14,paddingVertical:7,borderWidth:1,borderColor:'#e0e0e0'},
  selectionBtnUnblockText:{fontSize:13,fontWeight:'600',color:'#111'},
  dayPanel:{borderWidth:1,borderColor:'#f0f0f0',borderRadius:20,padding:18,marginBottom:16},
  dayPanelHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  dayPanelTitle:{fontSize:16,fontWeight:'700',color:'#111'},
  dayPanelSub:{fontSize:13,color:'#888',marginTop:4},
  dayPanelBtn:{width:36,height:36,borderRadius:18,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  sectionLabel:{fontSize:12,fontWeight:'600',color:'#888',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8},
  slotChip:{backgroundColor:'#f0fdf4',borderRadius:20,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:'#d1fae5'},
  slotChipBooked:{backgroundColor:'#f9f9f9',borderColor:'#e0e0e0'},
  slotChipText:{fontSize:13,fontWeight:'600',color:'#065f46'},
  slotChipTextBooked:{color:'#aaa'},
  setHoursPrompt:{marginTop:12,padding:12,borderRadius:12,backgroundColor:'#fff8f6'},
  setHoursPromptText:{fontSize:13,color:'#ff6b35',fontWeight:'500'},
  unblockPrompt:{marginTop:12,padding:12,borderRadius:12,backgroundColor:'#f9f9f9',alignItems:'center'},
  unblockPromptText:{fontSize:13,color:'#888'},
  dayEmptyCard:{margin:20,backgroundColor:'#f9f9f9',borderRadius:14,padding:16,alignItems:'center'},
  dayEmptyText:{fontSize:13,color:'#888'},
})

const sb = StyleSheet.create({
  row:{flexDirection:'row',gap:8,paddingHorizontal:20,marginBottom:8},
  card:{flex:1,backgroundColor:'#f9f9f9',borderRadius:12,padding:10,alignItems:'center',gap:3},
  value:{fontSize:14,fontWeight:'700',color:'#111'},
  label:{fontSize:10,color:'#888',fontWeight:'500'},
})

const appt = StyleSheet.create({
  card:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fafafa',borderRadius:14,padding:14},
  timeCol:{width:52,alignItems:'center'},
  time:{fontSize:13,fontWeight:'700',color:'#111'},
  duration:{fontSize:11,color:'#888',marginTop:2},
  divider:{width:1,height:40,backgroundColor:'#e0e0e0'},
  avatar:{width:36,height:36,borderRadius:18,backgroundColor:'#ff6b35',alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:12,fontWeight:'700',color:'#fff'},
  info:{flex:1},
  name:{fontSize:14,fontWeight:'600',color:'#111'},
  service:{fontSize:12,color:'#888',marginTop:1},
  answers:{fontSize:10,color:'#a78bfa',fontWeight:'600',marginTop:2},
  statusBadge:{alignSelf:'flex-start',borderRadius:6,paddingHorizontal:6,paddingVertical:2,marginTop:4},
  statusText:{fontSize:10,fontWeight:'600'},
})

const bm = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end'},
  backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.35)'},
  sheet:{backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'85%'},
  handle:{width:40,height:5,borderRadius:3,backgroundColor:'#e0e0e0',alignSelf:'center',marginTop:10,marginBottom:4},
  scroll:{paddingHorizontal:24},
  header:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:'#111',justifyContent:'center',alignItems:'center'},
  avatarText:{fontSize:18,fontWeight:'700',color:'#fff'},
  headerInfo:{flex:1},
  clientName:{fontSize:17,fontWeight:'700',color:'#111'},
  serviceName:{fontSize:13,color:'#888',marginTop:2},
  closeBtn:{width:28,height:28,borderRadius:14,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',borderRadius:20,paddingHorizontal:12,paddingVertical:6,marginBottom:12},
  statusDot:{width:6,height:6,borderRadius:3},
  statusText:{fontSize:12,fontWeight:'700'},
  divider:{height:1,backgroundColor:'#f5f5f5',marginVertical:14},
  row:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},
  rowInfo:{flex:1},
  rowLabel:{fontSize:11,color:'#aaa',marginBottom:4},
  rowValue:{fontSize:14,fontWeight:'500',color:'#111',marginBottom:2},
  priceCard:{backgroundColor:'#f9f9f9',borderRadius:14,padding:16,marginBottom:16},
  priceRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6},
  priceTotalRow:{borderTopWidth:1,borderTopColor:'#e0e0e0',marginTop:4,paddingTop:10},
  priceLabel:{fontSize:13,color:'#666'},
  priceValue:{fontSize:13,color:'#111'},
  priceTotalLabel:{fontSize:14,fontWeight:'700',color:'#111'},
  priceTotalValue:{fontSize:16,fontWeight:'700',color:'#111'},
  sectionTitle:{fontSize:14,fontWeight:'700',color:'#111',marginBottom:10},
  answerRow:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  answerQ:{fontSize:11,color:'#888',marginBottom:4},
  answerA:{fontSize:14,fontWeight:'500',color:'#111'},
})

const ss = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end'},
  backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.4)'},
  sheet:{backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'92%'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,paddingVertical:16},
  title:{fontSize:20,fontWeight:'700',color:'#111'},
  closeBtn:{width:32,height:32,borderRadius:16,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  tabs:{gap:8,paddingHorizontal:24,paddingVertical:8},
  tab:{paddingHorizontal:16,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#e0e0e0'},
  tabActive:{backgroundColor:'#111',borderColor:'#111'},
  tabText:{fontSize:13,fontWeight:'600',color:'#888'},
  tabTextActive:{color:'#fff'},
  content:{paddingHorizontal:24,paddingTop:8},
  hoursRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#f5f5f5',flexWrap:'wrap'},
  hoursDay:{flex:1,fontSize:15,fontWeight:'500',color:'#111'},
  hoursDayOff:{color:'#ccc'},
  timeRow:{flexDirection:'row',alignItems:'center',gap:6},
  timeInput:{width:56,textAlign:'center',fontSize:13,fontWeight:'600',color:'#111',borderWidth:1,borderColor:'#e0e0e0',borderRadius:10,paddingVertical:6},
  timeSep:{fontSize:13,color:'#888'},
  recurringRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  recurringDay:{fontSize:15,fontWeight:'500',color:'#111'},
  recurringSub:{fontSize:11,color:'#888',marginTop:2},
  sectionLabel:{fontSize:12,fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:0.5,marginTop:8},
  input:{borderWidth:1,borderColor:'#e0e0e0',borderRadius:12,paddingHorizontal:14,paddingVertical:10,fontSize:14,color:'#111'},
  addBtn:{backgroundColor:'#111',borderRadius:12,padding:14,alignItems:'center'},
  addBtnText:{fontSize:15,fontWeight:'600',color:'#fff'},
  holidayRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#f9f9f9',borderRadius:12,padding:14},
  holidayLabel:{fontSize:14,fontWeight:'600',color:'#111'},
  holidayDates:{fontSize:12,color:'#888',marginTop:2},
  removeBtn:{width:28,height:28,borderRadius:14,backgroundColor:'#fff0f0',alignItems:'center',justifyContent:'center'},
  ruleRow:{gap:8,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  ruleTitle:{fontSize:15,fontWeight:'600',color:'#111'},
  ruleSub:{fontSize:12,color:'#888',marginTop:2},
  bufferRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},
  bufferBtn:{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,borderColor:'#e0e0e0'},
  bufferBtnActive:{backgroundColor:'#111',borderColor:'#111'},
  bufferBtnText:{fontSize:12,color:'#888',fontWeight:'500'},
  bufferBtnTextActive:{color:'#fff'},
  saveBtn:{backgroundColor:'#111',borderRadius:16,padding:16,alignItems:'center',margin:24,marginTop:8},
  saveBtnText:{fontSize:16,fontWeight:'600',color:'#fff'},
})

const wk = StyleSheet.create({
  container:{flex:1},
  headerRow:{flexDirection:'row',paddingLeft:0,borderBottomWidth:1,borderBottomColor:'#f0f0f0'},
  timeGutter:{width:48},
  dayHeader:{flex:1,alignItems:'center',paddingVertical:8,gap:3},
  dayHeaderDow:{fontSize:10,fontWeight:'600',color:'#888',textTransform:'uppercase',letterSpacing:0.3},
  dayHeaderActive:{color:'#ff6b35'},
  dayHeaderNum:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'},
  dayHeaderNumActive:{backgroundColor:'#ff6b35'},
  dayHeaderNumText:{fontSize:12,fontWeight:'600',color:'#111'},
  dayHeaderNumTextActive:{color:'#fff'},
  dayBookingDot:{width:4,height:4,borderRadius:2,backgroundColor:'#ff6b35'},
  gridScroll:{flex:1},
  grid:{flexDirection:'row'},
  hourCell:{justifyContent:'flex-start',paddingTop:4,paddingRight:4},
  hourLabel:{fontSize:9,color:'#bbb',textAlign:'right'},
  dayCol:{flex:1,position:'relative',borderLeftWidth:1,borderLeftColor:'#f5f5f5'},
  hourLine:{borderTopWidth:1,borderTopColor:'#f5f5f5'},
  blockedOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.04)',alignItems:'center',justifyContent:'center'},
  blockedText:{fontSize:9,color:'#ccc',fontWeight:'600'},
  bookingBlock:{position:'absolute',left:2,right:2,borderRadius:6,padding:4,overflow:'hidden'},
  bookingConfirmed:{backgroundColor:'rgba(16,185,129,0.15)',borderLeftWidth:2,borderLeftColor:'#10b981'},
  bookingPending:{backgroundColor:'rgba(245,158,11,0.15)',borderLeftWidth:2,borderLeftColor:'#f59e0b'},
  bookingName:{fontSize:9,fontWeight:'700',color:'#111'},
  bookingService:{fontSize:8,color:'#666'},
})

const dv = StyleSheet.create({
  scroll:{flex:1},
  grid:{flexDirection:'row',paddingBottom:40},
  timeGutter:{width:52},
  hourCell:{justifyContent:'flex-start',paddingTop:4,paddingRight:8},
  hourLabel:{fontSize:10,color:'#bbb',textAlign:'right'},
  mainCol:{flex:1,position:'relative',borderLeftWidth:1,borderLeftColor:'#f0f0f0'},
  hourLine:{borderTopWidth:1,borderTopColor:'#f5f5f5'},
  workingHours:{position:'absolute',left:0,right:0,backgroundColor:'rgba(16,185,129,0.04)'},
  breakTime:{position:'absolute',left:0,right:0,backgroundColor:'rgba(0,0,0,0.04)',justifyContent:'center',alignItems:'center'},
  breakLabel:{fontSize:9,color:'#bbb',fontWeight:'600'},
  blockedOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.03)',alignItems:'center',justifyContent:'center'},
  blockedText:{fontSize:13,color:'#ccc',fontWeight:'600'},
  nowLine:{position:'absolute',left:-6,right:0,flexDirection:'row',alignItems:'center'},
  nowDot:{width:10,height:10,borderRadius:5,backgroundColor:'#ff6b35'},
  nowLineBar:{flex:1,height:1.5,backgroundColor:'#ff6b35',opacity:0.5},
  bookingBlock:{position:'absolute',left:8,right:8,borderRadius:10,padding:10,overflow:'hidden'},
  bookingConfirmed:{backgroundColor:'rgba(16,185,129,0.12)',borderLeftWidth:3,borderLeftColor:'#10b981'},
  bookingPending:{backgroundColor:'rgba(245,158,11,0.12)',borderLeftWidth:3,borderLeftColor:'#f59e0b'},
  bookingName:{fontSize:12,fontWeight:'700',color:'#111',marginBottom:2},
  bookingService:{fontSize:11,color:'#666',marginBottom:2},
  bookingTime:{fontSize:10,color:'#888'},
})

const ms = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end'},
  backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.4)'},
  container:{backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:24,paddingBottom:40},
  handle:{width:40,height:4,borderRadius:2,backgroundColor:'#e0e0e0',alignSelf:'center',marginTop:12,marginBottom:20},
  row:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:4},
  closeBtn:{width:32,height:32,borderRadius:16,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  title:{fontSize:20,fontWeight:'700',color:'#111'},
  sub:{fontSize:14,color:'#888',marginBottom:16,lineHeight:20},
  infoBox:{backgroundColor:'#f9f9f9',borderRadius:14,padding:16,marginBottom:16},
  infoText:{fontSize:14,color:'#888',lineHeight:20},
  actionRow:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  actionIcon:{width:44,height:44,borderRadius:12,backgroundColor:'#f9f9f9',alignItems:'center',justifyContent:'center'},
  actionTitle:{fontSize:16,fontWeight:'600',color:'#111'},
  actionSub:{fontSize:13,color:'#888',marginTop:2},
  svcChip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#e0e0e0'},
  svcChipActive:{backgroundColor:'#111',borderColor:'#111'},
  svcChipText:{fontSize:13,fontWeight:'500',color:'#888'},
  svcChipTextActive:{color:'#fff'},
  previewNote:{fontSize:13,color:'#888',marginBottom:12},
  previewSlot:{flexDirection:'row',alignItems:'center',backgroundColor:'#f0fdf4',borderRadius:14,padding:14,gap:8},
  previewSlotBooked:{backgroundColor:'#fef2f2'},
  previewSlotTime:{fontSize:15,fontWeight:'700',color:'#065f46',flex:1},
  previewSlotEnd:{fontSize:13,color:'#065f46'},
  previewSlotTimeBooked:{color:'#991b1b'},
  previewSlotStatus:{borderRadius:8,paddingHorizontal:8,paddingVertical:3},
})
