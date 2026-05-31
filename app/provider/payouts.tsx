// app/provider/payouts.tsx
// Provider payout settings — Stripe Connect onboarding, bank status, schedule

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ProviderNav } from '@/components/ProviderNav'
import {
  ChevronLeft, Shield, CheckCircle, AlertCircle,
  ExternalLink, Building, Calendar, ChevronRight, Lock,
} from 'lucide-react-native'

export default function PayoutsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ success?: string; refresh?: string }>()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadProfile()
    if (params.success === '1') {
      Alert.alert('Account connected!', 'Your payout account is set up. You can now receive payments.')
    }
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('full_name, stripe_account_id, stripe_onboarding_complete')
      .eq('id', user.id)
      .single()

    setProfile(data)
    setLoading(false)
  }

async function connectStripe() {
  setConnecting(true)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { Alert.alert('Please sign in again'); setConnecting(false); return }

    console.log('Invoking create-connect-account...')

    const resp = await supabase.functions.invoke('create-connect-account', {
      body: {},
    })

    console.log('Response data:', JSON.stringify(resp.data))
    console.log('Response error:', JSON.stringify(resp.error))

    if (resp.error) throw new Error(resp.error.message)

    const { url } = resp.data

    if (!url) {
      Alert.alert('Error', 'No URL returned from Stripe')
      setConnecting(false)
      return
    }

    console.log('Opening URL:', url)

    const supported = await Linking.canOpenURL(url)
    if (supported) {
      await Linking.openURL(url)
    } else {
      Alert.alert('Cannot open URL', url)
    }
  } catch (err) {
    console.log('connectStripe error:', err)
    Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong')
  }
  setConnecting(false)
}

  if (loading) return <View style={s.center}><ActivityIndicator color="#111" /></View>

  const isConnected = !!profile?.stripe_account_id
  const isVerified = !!profile?.stripe_onboarding_complete

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payout settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Status card */}
        <View style={[s.statusCard, isVerified ? s.statusCardGreen : isConnected ? s.statusCardAmber : s.statusCardGrey]}>
          {isVerified ? (
            <>
              <CheckCircle size={24} color="#059669" />
              <View style={s.statusInfo}>
                <Text style={s.statusTitle}>Payouts active</Text>
                <Text style={s.statusDesc}>Your bank account is connected and verified.</Text>
              </View>
            </>
          ) : isConnected ? (
            <>
              <AlertCircle size={24} color="#d97706" />
              <View style={s.statusInfo}>
                <Text style={[s.statusTitle, { color: '#d97706' }]}>Verification needed</Text>
                <Text style={s.statusDesc}>Complete your Stripe profile to receive payouts.</Text>
              </View>
            </>
          ) : (
            <>
              <Lock size={24} color="#888" />
              <View style={s.statusInfo}>
                <Text style={[s.statusTitle, { color: '#888' }]}>Not connected</Text>
                <Text style={s.statusDesc}>Connect your bank account to receive payments.</Text>
              </View>
            </>
          )}
        </View>

        {/* Connect / manage button */}
        {!isConnected ? (
          <View style={s.connectSection}>
            <Text style={s.connectTitle}>Get paid for your services</Text>
            <Text style={s.connectDesc}>
              Connect your bank account through Stripe. Takes 2 minutes. Your earnings are paid out automatically.
            </Text>
            <TouchableOpacity
              style={s.connectBtn}
              onPress={connectStripe}
              disabled={connecting}
              activeOpacity={0.88}
            >
              {connecting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Building size={18} color="#fff" />
                  <Text style={s.connectBtnText}>Connect bank account</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={s.stripeNote}>
              <Shield size={13} color="#888" />
              <Text style={s.stripeNoteText}>Powered by Stripe — bank-level security</Text>
            </View>
          </View>
        ) : (
          <View style={s.manageSection}>
            <Text style={s.sectionTitle}>Account details</Text>

            <View style={s.infoRow}>
              <Building size={16} color="#888" />
              <View style={s.infoRowContent}>
                <Text style={s.infoLabel}>Bank account</Text>
                <Text style={s.infoValue}>{isVerified ? 'Connected & verified' : 'Awaiting verification'}</Text>
              </View>
              <View style={[s.infoBadge, { backgroundColor: isVerified ? '#e7f7ef' : '#fff9e6' }]}>
                <Text style={[s.infoBadgeText, { color: isVerified ? '#059669' : '#d97706' }]}>
                  {isVerified ? 'Active' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <Calendar size={16} color="#888" />
              <View style={s.infoRowContent}>
                <Text style={s.infoLabel}>Payout schedule</Text>
                <Text style={s.infoValue}>Automatic · 2–7 business days after service</Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <Shield size={16} color="#888" />
              <View style={s.infoRowContent}>
                <Text style={s.infoLabel}>Platform fee</Text>
                <Text style={s.infoValue}>3% + 40p per booking</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.stripeManageBtn}
              onPress={connectStripe}
              activeOpacity={0.8}
            >
              <ExternalLink size={16} color="#111" />
              <Text style={s.stripeManageBtnText}>Manage Stripe account</Text>
              <ChevronRight size={14} color="#888" />
            </TouchableOpacity>

            <View style={s.stripeNote}>
              <Shield size={13} color="#888" />
              <Text style={s.stripeNoteText}>Powered by Stripe — your only access point to Stripe settings</Text>
            </View>
          </View>
        )}

        {/* How payouts work */}
        <View style={s.howSection}>
          <Text style={s.sectionTitle}>How payouts work</Text>
          {[
            { step: '1', title: 'Customer books', desc: 'Payment is authorized and held securely.' },
            { step: '2', title: 'You accept', desc: 'Payment is captured when you confirm the booking.' },
            { step: '3', title: 'Service complete', desc: 'Funds transfer to your bank within 2–7 days.' },
          ].map((item) => (
            <View key={item.step} style={s.howRow}>
              <View style={s.howStep}>
                <Text style={s.howStepText}>{item.step}</Text>
              </View>
              <View style={s.howInfo}>
                <Text style={s.howTitle}>{item.title}</Text>
                <Text style={s.howDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <ProviderNav />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: '#f8f8f8' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 20, marginBottom: 20 },
  statusCardGreen: { backgroundColor: '#e7f7ef' },
  statusCardAmber: { backgroundColor: '#fff9e6' },
  statusCardGrey: { backgroundColor: '#f5f5f5' },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  statusDesc: { fontSize: 13, color: '#666', lineHeight: 18 },

  connectSection: { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  connectTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 10, textAlign: 'center' },
  connectDesc: { fontSize: 14, color: '#888', lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, marginBottom: 16, width: '100%', justifyContent: 'center' },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  manageSection: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoRowContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#111' },
  infoBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  infoBadgeText: { fontSize: 11, fontWeight: '700' },
  stripeManageBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#f9f9f9', borderRadius: 14 },
  stripeManageBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },

  stripeNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  stripeNoteText: { fontSize: 11, color: '#bbb' },

  howSection: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  howRow: { flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  howStep: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  howStepText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  howInfo: { flex: 1 },
  howTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  howDesc: { fontSize: 12, color: '#888', lineHeight: 17 },
})
