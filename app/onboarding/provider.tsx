import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
  Alert, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { ChevronLeft, Check } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 6

const CATEGORIES = [
  { label: 'Hair', icon: 'cut-outline' },
  { label: 'Nails', icon: 'color-palette-outline' },
  { label: 'Lashes', icon: 'eye-outline' },
  { label: 'Fitness', icon: 'barbell-outline' },
  { label: 'Driving', icon: 'car-outline' },
  { label: 'Events', icon: 'calendar-outline' },
  { label: 'Tattoo', icon: 'brush-outline' },
  { label: 'Music', icon: 'musical-notes-outline' },
  { label: 'Beauty', icon: 'sparkles-outline' },
  { label: 'Wellness', icon: 'leaf-outline' },
  { label: 'Education', icon: 'book-outline' },
  { label: 'Other', icon: 'ellipsis-horizontal-outline' },
]

const SERVICE_TYPES = [
  { label: '1:1 Session', desc: 'One person at a time', icon: 'person-outline' },
  { label: 'Group Class', desc: 'Multiple people at once', icon: 'people-outline' },
  { label: 'Event', desc: 'Ticketed experience', icon: 'ticket-outline' },
  { label: 'Online', desc: 'Remote via video call', icon: 'videocam-outline' },
]

export default function ProviderOnboarding() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    category: '',
    service_type: '',
    location: '',
    bio: '',
    price: '',
  })
  const router = useRouter()

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS)) }
  function back() {
    if (step === 1) router.back()
    else setStep(s => s - 1)
  }

  async function finish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'provider', bio: form.bio, location: form.location })
      .eq('id', user.id)

    const { error: providerError } = await supabase
      .from('provider_profiles')
      .upsert({
        id: user.id,
        business_name: form.business_name,
        category: form.category.toLowerCase(),
      })

    if (profileError || providerError) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Create first opportunity
    if (form.category) {
      await supabase.from('opportunities').insert({
        provider_id: user.id,
        title: form.business_name,
        description: form.bio,
        category: form.category.toLowerCase(),
        location: form.location,
        price_pence: form.price ? Math.round(parseFloat(form.price) * 100) : 0,
        status: 'active',
      })
    }

    setLoading(false)
    router.replace('/provider/studio' as any)
  }

  const progress = (step / TOTAL_STEPS) * 100

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1 — Business name */}
        {step === 1 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 1 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>What's your business called?</Text>
            <Text style={styles.stepSub}>
              This is the name clients will see when they discover you on Pthway.
            </Text>
            <TextInput
              style={styles.input}
              value={form.business_name}
              onChangeText={(v) => setForm({ ...form, business_name: v })}
              placeholder="e.g. Nails by Shirah"
              placeholderTextColor="#999"
              autoFocus
            />
          </View>
        )}

        {/* Step 2 — Category */}
        {step === 2 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 2 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>What do you offer?</Text>
            <Text style={styles.stepSub}>
              Pick the category that best describes your service.
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isActive = form.category === cat.label
                return (
                  <TouchableOpacity
                    key={cat.label}
                    style={[styles.categoryCard, isActive && styles.categoryCardActive]}
                    onPress={() => setForm({ ...form, category: cat.label })}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={28}
                      color={isActive ? '#ff5a1f' : '#111'}
                    />
                    <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                      {cat.label}
                    </Text>
                    {isActive && (
                      <View style={styles.categoryCheck}>
                        <Check size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* Step 3 — Service type */}
        {step === 3 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 3 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>How do you work with clients?</Text>
            <Text style={styles.stepSub}>
              This helps us set up your booking flow correctly.
            </Text>
            <View style={styles.typeList}>
              {SERVICE_TYPES.map((type) => {
                const isActive = form.service_type === type.label
                return (
                  <TouchableOpacity
                    key={type.label}
                    style={[styles.typeCard, isActive && styles.typeCardActive]}
                    onPress={() => setForm({ ...form, service_type: type.label })}
                  >
                    <View style={styles.typeLeft}>
                      <Ionicons
                        name={type.icon as any}
                        size={24}
                        color={isActive ? '#ff5a1f' : '#111'}
                      />
                      <View>
                        <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                          {type.label}
                        </Text>
                        <Text style={styles.typeDesc}>{type.desc}</Text>
                      </View>
                    </View>
                    {isActive && (
                      <View style={styles.typeCheck}>
                        <Check size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* Step 4 — Location */}
        {step === 4 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 4 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>Where are you based?</Text>
            <Text style={styles.stepSub}>
              Clients nearby will discover you first. You can be more specific later.
            </Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(v) => setForm({ ...form, location: v })}
              placeholder="e.g. North London, Manchester, Birmingham"
              placeholderTextColor="#999"
              autoFocus
            />
          </View>
        )}

        {/* Step 5 — Bio */}
        {step === 5 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 5 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>Tell clients about yourself</Text>
            <Text style={styles.stepSub}>
              What makes you different? Your experience, your vibe, what clients can expect.
            </Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.bio}
              onChangeText={(v) => setForm({ ...form, bio: v })}
              placeholder="e.g. 5 years experience in North London. Specialise in acrylics and nail art. All products are vegan and cruelty-free..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              autoFocus
            />
            <Text style={styles.charCount}>{form.bio.length}/300</Text>
          </View>
        )}

        {/* Step 6 — Price */}
        {step === 6 && (
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 6 of {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>Set your starting price</Text>
            <Text style={styles.stepSub}>
              You can always update this and add different prices for different services later.
            </Text>
            <View style={styles.priceInput}>
              <Text style={styles.priceCurrency}>£</Text>
              <TextInput
                style={styles.priceField}
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <Text style={styles.priceNote}>
              Pthway charges a 3% platform fee per booking — you keep the rest.
            </Text>

            {/* Preview card */}
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Your listing preview</Text>
              <View style={styles.previewRow}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.previewAvatarText}>
                    {form.business_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{form.business_name}</Text>
                  <Text style={styles.previewCategory}>{form.category} · {form.location}</Text>
                  {form.price ? (
                    <Text style={styles.previewPrice}>From £{form.price}</Text>
                  ) : null}
                </View>
              </View>
              {form.bio ? (
                <Text style={styles.previewBio} numberOfLines={2}>{form.bio}</Text>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[
              styles.continueBtn,
              ((step === 1 && !form.business_name) ||
                (step === 2 && !form.category) ||
                (step === 3 && !form.service_type) ||
                (step === 4 && !form.location)) && styles.continueBtnDisabled,
            ]}
            onPress={next}
            disabled={
              (step === 1 && !form.business_name) ||
              (step === 2 && !form.category) ||
              (step === 3 && !form.service_type) ||
              (step === 4 && !form.location)
            }
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
            onPress={finish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueBtnText}>Launch my profile 🚀</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  progressBar: { flex: 1, height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ff5a1f', borderRadius: 2 },
  exitText: { fontSize: 14, color: '#888', fontWeight: '500' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  step: { paddingTop: 16 },
  stepLabel: { fontSize: 13, color: '#999', fontWeight: '500', marginBottom: 8 },
  stepTitle: { fontSize: 30, fontWeight: '700', color: '#111', letterSpacing: -0.5, lineHeight: 36, marginBottom: 12 },
  stepSub: { fontSize: 15, color: '#888', lineHeight: 22, marginBottom: 28 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    padding: 18, fontSize: 17, color: '#111',
  },
  multiline: { height: 140, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: {
    width: (width - 48 - 24) / 3,
    paddingVertical: 20, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e0e0e0',
    alignItems: 'center', gap: 8,
    position: 'relative',
  },
  categoryCardActive: { borderColor: '#ff5a1f', backgroundColor: '#fff8f6' },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: '#111' },
  categoryLabelActive: { color: '#ff5a1f' },
  categoryCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center', alignItems: 'center',
  },
  typeList: { gap: 12 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 16, padding: 20,
  },
  typeCardActive: { borderColor: '#ff5a1f', backgroundColor: '#fff8f6' },
  typeLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  typeLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  typeLabelActive: { color: '#ff5a1f' },
  typeDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  typeCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center', alignItems: 'center',
  },
  priceInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14,
    paddingHorizontal: 18, marginBottom: 12,
  },
  priceCurrency: { fontSize: 32, fontWeight: '700', color: '#111', marginRight: 8 },
  priceField: { flex: 1, fontSize: 32, fontWeight: '700', color: '#111', paddingVertical: 18 },
  priceNote: { fontSize: 13, color: '#aaa', marginBottom: 28 },
  previewCard: {
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16,
    padding: 20, backgroundColor: '#fafafa',
  },
  previewTitle: { fontSize: 12, color: '#999', fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  previewAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ff5a1f',
    justifyContent: 'center', alignItems: 'center',
  },
  previewAvatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  previewInfo: { flex: 1, justifyContent: 'center' },
  previewName: { fontSize: 16, fontWeight: '700', color: '#111' },
  previewCategory: { fontSize: 13, color: '#888', marginTop: 2 },
  previewPrice: { fontSize: 14, fontWeight: '600', color: '#ff5a1f', marginTop: 4 },
  previewBio: { fontSize: 13, color: '#666', lineHeight: 20 },
  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  continueBtn: {
    backgroundColor: '#111', borderRadius: 16,
    padding: 18, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#e0e0e0' },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})