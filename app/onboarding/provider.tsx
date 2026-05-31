import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Dimensions, TextInput, ScrollView, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')

const OFFER_TYPES = [
  { label: 'Services', desc: '1-to-1 appointments and professional services', emoji: '🗂️', color: '#ff6b35' },
  { label: 'Experiences', desc: 'Classes, workshops and activities', emoji: '🎭', color: '#8b5cf6' },
  { label: 'Events', desc: 'Events and large gatherings', emoji: '🎪', color: '#10b981' },
]

const CATEGORIES = [
  { label: 'Hairdresser', emoji: '✂️' },
  { label: 'Nail Technician', emoji: '💅' },
  { label: 'Lash Technician', emoji: '👁️' },
  { label: 'Tattoo Artist', emoji: '🎨' },
  { label: 'Personal Trainer', emoji: '💪' },
  { label: 'Driving Instructor', emoji: '🚗' },
  { label: 'Catering', emoji: '🍕' },
  { label: 'Photography', emoji: '📸' },
  { label: 'Music', emoji: '🎵' },
  { label: 'Wellness', emoji: '🧘' },
  { label: 'Other', emoji: '✨' },
]

const DURATIONS = ['30', '45', '60', '90', '120', '180']

function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={sheet.overlay} activeOpacity={1} onPress={onClose} />
        <View style={sheet.container}>
          <View style={sheet.handle} />
          <View style={sheet.header}>
            <Text style={sheet.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={sheet.closeBtn}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function ProfileStrength({ profile }: { profile: any }) {
  const checks = [
    !!profile.name,
    !!profile.category,
    !!profile.bio,
    !!profile.location,
    !!profile.price,
    profile.services.length > 0,
  ]
  const score = checks.filter(Boolean).length
  const pct = Math.round((score / checks.length) * 100)

  const color = pct < 40 ? '#f59e0b' : pct < 80 ? '#3b82f6' : '#10b981'
  const label = pct < 40 ? 'Just getting started' : pct < 80 ? 'Looking good' : pct < 100 ? 'Almost there' : 'Profile complete'

  return (
    <View style={strength.container}>
      <View style={strength.row}>
        <Text style={[strength.label, { color }]}>Profile strength: {pct}%</Text>
        <Text style={strength.sublabel}>{label}</Text>
      </View>
      <View style={strength.bar}>
        <View style={[strength.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      {pct < 100 && (
        <Text style={strength.hint}>
          {!profile.name ? 'Add your name · ' : ''}
          {!profile.bio ? 'Write a bio · ' : ''}
          {!profile.location ? 'Set location · ' : ''}
          {!profile.price ? 'Add pricing · ' : ''}
          {profile.services.length === 0 ? 'Add a service' : ''}
        </Text>
      )}
    </View>
  )
}

function ServiceCard({ service, onEdit }: { service: any; onEdit: () => void }) {
  return (
    <TouchableOpacity style={svc.card} onPress={onEdit}>
      <View style={svc.cardLeft}>
        <View style={svc.cardIcon}>
          <Text style={{ fontSize: 20 }}>{service.emoji || '✨'}</Text>
        </View>
        <View style={svc.cardInfo}>
          <Text style={svc.cardTitle}>{service.title}</Text>
          <Text style={svc.cardMeta}>{service.duration} min · From £{service.price}</Text>
          <Text style={svc.cardDesc} numberOfLines={1}>{service.description}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#ccc" />
    </TouchableOpacity>
  )
}

export default function ProviderOnboarding() {
  const router = useRouter()
  const [phase, setPhase] = useState<'type' | 'build' | 'services' | 'review'>('type')
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'services'>('overview')
  const [loading, setLoading] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [activeSheet, setActiveSheet] = useState<'name' | 'category' | 'bio' | 'location' | 'price' | 'service' | 'policy' | null>(null)
  const [editingServiceIdx, setEditingServiceIdx] = useState<number | null>(null)

  const [profile, setProfile] = useState({
    offerType: '',
    name: '',
    category: '',
    categoryEmoji: '✨',
    bio: '',
    personalNote: '',
    showPersonalNote: false,
    location: '',
    price: '',
    sessionDuration: '60',
    responseTime: '~15 minutes',
    cancellationPolicy: 'Flexible',
    services: [] as any[],
    media: [] as any[],
  })

  const [draft, setDraft] = useState<any>({})

  function openSheet(name: typeof activeSheet, initial?: any) {
    setDraft(initial ?? {})
    setActiveSheet(name)
  }

  function closeSheet() {
    setActiveSheet(null)
    setDraft({})
  }

  function saveSheet() {
    setProfile(p => ({ ...p, ...draft }))
    closeSheet()
  }

  const strengthChecks = [
    !!profile.name,
    !!profile.category,
    !!profile.bio,
    !!profile.location,
    !!profile.price,
    profile.services.length > 0,
  ]
  const strengthScore = strengthChecks.filter(Boolean).length
  const strengthPct = Math.round((strengthScore / strengthChecks.length) * 100)

  const ctaLabel = () => {
    if (phase === 'type') return 'Continue'
    if (phase === 'build') {
      if (strengthPct < 60) return 'Continue building'
      if (profile.services.length === 0) return 'Add your first service'
      return 'Continue'
    }
    if (phase === 'services') return 'Review & publish'
    return 'Publish profile 🚀'
  }

  function handleCTA() {
    if (phase === 'type') { setPhase('build'); return }
    if (phase === 'build') {
      if (profile.services.length === 0) {
        setEditingServiceIdx(-1)
        openSheet('service', { title: '', price: '', duration: '60', description: '', emoji: '✨' })
      } else {
        setPhase('services')
      }
      return
    }
    if (phase === 'services') { setPhase('review'); return }
    if (phase === 'review') { publish() }
  }

  function addOrUpdateService() {
    const newService = {
      title: draft.title || 'Untitled service',
      price: draft.price || '0',
      duration: draft.duration || '60',
      description: draft.description || '',
      emoji: draft.emoji || '✨',
      enabled: true,
    }

    if (editingServiceIdx === -1 || editingServiceIdx === null) {
      setProfile(p => ({ ...p, services: [...p.services, newService] }))
    } else {
      setProfile(p => {
        const updated = [...p.services]
        updated[editingServiceIdx] = newService
        return { ...p, services: updated }
      })
    }

    closeSheet()
  }

  async function publish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const username = profile.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) + Math.floor(Math.random() * 999)

    await supabase.from('profiles').update({
      role: 'provider',
      bio: profile.bio,
      location: profile.location,
      username,
    }).eq('id', user.id)

    await supabase.from('provider_profiles').upsert({
      id: user.id,
      business_name: profile.name,
      category: profile.category.toLowerCase(),
    })

    for (const service of profile.services) {
      await supabase.from('opportunities').insert({
        provider_id: user.id,
        title: service.title,
        description: service.description,
        category: profile.category.toLowerCase(),
        location: profile.location,
        price_pence: Math.round(parseFloat(service.price || '0') * 100),
        status: 'active',
      })
    }

    setLoading(false)
    router.replace('/provider/studio' as any)
  }

  const filteredCategories = CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(categorySearch.toLowerCase())
  )

  if (phase === 'type') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#111" />
          </TouchableOpacity>

          <Text style={styles.title}>What are you providing?</Text>
          <Text style={styles.subtitle}>You can add more later.</Text>

          <View style={{ gap: 14, marginTop: 32 }}>
            {OFFER_TYPES.map((type) => {
              const isSelected = profile.offerType === type.label
              return (
                <TouchableOpacity
                  key={type.label}
                  style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                  onPress={() => setProfile(p => ({ ...p, offerType: type.label }))}
                >
                  <View style={[styles.typeIconBox, { backgroundColor: isSelected ? type.color : '#F5F5F5' }]}>
                    <Text style={{ fontSize: 26 }}>{type.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.typeLabel}>{type.label}</Text>
                    <Text style={styles.typeDesc}>{type.desc}</Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.emptyCircle} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, !profile.offerType && styles.ctaDisabled]}
            onPress={handleCTA}
            disabled={!profile.offerType}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'build') {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b' }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          <TouchableOpacity style={build.cover} activeOpacity={0.85}>
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
            <View style={build.coverOverlay}>
              <View style={build.coverHint}>
                <Feather name="camera" size={16} color="#fff" />
                <Text style={build.coverHintText}>Tap to change cover photo</Text>
              </View>
            </View>

            <TouchableOpacity style={build.backBtn} onPress={() => setPhase('type')}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={build.topRight}>
              <TouchableOpacity style={build.iconBtn}>
                <Feather name="upload" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={build.iconBtn}>
                <Feather name="menu" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          <View style={build.avatarRow}>
            <TouchableOpacity style={build.avatar}>
              <Text style={{ fontSize: 36 }}>{profile.categoryEmoji}</Text>
              <View style={build.avatarCamera}>
                <Feather name="camera" size={12} color="#fff" />
              </View>
              <Text style={build.avatarHint}>Tap to change{'\n'}profile photo</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => openSheet('name', { name: profile.name })} style={build.nameRow}>
              <Text style={[build.name, !profile.name && build.namePlaceholder]}>
                {profile.name || 'Tap to add your name'}
              </Text>
              <Feather name="edit-2" size={14} color="rgba(255,255,255,0.3)" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openSheet('category')} style={build.categoryRow}>
              <Text style={[build.category, !profile.category && build.categoryPlaceholder]}>
                {profile.category || 'Tap to set your profession'}
              </Text>
              <Feather name="edit-2" size={12} color="rgba(255,255,255,0.3)" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            <View style={build.tagsRow}>
              <TouchableOpacity
                style={build.tag}
                onPress={() => openSheet('location', { location: profile.location })}
              >
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={build.tagText}>{profile.location || 'Add location'}</Text>
              </TouchableOpacity>
              <View style={build.tag}>
                <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={build.tagText}>Verified</Text>
              </View>
              <View style={build.tag}>
                <Text style={build.tagText}>⭐ Top rated</Text>
              </View>
            </View>

            <View style={build.stats}>
              {[
                { value: '4.9', label: 'Rating' },
                { value: '0', label: 'Reviews' },
                { value: '0', label: 'Clients' },
                { value: '0', label: 'Bookings' },
              ].map((item, index, arr) => (
                <View key={item.label} style={[build.stat, index < arr.length - 1 && build.statBorder]}>
                  <Text style={build.statValue}>{item.value}</Text>
                  <Text style={build.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={build.tabs}>
              {(['Overview', 'Gallery', 'Services'] as const).map((tab) => {
                const key = tab.toLowerCase() as 'overview' | 'gallery' | 'services'
                const isActive = activeTab === key
                return (
                  <TouchableOpacity key={tab} style={build.tab} onPress={() => setActiveTab(key)}>
                    <Text style={[build.tabText, isActive && build.tabTextActive]}>{tab}</Text>
                    {isActive && <View style={build.tabIndicator} />}
                  </TouchableOpacity>
                )
              })}
            </View>

            {activeTab === 'overview' && (
              <View>
                <TouchableOpacity
                  style={build.priceCard}
                  onPress={() => openSheet('price', { price: profile.price, sessionDuration: profile.sessionDuration })}
                >
                  <View>
                    <Text style={build.priceValue}>
                      {profile.price ? `From £${profile.price}` : 'Tap to edit pricing'}
                      {profile.price ? <Text style={build.priceSub}> / session</Text> : ''}
                    </Text>
                    {profile.price ? (
                      <Text style={build.priceDuration}>⏱ {profile.sessionDuration} min sessions</Text>
                    ) : null}
                  </View>
                  <View style={build.priceEditHint}>
                    <Text style={build.priceEditText}>Tap to edit pricing</Text>
                    <Feather name="edit-2" size={12} color="rgba(255,255,255,0.4)" />
                  </View>
                </TouchableOpacity>

                <Text style={build.sectionTitle}>Where I'm based</Text>
                <TouchableOpacity
                  style={build.mapCard}
                  onPress={() => openSheet('location', { location: profile.location })}
                >
                  <LinearGradient colors={['#1a1a2e', '#0f3460']} style={StyleSheet.absoluteFill} />
                  <View style={build.mapPin}>
                    <Ionicons name="location" size={28} color="#ff6b35" />
                  </View>
                  <View style={build.mapLabel}>
                    <Text style={build.mapLabelText}>{profile.location || 'Tap to edit address'}</Text>
                  </View>
                  <View style={build.mapEditHint}>
                    <Text style={build.mapEditText}>Tap to edit address</Text>
                    <Feather name="edit-2" size={12} color="rgba(255,255,255,0.6)" />
                  </View>
                </TouchableOpacity>

                <Text style={build.sectionTitle}>About {profile.name?.split(' ')[0] || 'you'}</Text>
                <TouchableOpacity
                  style={build.bioCard}
                  onPress={() => openSheet('bio', {
                    bio: profile.bio,
                    showPersonalNote: profile.showPersonalNote,
                    personalNote: profile.personalNote,
                  })}
                >
                  <Text style={[build.bioText, !profile.bio && build.bioPlaceholder]} numberOfLines={3}>
                    {profile.bio || 'Tap to write your bio'}
                  </Text>
                  <View style={build.bioEditHint}>
                    <Feather name="edit-2" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={build.bioEditText}>Tap bio</Text>
                  </View>
                </TouchableOpacity>

                <ProfileStrength profile={profile} />
              </View>
            )}

            {activeTab === 'gallery' && (
              <View style={{ marginTop: 8 }}>
                {profile.media.length > 0 ? (
                  <View style={build.galleryGrid}>
                    {profile.media.map((item: any, index: number) => (
                      <View key={index} style={build.galleryItem}>
                        <Text style={{ fontSize: 32, textAlign: 'center' }}>🖼️</Text>
                      </View>
                    ))}
                    <TouchableOpacity style={build.galleryAdd}>
                      <Ionicons name="add" size={28} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={build.galleryEmpty}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>📸</Text>
                    <Text style={build.galleryEmptyTitle}>No posts yet</Text>
                    <Text style={build.galleryEmptyDesc}>
                      Add photos and videos to show clients your work. Available after installing the app on your phone.
                    </Text>
                    <TouchableOpacity style={build.galleryEmptyBtn}>
                      <Ionicons name="add" size={18} color="#ff6b35" />
                      <Text style={build.galleryEmptyBtnText}>Add your first post</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'services' && (
              <View style={{ marginTop: 8 }}>
                {profile.services.length === 0 ? (
                  <View style={build.galleryEmpty}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>🗂️</Text>
                    <Text style={build.galleryEmptyTitle}>No services yet</Text>
                    <Text style={build.galleryEmptyDesc}>
                      Add your first service so clients know what they can book and how much it costs.
                    </Text>
                    <TouchableOpacity
                      style={build.galleryEmptyBtn}
                      onPress={() => {
                        setEditingServiceIdx(-1)
                        openSheet('service', { title: '', price: '', duration: '60', description: '', emoji: '✨' })
                      }}
                    >
                      <Ionicons name="add" size={18} color="#ff6b35" />
                      <Text style={build.galleryEmptyBtnText}>Add your first service</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {profile.services.map((service: any, index: number) => (
                      <ServiceCard
                        key={index}
                        service={service}
                        onEdit={() => {
                          setEditingServiceIdx(index)
                          openSheet('service', { ...service })
                        }}
                      />
                    ))}
                    <TouchableOpacity
                      style={build.addServiceBtn}
                      onPress={() => {
                        setEditingServiceIdx(-1)
                        openSheet('service', { title: '', price: '', duration: '60', description: '', emoji: '✨' })
                      }}
                    >
                      <Ionicons name="add" size={20} color="#ff6b35" />
                      <Text style={build.addServiceText}>Add another service</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={handleCTA}>
            <Text style={styles.ctaText}>{ctaLabel()}</Text>
          </TouchableOpacity>
        </View>

        <BottomSheet visible={activeSheet === 'name'} onClose={closeSheet} title="Your name">
          <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <Text style={sheet.label}>Professional name</Text>
            <TextInput
              style={sheet.input}
              value={draft.name ?? profile.name}
              onChangeText={(value) => setDraft((d: any) => ({ ...d, name: value }))}
              placeholder="e.g. Nails by Shirah"
              placeholderTextColor="#999"
              autoFocus
            />
            <TouchableOpacity style={sheet.saveBtn} onPress={saveSheet}>
              <Text style={sheet.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        <BottomSheet visible={activeSheet === 'category'} onClose={closeSheet} title="Your profession">
          <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <View style={sheet.searchBar}>
              <Feather name="search" size={16} color="#999" />
              <TextInput
                style={sheet.searchInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search..."
                placeholderTextColor="#999"
              />
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {filteredCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  style={sheet.catRow}
                  onPress={() => {
                    setProfile(p => ({ ...p, category: cat.label, categoryEmoji: cat.emoji }))
                    closeSheet()
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 14 }}>{cat.emoji}</Text>
                  <Text style={sheet.catLabel}>{cat.label}</Text>
                  {profile.category === cat.label && (
                    <View style={sheet.catCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </BottomSheet>

        <BottomSheet visible={activeSheet === 'bio'} onClose={closeSheet} title="About you">
          <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <Text style={sheet.label}>Bio</Text>
            <TextInput
              multiline
              style={[sheet.input, { height: 120, textAlignVertical: 'top', paddingTop: 14 }]}
              value={draft.bio ?? profile.bio}
              onChangeText={(value) => setDraft((d: any) => ({ ...d, bio: value }))}
              placeholder="Tell clients about yourself, your experience and what makes you special..."
              placeholderTextColor="#999"
              autoFocus
            />
            <TouchableOpacity
              style={sheet.toggleRow}
              onPress={() => setDraft((d: any) => ({ ...d, showPersonalNote: !d.showPersonalNote }))}
            >
              <View style={sheet.toggleLeft}>
                <Text style={sheet.toggleTitle}>Add a personal note</Text>
                <Text style={sheet.toggleDesc}>Optional — for studios or teams</Text>
              </View>
              <View style={(draft.showPersonalNote ?? profile.showPersonalNote) ? sheet.toggleOn : sheet.toggleOff}>
                <View style={sheet.toggleThumb} />
              </View>
            </TouchableOpacity>
            {(draft.showPersonalNote ?? profile.showPersonalNote) && (
              <TextInput
                multiline
                style={[sheet.input, { height: 100, textAlignVertical: 'top', paddingTop: 14, marginTop: 12 }]}
                value={draft.personalNote ?? profile.personalNote}
                onChangeText={(value) => setDraft((d: any) => ({ ...d, personalNote: value }))}
                placeholder="A personal note from the owner..."
                placeholderTextColor="#999"
              />
            )}
            <TouchableOpacity style={sheet.saveBtn} onPress={saveSheet}>
              <Text style={sheet.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        <BottomSheet visible={activeSheet === 'location'} onClose={closeSheet} title="Where are you based?">
          <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <Text style={sheet.label}>Location</Text>
            <TextInput
              style={sheet.input}
              value={draft.location ?? profile.location}
              onChangeText={(value) => setDraft((d: any) => ({ ...d, location: value }))}
              placeholder="e.g. North London"
              placeholderTextColor="#999"
              autoFocus
            />
            <TouchableOpacity style={sheet.saveBtn} onPress={saveSheet}>
              <Text style={sheet.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        <BottomSheet visible={activeSheet === 'price'} onClose={closeSheet} title="Edit pricing">
          <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <Text style={sheet.label}>Price (£)</Text>
            <View style={sheet.priceRow}>
              <Text style={sheet.priceCurrency}>£</Text>
              <TextInput
                style={sheet.priceInput}
                value={draft.price ?? profile.price}
                onChangeText={(value) => setDraft((d: any) => ({ ...d, price: value }))}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <Text style={sheet.label}>Duration</Text>
            <View style={sheet.pillRow}>
              {DURATIONS.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={(draft.sessionDuration ?? profile.sessionDuration) === duration ? sheet.pillActive : sheet.pill}
                  onPress={() => setDraft((d: any) => ({ ...d, sessionDuration: duration }))}
                >
                  <Text style={(draft.sessionDuration ?? profile.sessionDuration) === duration ? sheet.pillTextActive : sheet.pillText}>
                    {duration}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={sheet.saveBtn} onPress={saveSheet}>
              <Text style={sheet.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        <BottomSheet visible={activeSheet === 'service'} onClose={closeSheet} title="Add a service">
          <ScrollView style={{ paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={sheet.label}>Service name</Text>
            <TextInput
              style={sheet.input}
              value={draft.title ?? ''}
              onChangeText={(value) => setDraft((d: any) => ({ ...d, title: value }))}
              placeholder="e.g. Full Set Acrylics"
              placeholderTextColor="#999"
            />
            <Text style={sheet.label}>Price (£)</Text>
            <View style={sheet.priceRow}>
              <Text style={sheet.priceCurrency}>£</Text>
              <TextInput
                style={sheet.priceInput}
                value={draft.price ?? ''}
                onChangeText={(value) => setDraft((d: any) => ({ ...d, price: value }))}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
            <Text style={sheet.label}>Duration</Text>
            <View style={sheet.pillRow}>
              {DURATIONS.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={(draft.duration ?? '60') === duration ? sheet.pillActive : sheet.pill}
                  onPress={() => setDraft((d: any) => ({ ...d, duration }))}
                >
                  <Text style={(draft.duration ?? '60') === duration ? sheet.pillTextActive : sheet.pillText}>
                    {duration}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={sheet.label}>Description</Text>
            <TextInput
              multiline
              style={[sheet.input, { height: 100, textAlignVertical: 'top', paddingTop: 14 }]}
              value={draft.description ?? ''}
              onChangeText={(value) => setDraft((d: any) => ({ ...d, description: value }))}
              placeholder="What's included in this service..."
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={[sheet.saveBtn, { marginTop: 24 }]} onPress={addOrUpdateService}>
              <Text style={sheet.saveBtnText}>
                {editingServiceIdx === -1 ? 'Add service' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheet>
      </View>
    )
  }

  if (phase === 'services') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setPhase('build')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#111" />
          </TouchableOpacity>

          <Text style={styles.title}>My Services</Text>
          <Text style={styles.subtitle}>Add services, set pricing and availability.</Text>

          <View style={{ marginTop: 24, gap: 12 }}>
            {profile.services.map((service, index) => (
              <TouchableOpacity
                key={index}
                style={svcList.card}
                onPress={() => {
                  setEditingServiceIdx(index)
                  openSheet('service', { ...service })
                }}
              >
                <View style={svcList.left}>
                  <View style={svcList.icon}>
                    <Text style={{ fontSize: 22 }}>{service.emoji || '✨'}</Text>
                  </View>
                  <View style={svcList.info}>
                    <Text style={svcList.title}>{service.title}</Text>
                    <Text style={svcList.meta}>{service.duration} min · From £{service.price}</Text>
                  </View>
                </View>
                <View style={svcList.toggle}>
                  <View style={svcList.toggleOn} />
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={svcList.addBtn}
              onPress={() => {
                setEditingServiceIdx(-1)
                openSheet('service', { title: '', price: '', duration: '60', description: '', emoji: '✨' })
              }}
            >
              <Ionicons name="add" size={22} color="#111" />
              <Text style={svcList.addText}>Add another service</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={handleCTA}>
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setPhase('services')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#111" />
        </TouchableOpacity>

        <Text style={styles.title}>Review your profile</Text>
        <Text style={styles.subtitle}>Make sure everything looks good before you go live.</Text>

        <View style={{ marginTop: 32, gap: 12 }}>
          {[
            { icon: '✅', label: 'Profile info', value: profile.name ? 'Looks good' : 'Incomplete', ok: !!profile.name },
            { icon: '📸', label: 'Profile photo & cover', value: 'Looks good', ok: true },
            { icon: '🗂️', label: 'Services', value: profile.services.length > 0 ? `${profile.services.length} service${profile.services.length > 1 ? 's' : ''} added` : 'None added', ok: profile.services.length > 0 },
            { icon: '📍', label: 'Location', value: profile.location || 'Not set', ok: !!profile.location },
          ].map((item) => (
            <View key={item.label} style={review.row}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
              <Text style={review.label}>{item.label}</Text>
              <Text style={[review.value, { color: item.ok ? '#10b981' : '#f59e0b' }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cta} onPress={handleCTA} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Publish profile 🚀</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 140 },
  backBtn: { marginTop: 16, marginBottom: 8 },
  title: { marginTop: 24, fontSize: 36, lineHeight: 42, fontWeight: '700', color: '#111', letterSpacing: -1.4 },
  subtitle: { marginTop: 12, fontSize: 16, lineHeight: 24, color: '#777' },
  typeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 20, padding: 16, gap: 14 },
  typeCardSelected: { borderColor: '#111', borderWidth: 1.5 },
  typeIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 18, fontWeight: '600', color: '#111' },
  typeDesc: { fontSize: 13, color: '#777', marginTop: 3, lineHeight: 18 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#D8D8D8' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cta: { height: 58, borderRadius: 16, backgroundColor: '#ff6b35', alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: '#E0E0E0' },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#fff' },
})

const build = StyleSheet.create({
  cover: { height: height * 0.28, justifyContent: 'flex-end', overflow: 'hidden' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  coverHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  coverHintText: { fontSize: 13, color: '#fff' },
  backBtn: { position: 'absolute', top: 52, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  topRight: { position: 'absolute', top: 52, right: 16, flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarRow: { paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#09090b' },
  avatarCamera: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff6b35', alignItems: 'center', justifyContent: 'center' },
  avatarHint: { position: 'absolute', left: 88, top: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  name: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  namePlaceholder: { color: 'rgba(255,255,255,0.3)' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 14 },
  category: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  categoryPlaceholder: { color: 'rgba(255,255,255,0.25)' },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  stats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' },
  statValue: { fontSize: 17, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#fff' },
  tabIndicator: { position: 'absolute', bottom: 0, width: 32, height: 2, backgroundColor: '#ff6b35', borderRadius: 2 },
  priceCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 20 },
  priceValue: { fontSize: 19, fontWeight: '700', color: '#fff' },
  priceSub: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.4)' },
  priceDuration: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  priceEditHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceEditText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12 },
  mapCard: { height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 20, justifyContent: 'center', alignItems: 'center' },
  mapPin: { marginBottom: 8 },
  mapLabel: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  mapLabelText: { fontSize: 13, color: '#fff' },
  mapEditHint: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapEditText: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  bioCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 },
  bioText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
  bioPlaceholder: { color: 'rgba(255,255,255,0.25)' },
  bioEditHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  bioEditText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  addServiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, borderStyle: 'dashed', justifyContent: 'center', marginTop: 8 },
  addServiceText: { fontSize: 14, fontWeight: '600', color: '#ff6b35' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  galleryItem: { width: (width - 44) / 3, height: (width - 44) / 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  galleryAdd: { width: (width - 44) / 3, height: (width - 44) / 3, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  galleryEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  galleryEmptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  galleryEmptyDesc: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  galleryEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  galleryEmptyBtnText: { fontSize: 14, fontWeight: '600', color: '#ff6b35' },
})

const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 10, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#111', height: 54 },
  saveBtn: { height: 54, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, height: 46, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  catLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111' },
  catCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5', marginTop: 12 },
  toggleLeft: { flex: 1 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  toggleDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  toggleOn: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', paddingHorizontal: 4 },
  toggleOff: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', justifyContent: 'center', paddingHorizontal: 4 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' },
  priceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 14, paddingHorizontal: 16 },
  priceCurrency: { fontSize: 24, fontWeight: '700', color: '#111', marginRight: 8 },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '700', color: '#111', paddingVertical: 14 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E8E8E8' },
  pillActive: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111' },
  pillText: { fontSize: 14, color: '#666' },
  pillTextActive: { fontSize: 14, color: '#fff', fontWeight: '600' },
})

const strength = StyleSheet.create({
  container: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  sublabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  bar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', borderRadius: 2 },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 16 },
})

const svc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, marginBottom: 8 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  cardDesc: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
})

const svcList = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 16, padding: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#111' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#ff6b35', justifyContent: 'center', paddingHorizontal: 3, alignItems: 'flex-end' },
  toggleOn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 16, padding: 16, borderStyle: 'dashed' },
  addText: { fontSize: 15, fontWeight: '600', color: '#111' },
})

const review = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 16, padding: 16 },
  label: { flex: 1, fontSize: 15, fontWeight: '500', color: '#111' },
  value: { fontSize: 13, fontWeight: '600' },
})