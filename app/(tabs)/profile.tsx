import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ScrollView, StatusBar, Dimensions,
} from 'react-native'
import { Feather, Ionicons, MaterialIcons, Octicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import BecomeProviderModal from '@/components/BecomeProviderModal'

const { width } = Dimensions.get('window')

export default function ProfileScreen() {
  const router = useRouter()
  const [setShowProviderModal] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data)
  }

  function initials(name: string) {
    return name?.split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() ?? '?'
  }

  const SETTINGS_TOP = [
    { icon: <Feather name="settings" size={23} color="#111" />, label: 'Account settings', onPress: () => {} },
    { icon: <Feather name="help-circle" size={23} color="#111" />, label: 'Get help', onPress: () => {} },
    { icon: <Feather name="user" size={23} color="#111" />, label: 'View profile', onPress: () => {} },
    { icon: <Feather name="shield" size={23} color="#111" />, label: 'Privacy', onPress: () => {} },
  ]

  const SETTINGS_BOTTOM = [
    { icon: <Feather name="users" size={23} color="#111" />, label: 'Refer a friend', onPress: () => {} },
    { icon: <Feather name="gift" size={23} color="#111" />, label: 'Gift cards', onPress: () => {} },
    { icon: <Octicons name="book" size={23} color="#111" />, label: 'Legal', onPress: () => {} },
    {
      icon: <Feather name="log-out" size={23} color="#111" />,
      label: 'Log out',
      onPress: async () => {
        await supabase.auth.signOut()
        router.replace('/(auth)/login')
      },
    },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            {profile?.full_name ? (
              <Text style={styles.avatarText}>{initials(profile.full_name)}</Text>
            ) : (
              <Text style={styles.avatarEmoji}>🧑🏻</Text>
            )}
          </View>
        </View>

        {/* Name */}
        <Text style={styles.name}>{profile?.full_name ?? 'Your Name'}</Text>

        {/* Rating row */}
        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>4.9</Text>
          <Ionicons name="star" size={18} color="#FFB400" style={{ marginLeft: 4 }} />
          <Text style={styles.dot}>•</Text>
          <Text style={styles.verifiedText}>Verified</Text>
          <Ionicons name="checkmark-circle" size={18} color="#6C63FF" style={{ marginLeft: 6 }} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity activeOpacity={0.9} style={styles.quickCard}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#FFF4EC' }]}>
              <Feather name="activity" size={23} color="#FF8A3D" />
            </View>
            <Text style={styles.quickText}>Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={styles.quickCard}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#ececff' }]}>
              <Ionicons name="people" size={22} color="#6C63FF" />
            </View>
            <Text style={styles.quickText}>Circle</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={styles.quickCard}>
            <View style={[styles.quickIconContainer, { backgroundColor: '#f0f0f0' }]}>
              <Feather name="edit-2" size={21} color="#111" />
            </View>
            <Text style={styles.quickText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Become Provider */}
{profile?.role === 'provider' ? (
  <TouchableOpacity
    activeOpacity={0.9}
    style={styles.providerCard}
    onPress={() => router.push('/provider/studio' as any)}
  >
    <View style={styles.providerGlow} />
    <View>
      <Text style={styles.providerTitle}>Provider Dashboard</Text>
      <Text style={styles.providerSubtitle}>Switch to your provider view.</Text>
    </View>
    <Ionicons name="chevron-forward" size={24} color="#B8B8B8" />
  </TouchableOpacity>
) : (
  <TouchableOpacity
    activeOpacity={0.9}
    style={styles.providerCard}
    onPress={async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data } = await supabase
    .from('provider_profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  if (data) {
    router.push('/provider/studio' as any)
  } else {
    router.push('/onboarding/provider' as any)
  }
}}
  >
    <View style={styles.providerGlow} />
    <View>
      <Text style={styles.providerTitle}>Become a provider</Text>
      <Text style={styles.providerSubtitle}>Share what you have, earn extra income.</Text>
    </View>
    <Ionicons name="chevron-forward" size={24} color="#B8B8B8" />
  </TouchableOpacity>
)}

        {/* Settings */}
        <View style={styles.settingsCard}>
          {SETTINGS_TOP.map((item, index) => (
            <TouchableOpacity key={index} activeOpacity={0.85} style={styles.settingRow} onPress={item.onPress}>
              <View style={styles.settingLeft}>
                {item.icon}
                <Text style={styles.settingLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color="#C6C6C6" />
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {SETTINGS_BOTTOM.map((item, index) => (
            <TouchableOpacity key={index} activeOpacity={0.85} style={styles.settingRow} onPress={item.onPress}>
              <View style={styles.settingLeft}>
                {item.icon}
                <Text style={[styles.settingLabel, item.label === 'Log out' && { color: '#FF3B30' }]}>
                  {item.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color="#C6C6C6" />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40, alignItems: 'center' },
  avatarContainer: { marginTop: 36, alignItems: 'center' },
  avatar: {
    width: 108, height: 108, borderRadius: 54,
    backgroundColor: '#EFEFEF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 40, fontWeight: '700', color: '#111' },
  avatarEmoji: { fontSize: 54 },
  name: { marginTop: 28, fontSize: 28, fontWeight: '700', color: '#111', letterSpacing: -0.7 },
  ratingRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 17, color: '#2D2D2D', fontWeight: '500' },
  dot: { marginHorizontal: 10, fontSize: 18, color: '#8C8C8C' },
  verifiedText: { fontSize: 17, color: '#2D2D2D', fontWeight: '500' },
  quickActions: { width: width - 48, marginTop: 38, flexDirection: 'row', justifyContent: 'space-between' },
  quickCard: {
    width: (width - 68) / 3, height: 132,
    backgroundColor: '#fff', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e4e4e4',
  },
  quickIconContainer: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  quickText: { fontSize: 17, fontWeight: '500', color: '#111' },
  providerCard: {
    width: width - 48, height: 118,
    backgroundColor: '#fff', borderRadius: 28, marginTop: 26,
    paddingHorizontal: 26, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    overflow: 'hidden', borderWidth: 1, borderColor: '#e4e4e4',
  },
  providerGlow: {
    position: 'absolute', left: -20, bottom: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#FFE9DD', opacity: 0.9,
  },
  providerTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 10 },
  providerSubtitle: { fontSize: 16, color: '#666', fontWeight: '400' },
  settingsCard: {
    width: width - 48, backgroundColor: '#fff',
    borderRadius: 32, marginTop: 28, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  settingRow: { height: 68, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: { marginLeft: 18, fontSize: 18, color: '#111', fontWeight: '400' },
  divider: { height: 1, backgroundColor: '#EFEFEF', marginHorizontal: 22, marginVertical: 8 },
})