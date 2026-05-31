// app/provider/policies.tsx
//
// Lets providers view and update the cancellation policy on each of their listings.
// Fetches all active opportunities for the provider, shows current policy per listing,
// and lets them change it inline — saves directly to Supabase on change.

import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import {
  CancellationPolicy,
  CancellationPolicyLabel,
  PRESET_POLICIES,
  describeCancellationPolicy,
} from '@/lib/types/cancellation'

interface Listing {
  id: string
  title: string
  cancellation_policy_label: CancellationPolicyLabel
  cancellation_window_hours: number
  cancellation_fee_percent: number
}

const POLICY_OPTIONS: {
  label: Exclude<CancellationPolicyLabel, 'custom'>
  title: string
  desc: string
  color: string
  text: string
  icon: string
}[] = [
  { label: 'flexible', title: 'Flexible', desc: 'Free cancellation any time', color: '#e7f7ef', text: '#0aa65a', icon: 'leaf-outline' },
  { label: 'moderate', title: 'Moderate', desc: '50% fee within 24 hours', color: '#fff7e6', text: '#d97706', icon: 'time-outline' },
  { label: 'strict', title: 'Strict', desc: '100% fee within 48 hours', color: '#fef2f2', text: '#dc2626', icon: 'shield-outline' },
]

export default function PoliciesScreen() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadListings() }, [])

  async function loadListings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('opportunities')
      .select('id, title, cancellation_policy_label, cancellation_window_hours, cancellation_fee_percent')
      .eq('provider_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (data) setListings(data)
    setLoading(false)
  }

  async function updatePolicy(listingId: string, label: Exclude<CancellationPolicyLabel, 'custom'>) {
    setSaving(listingId)
    const policy = PRESET_POLICIES[label]

    const { error } = await supabase
      .from('opportunities')
      .update({
        cancellation_policy_label: policy.label,
        cancellation_window_hours: policy.windowHours,
        cancellation_fee_percent: policy.feePercent,
      })
      .eq('id', listingId)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setListings(prev => prev.map(l =>
        l.id === listingId
          ? { ...l, cancellation_policy_label: label, cancellation_window_hours: policy.windowHours, cancellation_fee_percent: policy.feePercent }
          : l
      ))
      setExpanded(null)
    }
    setSaving(null)
  }

  function getPolicyMeta(label: string) {
    return POLICY_OPTIONS.find(p => p.label === label) ?? POLICY_OPTIONS[0]
  }

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color="#6366f1" />
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Policies</Text>
          <Text style={s.headerSub}>Cancellation rules per service</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Info banner */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#6366f1" />
          <Text style={s.infoText}>
            Each service can have its own cancellation policy. Clients see this before booking.
          </Text>
        </View>

        {listings.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="shield-outline" size={48} color="#ddd" />
            <Text style={s.emptyTitle}>No active services</Text>
            <Text style={s.emptySub}>Create a listing first to set a cancellation policy.</Text>
            <TouchableOpacity
              style={s.createBtn}
              onPress={() => router.push('/provider/create-listing' as any)}
            >
              <Text style={s.createBtnText}>Create a listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          listings.map((listing) => {
            const currentMeta = getPolicyMeta(listing.cancellation_policy_label)
            const isExpanded = expanded === listing.id
            const isSaving = saving === listing.id

            return (
              <View key={listing.id} style={s.listingCard}>
                {/* Listing row */}
                <TouchableOpacity
                  style={s.listingRow}
                  onPress={() => setExpanded(isExpanded ? null : listing.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.listingLeft}>
                    <Text style={s.listingTitle} numberOfLines={1}>{listing.title}</Text>
                    <View style={[s.policyBadge, { backgroundColor: currentMeta.color }]}>
                      <Ionicons name={currentMeta.icon as any} size={11} color={currentMeta.text} />
                      <Text style={[s.policyBadgeText, { color: currentMeta.text }]}>
                        {currentMeta.title}
                      </Text>
                    </View>
                  </View>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#6366f1" />
                  ) : (
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#bbb"
                    />
                  )}
                </TouchableOpacity>

                {/* Current policy description */}
                <Text style={s.policyDesc}>
                  {describeCancellationPolicy({
                    label: listing.cancellation_policy_label,
                    windowHours: listing.cancellation_window_hours,
                    feePercent: listing.cancellation_fee_percent,
                  })}
                </Text>

                {/* Expanded picker */}
                {isExpanded && (
                  <View style={s.picker}>
                    <View style={s.pickerDivider} />
                    {POLICY_OPTIONS.map((opt) => {
                      const isActive = listing.cancellation_policy_label === opt.label
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[s.pickerOption, isActive && s.pickerOptionActive]}
                          onPress={() => updatePolicy(listing.id, opt.label)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.pickerIcon, { backgroundColor: opt.color }]}>
                            <Ionicons name={opt.icon as any} size={16} color={opt.text} />
                          </View>
                          <View style={s.pickerText}>
                            <Text style={[s.pickerLabel, isActive && { color: '#6366f1' }]}>
                              {opt.title}
                            </Text>
                            <Text style={s.pickerSub}>{opt.desc}</Text>
                          </View>
                          {isActive && (
                            <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 1 },

  content: { padding: 16, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#eef2ff', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: '#4f46e5', lineHeight: 18 },

  listingCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  listingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  listingLeft: { flex: 1, gap: 6 },
  listingTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  policyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  policyBadgeText: { fontSize: 11, fontWeight: '600' },
  policyDesc: { fontSize: 12, color: '#888', lineHeight: 17 },

  picker: { marginTop: 4 },
  pickerDivider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 12, marginBottom: 6,
  },
  pickerOptionActive: { backgroundColor: '#f5f4ff' },
  pickerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pickerText: { flex: 1 },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 1 },
  pickerSub: { fontSize: 12, color: '#888' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 32 },
  createBtn: { marginTop: 12, backgroundColor: '#111', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  createBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
