// app/provider/service-detail.tsx
// Shown when a provider taps a live listing card.
// Shows full service info, stats, booking questions, and quick actions.

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Share,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Share2, Trash2, Clock, Users,
  MapPin, Star, Shield, MessageSquare, ToggleLeft, ToggleRight,
} from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { describeCancellationPolicy } from '@/lib/types/cancellation'

export default function ServiceDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { if (id) loadListing() }, [id])

  async function loadListing() {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single()
    setListing(data)
    setLoading(false)
  }

  async function toggleStatus() {
    if (!listing) return
    setToggling(true)
    const newStatus = listing.status === 'active' ? 'paused' : 'active'
    const { error } = await supabase
      .from('opportunities')
      .update({ status: newStatus })
      .eq('id', id)
    if (!error) setListing((l: any) => ({ ...l, status: newStatus }))
    setToggling(false)
  }


async function deleteListing() {
  const doDelete = async () => {
    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', id)
    if (error) { Alert.alert('Error', error.message); return }
    router.replace('/provider/services' as any)
  }

  if (typeof window !== 'undefined' && window.confirm) {
    if (window.confirm("Delete this service? This can't be undone.")) {
      await doDelete()
    }
  } else {
    Alert.alert('Delete service', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }
}

  if (loading) return <View style={s.loader}><ActivityIndicator color="#ff5a1f" /></View>
  if (!listing) return null

  const price = listing.price_pence ? `£${(listing.price_pence / 100).toFixed(0)}` : '—'
  const durationMins = listing.metadata?.duration
  const durationLabel = durationMins
    ? durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
    : null
  const questions: any[] = listing.booking_questions ?? []
  const isLive = listing.status === 'active'

  const policyLabel = describeCancellationPolicy({
    label: listing.cancellation_policy_label ?? 'flexible',
    windowHours: listing.cancellation_window_hours ?? 0,
    feePercent: listing.cancellation_fee_percent ?? 0,
  })

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Hero image ── */}
        <View style={s.heroWrap}>
          {listing.image_url
            ? <Image source={{ uri: listing.image_url }} style={s.hero} />
            : <View style={[s.hero, s.heroPlaceholder]}><Text style={s.heroPlaceholderText}>{listing.title?.slice(0, 1) ?? '?'}</Text></View>
          }

          {/* Top bar */}
          <View style={s.heroBar}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()}>
              <ChevronLeft size={22} color="#111" />
            </TouchableOpacity>
            <View style={s.heroBarRight}>
              <TouchableOpacity style={s.heroBtn} onPress={() => Share.share({ message: `Book ${listing.title} on Pthway` })}>
                <Share2 size={18} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn} onPress={() => router.push(`/provider/create-listing?id=${id}` as any)}>
                <Edit2 size={18} color="#111" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status tag */}
          <View style={[s.statusTag, isLive ? s.statusLive : s.statusPaused]}>
            <View style={[s.statusDot, { backgroundColor: isLive ? '#14a44d' : '#ff9d00' }]} />
            <Text style={[s.statusText, { color: isLive ? '#14a44d' : '#ff9d00' }]}>
              {isLive ? 'Live' : 'Paused'}
            </Text>
          </View>
        </View>

        {/* ── Title + price ── */}
        <View style={s.titleSection}>
          <View style={s.titleRow}>
            <Text style={s.title}>{listing.title}</Text>
            <Text style={s.price}>{price}</Text>
          </View>
          {listing.location && (
            <View style={s.locationRow}>
              <MapPin size={13} color="#999" />
              <Text style={s.locationText}>{listing.location}</Text>
            </View>
          )}
        </View>

        <View style={s.divider} />

        {/* ── Quick stats ── */}
        <View style={s.statsRow}>
          {durationLabel && (
            <View style={s.statItem}>
              <Clock size={18} color="#ff5a1f" />
              <Text style={s.statValue}>{durationLabel}</Text>
              <Text style={s.statLabel}>Duration</Text>
            </View>
          )}
          {listing.metadata?.maxClients && (
            <View style={s.statItem}>
              <Users size={18} color="#ff5a1f" />
              <Text style={s.statValue}>{listing.metadata.maxClients}</Text>
              <Text style={s.statLabel}>Max clients</Text>
            </View>
          )}
          <View style={s.statItem}>
            <Star size={18} color="#ff5a1f" />
            <Text style={s.statValue}>New</Text>
            <Text style={s.statLabel}>Rating</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Description ── */}
        {listing.description && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>About this service</Text>
              <Text style={s.description}>{listing.description}</Text>
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ── Booking questions ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.sectionTitle}>Booking questions</Text>
              <Text style={s.sectionSub}>{questions.length === 0 ? 'No questions set' : `${questions.length} question${questions.length > 1 ? 's' : ''}`}</Text>
            </View>
            <TouchableOpacity
              style={s.editPill}
              onPress={() => router.push(`/provider/create-listing?id=${id}&step=6` as any)}
            >
              <Edit2 size={12} color="#6366f1" />
              <Text style={s.editPillText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {questions.length === 0 ? (
            <View style={s.emptyQuestions}>
              <MessageSquare size={24} color="#ddd" />
              <Text style={s.emptyQText}>No questions added yet</Text>
            </View>
          ) : (
            questions.map((q, i) => (
              <View key={i} style={s.questionRow}>
                <View style={s.questionNum}>
                  <Text style={s.questionNumText}>{i + 1}</Text>
                </View>
                <View style={s.questionInfo}>
                  <Text style={s.questionText}>{q.question}</Text>
                  <View style={s.questionMeta}>
                    <View style={s.questionTypePill}>
                      <Text style={s.questionTypeText}>{q.type}</Text>
                    </View>
                    {q.required && (
                      <View style={s.requiredPill}>
                        <Text style={s.requiredText}>Required</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.divider} />

        {/* ── Cancellation policy ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cancellation policy</Text>
          <View style={s.policyRow}>
            <View style={s.policyIcon}>
              <Shield size={18} color="#6366f1" />
            </View>
            <View>
              <Text style={s.policyLabel}>
                {(listing.cancellation_policy_label ?? 'flexible').charAt(0).toUpperCase() +
                  (listing.cancellation_policy_label ?? 'flexible').slice(1)}
              </Text>
              <Text style={s.policyDesc}>{policyLabel}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Actions ── */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.actionBtn, isLive ? s.pauseBtn : s.activateBtn]}
            onPress={toggleStatus}
            disabled={toggling}
          >
            {toggling
              ? <ActivityIndicator size="small" color={isLive ? '#ff9d00' : '#14a44d'} />
              : <>
                  {isLive
                    ? <ToggleLeft size={18} color="#ff9d00" />
                    : <ToggleRight size={18} color="#14a44d" />
                  }
                  <Text style={[s.actionBtnText, { color: isLive ? '#ff9d00' : '#14a44d' }]}>
                    {isLive ? 'Pause listing' : 'Go live'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={deleteListing}>
            <Trash2 size={18} color="#e00" />
            <Text style={[s.actionBtnText, { color: '#e00' }]}>Delete service</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },

  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 300 },
  heroPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  heroPlaceholderText: { fontSize: 72, fontWeight: '700', color: '#ddd' },
  heroBar: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  heroBarRight: { flexDirection: 'row', gap: 8 },
  heroBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  statusTag: { position: 'absolute', bottom: 14, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusLive: { backgroundColor: 'rgba(233,255,241,0.95)' },
  statusPaused: { backgroundColor: 'rgba(255,249,235,0.95)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  titleSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', letterSpacing: -0.5, flex: 1, marginRight: 12 },
  price: { fontSize: 24, fontWeight: '700', color: '#111' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 13, color: '#999' },

  divider: { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 20 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 20, gap: 24 },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 11, color: '#999' },

  section: { paddingHorizontal: 20, paddingVertical: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#999' },
  description: { fontSize: 15, color: '#444', lineHeight: 24 },

  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  editPillText: { fontSize: 12, fontWeight: '600', color: '#6366f1' },

  emptyQuestions: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyQText: { fontSize: 13, color: '#bbb' },

  questionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  questionNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  questionNumText: { fontSize: 11, fontWeight: '700', color: '#888' },
  questionInfo: { flex: 1 },
  questionText: { fontSize: 14, fontWeight: '500', color: '#111', marginBottom: 6 },
  questionMeta: { flexDirection: 'row', gap: 6 },
  questionTypePill: { backgroundColor: '#f5f5f5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  questionTypeText: { fontSize: 11, color: '#888', fontWeight: '500' },
  requiredPill: { backgroundColor: '#fff0e8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  requiredText: { fontSize: 11, color: '#ff5a1f', fontWeight: '600' },

  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  policyIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  policyLabel: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  policyDesc: { fontSize: 13, color: '#888' },

  actions: { paddingHorizontal: 20, paddingTop: 8, gap: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  pauseBtn: {},
  activateBtn: {},
  actionBtnText: { fontSize: 15, fontWeight: '500' },
})
