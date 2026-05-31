import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  TextInput, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import {
  ChevronLeft, X, Check, Clock, Users, MapPin,
  DollarSign, FileText, HelpCircle, Shield,
  Plus, Trash2, ChevronDown, ChevronUp,
  Calendar, Star, Globe, Package, Zap,
} from 'lucide-react-native'

const { width } = Dimensions.get('window')

// ── Types ─────────────────────────────────────────────────────────────────────
type Archetype = 'time_based' | 'deliverable' | 'in_person'
type PricingType = 'per_session' | 'per_hour' | 'per_day' | 'per_project' | 'free'
type ServiceType = 'mobile' | 'studio' | 'online'
type QuestionType = 'short_text' | 'multiple_choice' | 'yes_no'
type CancellationLabel = 'flexible' | 'moderate' | 'strict' | 'custom'

interface Question {
  id: string; type: QuestionType; question: string
  options?: string[]; required: boolean
}
interface DaySchedule { active: boolean; start: string; end: string }
type WeekSchedule = Record<number, DaySchedule>

// ── Constants ─────────────────────────────────────────────────────────────────
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const ARCHETYPES = [
  {
    value: 'time_based' as Archetype,
    label: 'Time-based',
    desc: 'Clients book a specific time slot with you',
    example: 'e.g. Hair appointment, driving lesson, personal training',
    icon: Clock,
  },
  {
    value: 'in_person' as Archetype,
    label: 'In-person service',
    desc: 'You meet the client at a location',
    example: 'e.g. Mobile nails, house cleaning, tattoo session',
    icon: MapPin,
  },
  {
    value: 'deliverable' as Archetype,
    label: 'Deliverable',
    desc: 'You complete and deliver work — no live booking needed',
    example: 'e.g. Logo design, edit, mix & master, content pack',
    icon: Package,
  },
]

const PRICING_OPTIONS: { value: PricingType; label: string; desc: string }[] = [
  { value: 'per_session', label: 'Per session', desc: 'Fixed price per booking' },
  { value: 'per_hour', label: 'Per hour', desc: 'Hourly rate' },
  { value: 'per_day', label: 'Per day', desc: 'Full day rate' },
  { value: 'per_project', label: 'Per project', desc: 'One-off project price' },
  { value: 'free', label: 'Free', desc: 'No charge to client' },
]

const SERVICE_TYPES: { value: ServiceType; label: string; desc: string; icon: any }[] = [
  { value: 'mobile', label: 'I travel to the client', desc: 'You go to them', icon: MapPin },
  { value: 'studio', label: 'Client comes to me', desc: 'They come to your location', icon: Star },
  { value: 'online', label: 'Online / remote', desc: 'Virtual session', icon: Globe },
]

const DURATION_PRESETS = [
  { label: '15m', value: 15 }, { label: '30m', value: 30 },
  { label: '45m', value: 45 }, { label: '1h', value: 60 },
  { label: '1.5h', value: 90 }, { label: '2h', value: 120 },
  { label: '3h', value: 180 }, { label: '4h', value: 240 },
]

const CANCELLATION_PRESETS = [
  { label: 'flexible' as const, title: 'Flexible', desc: 'Free cancellation any time', window: 0, fee: 0 },
  { label: 'moderate' as const, title: 'Moderate', desc: '50% fee if cancelled within 24 hours', window: 24, fee: 50 },
  { label: 'strict' as const, title: 'Strict', desc: '100% fee if cancelled within 48 hours', window: 48, fee: 100 },
]

const DEFAULT_SCHEDULE: WeekSchedule = {
  0: { active: false, start: '09:00', end: '17:00' },
  1: { active: true, start: '09:00', end: '17:00' },
  2: { active: true, start: '09:00', end: '17:00' },
  3: { active: true, start: '09:00', end: '17:00' },
  4: { active: true, start: '09:00', end: '17:00' },
  5: { active: true, start: '09:00', end: '17:00' },
  6: { active: false, start: '09:00', end: '17:00' },
}

function uid() { return Math.random().toString(36).slice(2, 9) }
function formatDuration(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); const min = m % 60
  return min ? `${h}h ${min}m` : `${h}h`
}

// ── Dynamic flow based on archetype ──────────────────────────────────────────
type Step =
  | 'archetype'
  | 'basics'
  | 'details'
  | 'pricing'
  | 'schedule'
  | 'deliverable_details'
  | 'questions'
  | 'policies'
  | 'review'

function getFlow(arch: Archetype | null): Step[] {
  if (!arch) return ['archetype']
  if (arch === 'deliverable') return [
    'archetype', 'basics', 'pricing',
    'deliverable_details', 'questions', 'policies', 'review'
  ]
  if (arch === 'in_person') return [
    'archetype', 'basics', 'details',
    'pricing', 'schedule', 'questions', 'policies', 'review'
  ]
  // time_based
  return [
    'archetype', 'basics', 'details',
    'pricing', 'schedule', 'questions', 'policies', 'review'
  ]
}

