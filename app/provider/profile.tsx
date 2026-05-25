import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { LogOut, Save } from 'lucide-react-native'

export default function ProviderProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    location: '',
    business_name: '',
    category: '',
  })
  const router = useRouter()

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('*, provider_profiles(*)')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setForm({
        full_name: data.full_name ?? '',
        username: data.username ?? '',
        bio: data.bio ?? '',
        location: data.location ?? '',
        business_name: data.provider_profiles?.business_name ?? '',
        category: data.provider_profiles?.category ?? '',
      })
    }
    setLoading(false)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name, username: form.username, bio: form.bio, location: form.location })
      .eq('id', user.id)

    if (!error) {
      await supabase.from('provider_profiles').upsert({
        id: user.id,
        business_name: form.business_name,
        category: form.category,
      })
      Alert.alert('Saved', 'Your profile has been updated.')
    } else {
      Alert.alert('Error', error.message)
    }
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  function initials(name: string) {
    return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#ff5a1f" /></View>
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Profile</Text>

      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(form.full_name || 'P')}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{form.full_name || 'Provider'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* Listing form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your listing</Text>
        <Text style={styles.cardSubtitle}>Changes here update what clients see on the feed.</Text>

        <Field label="Display name">
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(v) => setForm({ ...form, full_name: v })}
            placeholder="Your name"
            placeholderTextColor="#999"
          />
        </Field>

        <Field label="Username">
          <TextInput
            style={styles.input}
            value={form.username}
            onChangeText={(v) => setForm({ ...form, username: v })}
            placeholder="@handle"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Business name">
          <TextInput
            style={styles.input}
            value={form.business_name}
            onChangeText={(v) => setForm({ ...form, business_name: v })}
            placeholder="Your business name"
            placeholderTextColor="#999"
          />
        </Field>

        <Field label="Category">
          <TextInput
            style={styles.input}
            value={form.category}
            onChangeText={(v) => setForm({ ...form, category: v })}
            placeholder="hair, nails, pt, driving..."
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Bio">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.bio}
            onChangeText={(v) => setForm({ ...form, bio: v })}
            placeholder="What you offer..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </Field>

        <Field label="Location">
          <TextInput
            style={styles.input}
            value={form.location}
            onChangeText={(v) => setForm({ ...form, location: v })}
            placeholder="e.g. North London"
            placeholderTextColor="#999"
          />
        </Field>

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Links */}
      <View style={styles.links}>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/provider/calendar' as any)}>
          <Text style={styles.linkBtnText}>Manage availability & pricing per slot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.linkBtnText}>Switch to client view</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkBtn, styles.signOutBtn]} onPress={signOut}>
          <LogOut size={16} color="#e00" />
          <Text style={[styles.linkBtnText, { color: '#e00' }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, marginBottom: 24 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 20, gap: 16, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '600' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600' },
  userEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  card: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#888', marginBottom: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 15, color: '#111' },
  multiline: { height: 80, textAlignVertical: 'top' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 12, padding: 14, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  links: { gap: 8 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 16 },
  linkBtnText: { fontSize: 14, fontWeight: '500' },
  signOutBtn: { borderColor: '#fff0f0' },
})