const STEP_META: Record<Step, { title: string; sub: string }> = {
  archetype: { title: 'What type of service is this?', sub: 'This controls how clients book you and how your calendar works.' },
  basics: { title: 'Name your service', sub: 'Give it a clear title and description.' },
  details: { title: 'Service details', sub: 'Duration, capacity, and how it\'s delivered.' },
  pricing: { title: 'Set your price', sub: 'You decide how you charge.' },
  schedule: { title: 'Set your availability', sub: 'When can clients book this service? This syncs directly with your calendar.' },
  deliverable_details: { title: 'Delivery details', sub: 'Set what the client receives and when.' },
  questions: { title: 'Booking questions', sub: 'Ask clients what you need before they book.' },
  policies: { title: 'Cancellation policy', sub: 'Protect your time and set expectations.' },
  review: { title: 'Review & publish', sub: 'Everything look good? Go live.' },
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={p.wrap}>
      <View style={p.track}>
        <View style={[p.fill, { width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} style={[t.track, value && t.trackOn]} activeOpacity={0.85}>
      <View style={[t.thumb, value && t.thumbOn]} />
    </TouchableOpacity>
  )
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={ti.label}>{label}</Text>
      <TextInput
        style={ti.input}
        value={value}
        onChangeText={onChange}
        placeholder="09:00"
        placeholderTextColor="#ccc"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    </View>
  )
}

function Divider() { return <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 6 }} /> }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CreateListing() {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 0 — archetype
  const [archetype, setArchetype] = useState<Archetype | null>(null)

  // Step: basics
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Step: details
  const [serviceType, setServiceType] = useState<ServiceType>('studio')
  const [location, setLocation] = useState('')
  const [durationMins, setDurationMins] = useState(60)
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [customDuration, setCustomDuration] = useState('')
  const [maxClients, setMaxClients] = useState(1)

  // Step: pricing
  const [pricingType, setPricingType] = useState<PricingType>('per_session')
  const [price, setPrice] = useState('')

  // Step: schedule
  const [schedule, setSchedule] = useState<WeekSchedule>({ ...DEFAULT_SCHEDULE })
  const [sameTime, setSameTime] = useState(true)

  // Step: deliverable details
  const [deliveryTimeframe, setDeliveryTimeframe] = useState('')
  const [revisions, setRevisions] = useState('')
  const [clientReceives, setClientReceives] = useState('')

  // Step: questions
  const [questions, setQuestions] = useState<Question[]>([])
  const [addingQ, setAddingQ] = useState(false)
  const [draftQ, setDraftQ] = useState<Partial<Question>>({ type: 'short_text', required: false })

  // Step: policies
  const [cancelLabel, setCancelLabel] = useState<CancellationLabel>('moderate')
  const [cancelWindow, setCancelWindow] = useState('24')
  const [cancelFee, setCancelFee] = useState('50')

  const flow = getFlow(archetype)
  const step = flow[stepIdx] as Step
  const meta = STEP_META[step]
  const isLast = stepIdx === flow.length - 1

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  function validate(): boolean {
    if (step === 'archetype' && !archetype) { Alert.alert('Choose a service type to continue'); return false }
    if (step === 'basics') {
      if (!title.trim()) { Alert.alert('Add a name for your service'); return false }
      if (!description.trim()) { Alert.alert('Add a description'); return false }
    }
    if (step === 'details' && serviceType !== 'online' && !location.trim()) {
      Alert.alert('Add your location'); return false
    }
    if (step === 'pricing' && pricingType !== 'free' && !price) {
      Alert.alert('Add your price'); return false
    }
    if (step === 'deliverable_details') {
      if (!deliveryTimeframe || !clientReceives) { Alert.alert('Fill in the delivery details'); return false }
    }
    return true
  }

  function goNext() {
    if (!validate()) return
    if (stepIdx < flow.length - 1) setStepIdx(i => i + 1)
    else publish()
  }

  function goBack() {
    if (addingQ) { setAddingQ(false); setDraftQ({ type: 'short_text', required: false }); return }
    if (stepIdx === 0) router.back()
    else setStepIdx(i => i - 1)
  }

  function updateDay(dow: number, key: keyof DaySchedule, val: any) {
    if (sameTime && (key === 'start' || key === 'end')) {
      const updated = { ...schedule }
      Object.keys(updated).forEach(d => { updated[Number(d)] = { ...updated[Number(d)], [key]: val } })
      setSchedule(updated)
    } else {
      setSchedule(prev => ({ ...prev, [dow]: { ...prev[dow], [key]: val } }))
    }
  }

  function getEffectiveDuration(): number {
    if (isCustomDuration) { const p = parseInt(customDuration); return isNaN(p) ? 60 : p }
    return durationMins
  }

  function getPricePence(): number {
    if (pricingType === 'free') return 0
    const p = parseFloat(price); return isNaN(p) ? 0 : Math.round(p * 100)
  }

  function getCancelPolicy() {
    if (cancelLabel === 'custom') return { label: 'custom', window_hours: parseInt(cancelWindow) || 24, fee_percent: parseInt(cancelFee) || 50 }
    const preset = CANCELLATION_PRESETS.find(p => p.label === cancelLabel)!
    return { label: cancelLabel, window_hours: preset.window, fee_percent: preset.fee }
  }

  async function publish() {
    if (!userId || !archetype) return
    setLoading(true)
    try {
      const dur = getEffectiveDuration()
      const policy = getCancelPolicy()
      const pricePence = getPricePence()

      const { data: opp, error } = await supabase.from('opportunities').insert({
        provider_id: userId,
        title: title.trim(),
        description: description.trim(),
        price_pence: pricePence,
        status: 'active',
        booking_questions: questions,
        cancellation_window_hours: policy.window_hours,
        cancellation_fee_percent: policy.fee_percent,
        cancellation_policy_label: policy.label,
        metadata: {
          archetype,
          duration: archetype !== 'deliverable' ? dur : null,
          maxClients,
          serviceType: archetype !== 'deliverable' ? serviceType : null,
          location,
          pricingType,
          ...(archetype === 'deliverable' ? {
            deliveryTimeframe,
            revisions,
            clientReceives,
          } : {}),
        },
      }).select().single()

      if (error || !opp) { Alert.alert('Failed to publish', error?.message); setLoading(false); return }

      // Write service_availability for time-based and in-person only
      if (archetype !== 'deliverable') {
        const rows = Object.entries(schedule)
          .filter(([_, d]) => d.active)
          .map(([dow, d]) => ({
            opportunity_id: opp.id,
            provider_id: userId,
            day_of_week: parseInt(dow),
            start_time: d.start,
            end_time: d.end,
            is_active: true,
          }))
        if (rows.length > 0) await supabase.from('service_availability').insert(rows)
      }

      Alert.alert('Service live! 🎉', `${title} is now visible on Pthway.`)
      router.replace('/provider/services' as any)
    } catch (e: any) {
      Alert.alert('Something went wrong', e.message)
    }
    setLoading(false)
  }

  const activeDays = Object.values(schedule).filter(d => d.active).length
  const dur = getEffectiveDuration()
  const pricePence = getPricePence()
  const fee = pricePence > 0 ? Math.round(pricePence * 0.03 + 40) : 0

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={goBack}>
          <ChevronLeft size={22} color="#222" />
        </TouchableOpacity>
        <Text style={s.headerLabel}>
          {addingQ ? 'New question' : `${stepIdx + 1} of ${flow.length}`}
        </Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <X size={20} color="#222" />
        </TouchableOpacity>
      </View>

      <ProgressBar current={stepIdx + 1} total={flow.length} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step title */}
          {!addingQ && (
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>{meta.title}</Text>
              <Text style={s.stepSub}>{meta.sub}</Text>
            </View>
          )}

          {/* ── Archetype ── */}
          {step === 'archetype' && (
            <View style={s.body}>
              {ARCHETYPES.map(arch => (
                <TouchableOpacity
                  key={arch.value}
                  style={[f.card, archetype === arch.value && f.cardActive]}
                  onPress={() => setArchetype(arch.value)}
                  activeOpacity={0.85}
                >
                  <View style={[f.cardIcon, archetype === arch.value && f.cardIconActive]}>
                    <arch.icon size={20} color={archetype === arch.value ? '#fff' : '#888'} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[f.cardLabel, archetype === arch.value && f.cardLabelActive]}>{arch.label}</Text>
                    <Text style={f.cardDesc}>{arch.desc}</Text>
                    <Text style={f.cardExample}>{arch.example}</Text>
                  </View>
                  {archetype === arch.value && (
                    <View style={f.checkCircle}><Check size={14} color="#fff" /></View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Archetype → Calendar relationship explanation */}
              {archetype && (
                <View style={f.archetypeNote}>
                  {archetype === 'time_based' && (
                    <>
                      <Zap size={14} color="#222" strokeWidth={1.5} />
                      <Text style={f.archetypeNoteText}>
                        <Text style={{ fontWeight: '700' }}>Time-based</Text> — Clients pick a slot from your live calendar. You set your hours per service and the scheduling engine handles the rest. Buffers, conflicts, and availability are all automated.
                      </Text>
                    </>
                  )}
                  {archetype === 'in_person' && (
                    <>
                      <MapPin size={14} color="#222" strokeWidth={1.5} />
                      <Text style={f.archetypeNoteText}>
                        <Text style={{ fontWeight: '700' }}>In-person</Text> — Same as time-based but includes your location. Clients book a slot, you confirm, and your calendar blocks the time automatically.
                      </Text>
                    </>
                  )}
                  {archetype === 'deliverable' && (
                    <>
                      <Package size={14} color="#222" strokeWidth={1.5} />
                      <Text style={f.archetypeNoteText}>
                        <Text style={{ fontWeight: '700' }}>Deliverable</Text> — No live slots. Clients request the work, you accept, then deliver by the agreed timeframe. Your calendar is not affected.
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Basics ── */}
          {step === 'basics' && (
            <View style={s.body}>
              <Text style={f.label}>Service name</Text>
              <TextInput
                style={f.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder={
                  archetype === 'deliverable' ? 'e.g. Logo design package'
                  : archetype === 'in_person' ? 'e.g. Mobile gel manicure'
                  : 'e.g. 1-on-1 driving lesson'
                }
                placeholderTextColor="#bbb"
                maxLength={60}
                autoFocus
              />
              <Text style={f.charHint}>{title.length}/60</Text>

              <Text style={[f.label, { marginTop: 24 }]}>Description</Text>
              <Text style={f.hint}>
                {archetype === 'deliverable'
                  ? 'Describe what the client gets, your process, and any requirements.'
                  : 'What\'s included, what to expect, and what makes this session special.'}
              </Text>
              <TextInput
                style={f.descInput}
                value={description}
                onChangeText={setDescription}
                placeholder={
                  archetype === 'deliverable'
                    ? 'Includes 3 logo concepts, 2 rounds of revisions, final PNG + SVG files...'
                    : 'Includes a full consultation, shaping, colour, and aftercare advice. All nail types welcome...'
                }
                placeholderTextColor="#bbb"
                multiline
                maxLength={600}
                textAlignVertical="top"
              />
              <Text style={f.charHint}>{description.length}/600</Text>
            </View>
          )}

          {/* ── Details (time_based + in_person only) ── */}
          {step === 'details' && (
            <View style={s.body}>
              {/* Delivery type */}
              <Text style={f.label}>How is this delivered?</Text>
              {SERVICE_TYPES
                .filter(st => archetype === 'in_person' ? st.value !== 'online' : true)
                .map(st => (
                  <TouchableOpacity
                    key={st.value}
                    style={[f.card, serviceType === st.value && f.cardActive]}
                    onPress={() => setServiceType(st.value)}
                    activeOpacity={0.85}
                  >
                    <View style={[f.cardIcon, serviceType === st.value && f.cardIconActive]}>
                      <st.icon size={18} color={serviceType === st.value ? '#fff' : '#888'} strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[f.cardLabel, serviceType === st.value && f.cardLabelActive]}>{st.label}</Text>
                      <Text style={f.cardDesc}>{st.desc}</Text>
                    </View>
                    {serviceType === st.value && <View style={f.checkCircle}><Check size={14} color="#fff" /></View>}
                  </TouchableOpacity>
                ))}

              {/* Location */}
              {serviceType !== 'online' && (
                <>
                  <Text style={[f.label, { marginTop: 24 }]}>
                    {serviceType === 'mobile' ? 'Your base location' : 'Your studio / address'}
                  </Text>
                  <TextInput
                    style={f.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. North London, N1"
                    placeholderTextColor="#bbb"
                  />
                </>
              )}

              {/* Duration */}
              <Text style={[f.label, { marginTop: 24 }]}>Session duration</Text>
              <View style={f.chipRow}>
                {DURATION_PRESETS.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    style={[f.chip, !isCustomDuration && durationMins === d.value && f.chipActive]}
                    onPress={() => { setDurationMins(d.value); setIsCustomDuration(false) }}
                  >
                    <Text style={[f.chipText, !isCustomDuration && durationMins === d.value && f.chipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[f.chip, isCustomDuration && f.chipActive]}
                  onPress={() => setIsCustomDuration(true)}
                >
                  <Text style={[f.chipText, isCustomDuration && f.chipTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {isCustomDuration && (
                <View style={f.customDurRow}>
                  <TextInput
                    style={f.customDurInput}
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    placeholder="e.g. 75"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    autoFocus
                  />
                  <Text style={f.customDurUnit}>minutes</Text>
                  {customDuration ? <Text style={f.customDurResult}>{formatDuration(parseInt(customDuration) || 0)}</Text> : null}
                </View>
              )}

              {/* Max clients */}
              <Text style={[f.label, { marginTop: 24 }]}>Max clients per slot</Text>
              <Text style={f.hint}>Most services are 1-to-1. Increase for group sessions.</Text>
              <View style={f.counter}>
                <TouchableOpacity style={f.counterBtn} onPress={() => setMaxClients(c => Math.max(1, c - 1))}>
                  <Text style={f.counterBtnText}>−</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={f.counterVal}>{maxClients}</Text>
                  <Text style={f.counterSub}>{maxClients === 1 ? '1-to-1' : 'Group'}</Text>
                </View>
                <TouchableOpacity style={f.counterBtn} onPress={() => setMaxClients(c => Math.min(50, c + 1))}>
                  <Text style={f.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Pricing ── */}
          {step === 'pricing' && (
            <View style={s.body}>
              <Text style={f.label}>How do you charge?</Text>
              {PRICING_OPTIONS
                .filter(opt => archetype === 'deliverable'
                  ? ['per_project', 'free'].includes(opt.value)
                  : ['per_session', 'per_hour', 'per_day', 'free'].includes(opt.value)
                )
                .map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[f.card, pricingType === opt.value && f.cardActive]}
                    onPress={() => setPricingType(opt.value)}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[f.cardLabel, pricingType === opt.value && f.cardLabelActive]}>{opt.label}</Text>
                      <Text style={f.cardDesc}>{opt.desc}</Text>
                    </View>
                    {pricingType === opt.value && <View style={f.checkCircle}><Check size={14} color="#fff" /></View>}
                  </TouchableOpacity>
                ))}

              {pricingType !== 'free' && (
                <>
                  <Text style={[f.label, { marginTop: 28 }]}>Your rate</Text>
                  <View style={f.priceRow}>
                    <View style={f.pricePre}><Text style={f.pricePreText}>£</Text></View>
                    <TextInput
                      style={f.priceInput}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0.00"
                      placeholderTextColor="#bbb"
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <View style={f.priceSuf}>
                      <Text style={f.priceSufText}>
                        {pricingType === 'per_hour' ? '/ hr'
                        : pricingType === 'per_day' ? '/ day'
                        : pricingType === 'per_project' ? '/ project'
                        : '/ session'}
                      </Text>
                    </View>
                  </View>
                  {price ? (
                    <View style={f.breakdown}>
                      <View style={f.breakdownRow}>
                        <Text style={f.breakdownLabel}>Your price</Text>
                        <Text style={f.breakdownVal}>£{parseFloat(price).toFixed(2)}</Text>
                      </View>
                      <View style={f.breakdownRow}>
                        <Text style={f.breakdownLabel}>Platform fee (3% + 40p)</Text>
                        <Text style={f.breakdownVal}>£{(parseFloat(price) * 0.03 + 0.40).toFixed(2)}</Text>
                      </View>
                      <Divider />
                      <View style={f.breakdownRow}>
                        <Text style={[f.breakdownLabel, { fontWeight: '700', color: '#222' }]}>You receive</Text>
                        <Text style={[f.breakdownVal, { fontWeight: '700', color: '#222' }]}>
                          £{Math.max(0, parseFloat(price) - parseFloat(price) * 0.03 - 0.40).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          )}

          {/* ── Schedule (time_based + in_person only) ── */}
          {step === 'schedule' && (
            <View style={s.body}>
              {/* How this works note */}
              <View style={f.scheduleInfo}>
                <Calendar size={14} color="#222" strokeWidth={1.5} />
                <Text style={f.scheduleInfoText}>
                  These hours are specific to <Text style={{ fontWeight: '700' }}>{title}</Text>. They live in your calendar and the scheduling engine uses them to generate slots for customers. Your global calendar settings (holidays, days off, buffer time) still apply on top.
                </Text>
              </View>

              {/* Same time toggle */}
              <View style={f.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={f.toggleLabel}>Same hours every active day</Text>
                  <Text style={f.toggleSub}>Turn off to customise hours per day</Text>
                </View>
                <Toggle value={sameTime} onChange={setSameTime} />
              </View>

              <View style={{ height: 8 }} />

              {DAY_SHORT.map((name, dow) => {
                const day = schedule[dow]
                return (
                  <View key={dow} style={f.dayRow}>
                    <TouchableOpacity
                      style={[f.dayTag, day.active && f.dayTagActive]}
                      onPress={() => {
                        setSchedule(prev => ({ ...prev, [dow]: { ...prev[dow], active: !prev[dow].active } }))
                      }}
                    >
                      <Text style={[f.dayTagText, day.active && f.dayTagTextActive]}>{name}</Text>
                    </TouchableOpacity>
                    {day.active ? (
                      <View style={f.dayTimes}>
                        <TimeInput label="Opens" value={day.start} onChange={v => updateDay(dow, 'start', v)} />
                        <Text style={f.timeSep}>–</Text>
                        <TimeInput label="Closes" value={day.end} onChange={v => updateDay(dow, 'end', v)} />
                      </View>
                    ) : (
                      <Text style={f.dayOff}>Unavailable</Text>
                    )}
                  </View>
                )
              })}

              <View style={f.scheduleSummary}>
                <Text style={f.scheduleSummaryText}>
                  {activeDays === 0 ? '⚠️ No active days — clients won\'t be able to book' : `✓ Available ${activeDays} day${activeDays > 1 ? 's' : ''} a week`}
                </Text>
              </View>
            </View>
          )}

          {/* ── Deliverable details (deliverable only) ── */}
          {step === 'deliverable_details' && (
            <View style={s.body}>
              <Text style={f.label}>Delivery timeframe</Text>
              <Text style={f.hint}>How long does the work take from when you accept?</Text>
              <TextInput
                style={f.input}
                value={deliveryTimeframe}
                onChangeText={setDeliveryTimeframe}
                placeholder="e.g. 3–5 working days"
                placeholderTextColor="#bbb"
                autoFocus
              />

              <Text style={[f.label, { marginTop: 24 }]}>Revisions included</Text>
              <TextInput
                style={f.input}
                value={revisions}
                onChangeText={setRevisions}
                placeholder="e.g. 2 rounds of revisions"
                placeholderTextColor="#bbb"
              />

              <Text style={[f.label, { marginTop: 24 }]}>What the client receives</Text>
              <Text style={f.hint}>Be specific — this is what the client sees before booking.</Text>
              <TextInput
                multiline
                style={[f.input, { minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }]}
                value={clientReceives}
                onChangeText={setClientReceives}
                placeholder="e.g. 3 logo concepts, source files (AI + SVG), PNG exports in all sizes"
                placeholderTextColor="#bbb"
              />
            </View>
          )}

          {/* ── Questions ── */}
          {step === 'questions' && (
            <View style={s.body}>
              {/* Question list */}
              {questions.length > 0 && (
                <View style={{ gap: 10, marginBottom: 20 }}>
                  {questions.map((q, i) => (
                    <View key={q.id} style={f.qCard}>
                      <View style={f.qNum}><Text style={f.qNumText}>{i + 1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={f.qText}>{q.question}</Text>
                        <View style={f.qMeta}>
                          <Text style={f.qType}>{q.type === 'short_text' ? 'Text' : q.type === 'multiple_choice' ? 'Multiple choice' : 'Yes / No'}</Text>
                          {q.required && <Text style={f.qRequired}>Required</Text>}
                        </View>
                        {q.options && <Text style={f.qOptions}>{q.options.join(' · ')}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}>
                        <Trash2 size={16} color="#dc2626" strokeWidth={1.5} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add question inline editor */}
              {!addingQ ? (
                <>
                  <TouchableOpacity
                    style={f.addQBtn}
                    onPress={() => { setAddingQ(true); setDraftQ({ type: 'short_text', required: false, options: ['', ''] }) }}
                  >
                    <Plus size={18} color="#222" strokeWidth={1.5} />
                    <Text style={f.addQText}>Add a question</Text>
                  </TouchableOpacity>
                  {questions.length === 0 && (
                    <View style={f.qEmpty}>
                      <HelpCircle size={32} color="#d0d0d0" strokeWidth={1.5} />
                      <Text style={f.qEmptyTitle}>No questions yet</Text>
                      <Text style={f.qEmptyDesc}>
                        {archetype === 'deliverable'
                          ? 'Ask clients for a brief, reference images, or any other info you need.'
                          : 'Ask clients anything you need before confirming their booking.'}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={f.qEditor}>
                  <Text style={f.label}>Question type</Text>
                  <View style={f.chipRow}>
                    {(['short_text','multiple_choice','yes_no'] as QuestionType[]).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[f.chip, draftQ.type === t && f.chipActive]}
                        onPress={() => setDraftQ(d => ({ ...d, type: t }))}
                      >
                        <Text style={[f.chipText, draftQ.type === t && f.chipTextActive]}>
                          {t === 'short_text' ? 'Text' : t === 'multiple_choice' ? 'Multiple' : 'Yes / No'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[f.label, { marginTop: 16 }]}>Question</Text>
                  <TextInput
                    style={f.input}
                    value={draftQ.question ?? ''}
                    onChangeText={v => setDraftQ(d => ({ ...d, question: v }))}
                    placeholder={
                      archetype === 'deliverable'
                        ? 'e.g. Please describe what you need'
                        : 'e.g. Do you have any allergies?'
                    }
                    placeholderTextColor="#bbb"
                    autoFocus
                    maxLength={120}
                  />
                  {draftQ.type === 'multiple_choice' && (
                    <View style={{ marginTop: 16, gap: 8 }}>
                      <Text style={f.label}>Options</Text>
                      {(draftQ.options ?? []).map((opt, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[f.input, { flex: 1 }]}
                            value={opt}
                            onChangeText={v => {
                              const opts = [...(draftQ.options ?? [])]
                              opts[i] = v
                              if (i === opts.length - 1 && v.trim()) opts.push('')
                              setDraftQ(d => ({ ...d, options: opts }))
                            }}
                            placeholder={`Option ${i + 1}`}
                            placeholderTextColor="#bbb"
                          />
                          {(draftQ.options ?? []).length > 2 && (
                            <TouchableOpacity style={{ justifyContent: 'center' }} onPress={() => {
                              setDraftQ(d => ({ ...d, options: (d.options ?? []).filter((_, j) => j !== i) }))
                            }}><X size={16} color="#888" /></TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={[f.toggleRow, { marginTop: 16 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={f.toggleLabel}>Required</Text>
                      <Text style={f.toggleSub}>Client must answer before booking</Text>
                    </View>
                    <Toggle value={draftQ.required ?? false} onChange={v => setDraftQ(d => ({ ...d, required: v }))} />
                  </View>
                  <View style={f.qEditorBtns}>
                    <TouchableOpacity style={f.qCancel} onPress={() => { setAddingQ(false); setDraftQ({}) }}>
                      <Text style={f.qCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={f.qSave} onPress={() => {
                      if (!draftQ.question?.trim()) { Alert.alert('Add your question text'); return }
                      const q: Question = {
                        id: uid(), type: draftQ.type ?? 'short_text',
                        question: draftQ.question.trim(), required: draftQ.required ?? false,
                        ...(draftQ.type === 'multiple_choice' ? { options: (draftQ.options ?? []).filter(o => o.trim()) } : {}),
                      }
                      setQuestions(qs => [...qs, q]); setAddingQ(false); setDraftQ({})
                    }}>
                      <Text style={f.qSaveText}>Add question</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Policies ── */}
          {step === 'policies' && (
            <View style={s.body}>
              {CANCELLATION_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.label}
                  style={[f.card, cancelLabel === preset.label && f.cardActive]}
                  onPress={() => setCancelLabel(preset.label)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[f.cardLabel, cancelLabel === preset.label && f.cardLabelActive]}>{preset.title}</Text>
                    <Text style={f.cardDesc}>{preset.desc}</Text>
                  </View>
                  {cancelLabel === preset.label && <View style={f.checkCircle}><Check size={14} color="#fff" /></View>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[f.card, cancelLabel === 'custom' && f.cardActive]}
                onPress={() => setCancelLabel('custom')}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[f.cardLabel, cancelLabel === 'custom' && f.cardLabelActive]}>Custom</Text>
                  <Text style={f.cardDesc}>Set your own cancellation window and fee</Text>
                </View>
                {cancelLabel === 'custom' && <View style={f.checkCircle}><Check size={14} color="#fff" /></View>}
              </TouchableOpacity>

              {cancelLabel === 'custom' && (
                <View style={f.customPolicy}>
                  <View style={f.customPolicyRow}>
                    <Text style={f.customPolicyLabel}>Cancellation window</Text>
                    <View style={f.customPolicyRight}>
                      <TextInput style={f.customPolicyInput} value={cancelWindow} onChangeText={setCancelWindow} keyboardType="number-pad" maxLength={3} />
                      <Text style={f.customPolicyUnit}>hours</Text>
                    </View>
                  </View>
                  <Divider />
                  <View style={f.customPolicyRow}>
                    <Text style={f.customPolicyLabel}>Cancellation fee</Text>
                    <View style={f.customPolicyRight}>
                      <TextInput style={f.customPolicyInput} value={cancelFee} onChangeText={setCancelFee} keyboardType="number-pad" maxLength={3} />
                      <Text style={f.customPolicyUnit}>%</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Review ── */}
          {step === 'review' && (
            <View style={s.body}>
              <View style={f.reviewCard}>
                <View style={f.reviewCardHead}>
                  <View style={f.reviewAvatar}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{title.slice(0,1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={f.reviewTitle}>{title}</Text>
                    <Text style={f.reviewPrice}>
                      {pricingType === 'free' ? 'Free' : `£${price} ${PRICING_OPTIONS.find(p => p.value === pricingType)?.label}`}
                    </Text>
                    <View style={f.reviewArchBadge}>
                      <Text style={f.reviewArchText}>
                        {archetype === 'time_based' ? '⏱ Time-based' : archetype === 'in_person' ? '📍 In-person' : '📦 Deliverable'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={f.reviewDesc} numberOfLines={3}>{description}</Text>
              </View>

              {[
                { icon: FileText, label: 'Service name', value: title, ok: !!title },
                ...(archetype !== 'deliverable' ? [
                  { icon: Clock, label: 'Duration', value: formatDuration(dur), ok: true },
                  { icon: Calendar, label: 'Availability', value: `${activeDays} day${activeDays !== 1 ? 's' : ''} / week`, ok: activeDays > 0 },
                ] : [
                  { icon: Clock, label: 'Delivery time', value: deliveryTimeframe || 'Not set', ok: !!deliveryTimeframe },
                  { icon: Package, label: 'Client receives', value: clientReceives ? clientReceives.slice(0, 40) + '...' : 'Not set', ok: !!clientReceives },
                ]),
                { icon: DollarSign, label: 'Price', value: pricingType === 'free' ? 'Free' : `£${price}`, ok: pricingType === 'free' || !!price },
                { icon: HelpCircle, label: 'Questions', value: questions.length > 0 ? `${questions.length} question${questions.length > 1 ? 's' : ''}` : 'None', ok: true },
                { icon: Shield, label: 'Cancellation', value: cancelLabel.charAt(0).toUpperCase() + cancelLabel.slice(1), ok: true },
              ].map((item, i) => (
                <View key={i} style={f.reviewRow}>
                  <View style={[f.reviewIcon, item.ok && f.reviewIconOk]}>
                    <item.icon size={15} color={item.ok ? '#10b981' : '#bbb'} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={f.reviewRowLabel}>{item.label}</Text>
                    <Text style={f.reviewRowVal}>{item.value}</Text>
                  </View>
                  {item.ok
                    ? <Check size={16} color="#10b981" strokeWidth={2} />
                    : <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>Missing</Text>
                  }
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={s.footer}>
        {step === 'questions' && !addingQ ? (
          <View style={s.footerRow}>
            <TouchableOpacity style={s.skipBtn} onPress={() => setStepIdx(i => i + 1)}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.nextBtn, { flex: 1 }]} onPress={goNext}>
              <Text style={s.nextText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, (loading || addingQ) && { opacity: 0.5 }]}
            onPress={goNext}
            disabled={loading || addingQ}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.nextText}>{isLast ? 'Publish service' : 'Continue'}</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#888' },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },
  stepHead: { paddingTop: 20, paddingBottom: 28 },
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#111', letterSpacing: -0.8, lineHeight: 34 },
  stepSub: { fontSize: 15, color: '#717171', marginTop: 8, lineHeight: 22 },
  body: { gap: 0 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerRow: { flexDirection: 'row', gap: 12 },
  nextBtn: { height: 56, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  nextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  skipText: { fontSize: 15, fontWeight: '600', color: '#888' },
})

const p = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingBottom: 8 },
  track: { height: 3, backgroundColor: '#f0f0f0', borderRadius: 2 },
  fill: { height: '100%', backgroundColor: '#111', borderRadius: 2 },
})

const f = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 10 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 19 },
  charHint: { fontSize: 11, color: '#bbb', textAlign: 'right', marginTop: 4 },
  titleInput: { fontSize: 22, fontWeight: '600', color: '#222', borderBottomWidth: 2, borderBottomColor: '#e0e0e0', paddingBottom: 12, paddingTop: 4 },
  descInput: { fontSize: 16, color: '#333', lineHeight: 26, minHeight: 160, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 16, textAlignVertical: 'top' },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#222' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 16, padding: 16, marginBottom: 10 },
  cardActive: { borderColor: '#111', backgroundColor: '#fafafa' },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  cardIconActive: { backgroundColor: '#111' },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#888', marginBottom: 2 },
  cardLabelActive: { color: '#111' },
  cardDesc: { fontSize: 13, color: '#bbb', lineHeight: 18 },
  cardExample: { fontSize: 12, color: '#bbb', marginTop: 2, fontStyle: 'italic' },
  checkCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

  archetypeNote: { flexDirection: 'row', gap: 10, backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginTop: 8, alignItems: 'flex-start' },
  archetypeNoteText: { fontSize: 13, color: '#555', flex: 1, lineHeight: 20 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0' },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#888' },
  chipTextActive: { color: '#fff' },

  customDurRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  customDurInput: { width: 100, borderWidth: 1.5, borderColor: '#111', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '700', color: '#111', textAlign: 'center' },
  customDurUnit: { fontSize: 16, color: '#888' },
  customDurResult: { fontSize: 14, fontWeight: '600', color: '#111', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },

  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 16, padding: 20 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  counterBtnText: { fontSize: 24, color: '#222', lineHeight: 28 },
  counterVal: { fontSize: 32, fontWeight: '700', color: '#111', textAlign: 'center' },
  counterSub: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 2 },

  priceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 16, overflow: 'hidden' },
  pricePre: { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: '#f5f5f5' },
  pricePreText: { fontSize: 20, fontWeight: '700', color: '#444' },
  priceInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#111', paddingHorizontal: 16, paddingVertical: 12 },
  priceSuf: { paddingHorizontal: 16 },
  priceSufText: { fontSize: 14, color: '#888', fontWeight: '600' },
  breakdown: { marginTop: 16, backgroundColor: '#fafafa', borderRadius: 14, padding: 16, gap: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 14, color: '#888' },
  breakdownVal: { fontSize: 14, color: '#444' },

  scheduleInfo: { flexDirection: 'row', gap: 10, backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'flex-start' },
  scheduleInfoText: { fontSize: 13, color: '#555', flex: 1, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#222' },
  toggleSub: { fontSize: 12, color: '#888', marginTop: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  dayTag: { width: 48, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  dayTagActive: { backgroundColor: '#111', borderColor: '#111' },
  dayTagText: { fontSize: 12, fontWeight: '700', color: '#bbb' },
  dayTagTextActive: { color: '#fff' },
  dayTimes: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSep: { fontSize: 16, color: '#bbb' },
  dayOff: { flex: 1, fontSize: 13, color: '#ccc' },
  scheduleSummary: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginTop: 16 },
  scheduleSummaryText: { fontSize: 13, color: '#555', lineHeight: 18 },

  qCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14 },
  qNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  qNumText: { fontSize: 12, fontWeight: '700', color: '#888' },
  qText: { fontSize: 14, fontWeight: '600', color: '#222', lineHeight: 20 },
  qMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  qType: { fontSize: 11, color: '#888' },
  qRequired: { fontSize: 11, color: '#ff385c', fontWeight: '600' },
  qOptions: { fontSize: 12, color: '#bbb', marginTop: 4 },
  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 14, borderStyle: 'dashed', padding: 18, justifyContent: 'center' },
  addQText: { fontSize: 15, fontWeight: '600', color: '#222' },
  qEditor: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 16, padding: 20, gap: 4 },
  qEditorBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  qCancel: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  qCancelText: { fontSize: 14, fontWeight: '600', color: '#888' },
  qSave: { flex: 2, height: 46, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  qSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  qEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  qEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#888' },
  qEmptyDesc: { fontSize: 13, color: '#bbb', textAlign: 'center', lineHeight: 20 },

  customPolicy: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  customPolicyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  customPolicyLabel: { fontSize: 14, fontWeight: '500', color: '#444' },
  customPolicyRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customPolicyInput: { width: 64, height: 40, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111' },
  customPolicyUnit: { fontSize: 14, color: '#888', width: 44 },

  reviewCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, padding: 20, marginBottom: 20 },
  reviewCardHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  reviewAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  reviewTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  reviewPrice: { fontSize: 14, color: '#888', marginTop: 2 },
  reviewArchBadge: { backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6 },
  reviewArchText: { fontSize: 11, fontWeight: '600', color: '#555' },
  reviewDesc: { fontSize: 14, color: '#717171', lineHeight: 21 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  reviewIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  reviewIconOk: { backgroundColor: '#f0fdf4' },
  reviewRowLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  reviewRowVal: { fontSize: 14, fontWeight: '600', color: '#222' },
})

const t = StyleSheet.create({
  track: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', justifyContent: 'center', paddingHorizontal: 3 },
  trackOn: { backgroundColor: '#111' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
})

const ti = StyleSheet.create({
  label: { fontSize: 10, color: '#888', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '600', color: '#222', textAlign: 'center', width: 80 },
})
