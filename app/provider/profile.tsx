import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
  Dimensions, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { ProviderNav } from '@/components/ProviderNav'
import {
  ChevronLeft, Share2, MapPin, BadgeCheck, MessageCircle,
  ChevronRight, ChevronDown, ChevronUp, Plus, X, Edit3,
  Eye, EyeOff, Star, Shield, Clock, Repeat2, CheckCircle,
  Globe, Calendar, MoreHorizontal,
} from 'lucide-react-native'
import { Feather as FeatherIcon } from '@expo/vector-icons'

const { width } = Dimensions.get('window')
const HERO_H = 220
const TABS = ['Overview', 'Portfolio', 'Services'] as const
type Tab = typeof TABS[number]

const SECTION_TYPES = [
  { type: 'whats_included', label: "What's included", icon: '✓', desc: 'Checklist of what clients get' },
  { type: 'how_i_work', label: 'How I work', icon: '⚡', desc: 'Step-by-step cards' },
  { type: 'faqs', label: 'FAQs', icon: '❓', desc: 'Expandable Q&A' },
  { type: 'policies', label: 'Policies', icon: '📋', desc: 'Cancellation, lateness, refunds' },
  { type: 'experience', label: 'Experience', icon: '🏆', desc: 'Credentials & background' },
  { type: 'requirements', label: 'Requirements', icon: '📌', desc: 'What clients need' },
  { type: 'service_areas', label: 'Service areas', icon: '📍', desc: 'Where you operate' },
  { type: 'languages', label: 'Languages', icon: '🌍', desc: 'Languages you speak' },
]

function Divider() { return <View style={g.divider} /> }

function EditBadge({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={g.editBadge} onPress={onPress}>
      <FeatherIcon name="edit-2" size={11} color="#ff385c" />
      <Text style={g.editBadgeText}>Edit</Text>
    </TouchableOpacity>
  )
}

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={sh.overlay} activeOpacity={1} onPress={onClose} />
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <View style={sh.header}>
            <Text style={sh.title}>{title}</Text>
            <TouchableOpacity style={sh.closeBtn} onPress={onClose}><X size={18} color="#111" /></TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <TouchableOpacity style={g.faqRow} onPress={() => setOpen(!open)} activeOpacity={0.75}>
      <View style={g.faqTop}>
        <Text style={g.faqQ}>{q}</Text>
        {open ? <ChevronUp size={18} color="#717171" /> : <ChevronDown size={18} color="#717171" />}
      </View>
      {open && <Text style={g.faqA}>{a}</Text>}
    </TouchableOpacity>
  )
}

function SectionRenderer({ section }: { section: any }) {
  const content = section.content ?? {}
  if (section.type === 'how_i_work') {
    const steps: any[] = content.steps ?? []
    if (!steps.length) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.howScroll}>
          {steps.map((step, i) => (
            <View key={i} style={g.howCard}>
              <View style={g.howIcon}><Text style={{ fontSize: 20 }}>{['💬','📅','🎯','✅'][i % 4]}</Text></View>
              <Text style={g.howTitle}>{step.title}</Text>
              {step.desc ? <Text style={g.howDesc}>{step.desc}</Text> : null}
            </View>
          ))}
        </ScrollView>
        <Divider />
      </View>
    )
  }
  if (section.type === 'whats_included') {
    const items: string[] = content.items ?? []
    if (!items.length) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        {content.description ? <Text style={g.bodyText}>{content.description}</Text> : null}
        <View style={{ gap: 14, marginTop: 8 }}>
          {items.map((item, i) => (
            <View key={i} style={g.checkRow}>
              <CheckCircle size={18} color="#222" strokeWidth={1.5} />
              <Text style={g.checkText}>{item}</Text>
            </View>
          ))}
        </View>
        <Divider />
      </View>
    )
  }
  if (section.type === 'faqs') {
    const faqs: any[] = content.faqs ?? []
    if (!faqs.length) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        {faqs.map((faq, i) => (
          <View key={i}>
            <FaqRow q={faq.q} a={faq.a} />
            {i < faqs.length - 1 && <View style={{ height: 1, backgroundColor: '#f0f0f0' }} />}
          </View>
        ))}
        <Divider />
      </View>
    )
  }
  if (section.type === 'policies') {
    if (!content.cancellation && !content.lateness && !content.refunds) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        <View style={{ gap: 16, marginTop: 4 }}>
          {content.cancellation && <View style={g.policyRow}><Shield size={20} color="#222" strokeWidth={1.5} /><View style={{ flex: 1 }}><Text style={g.policyLabel}>Cancellation</Text><Text style={g.policyText}>{content.cancellation}</Text></View><ChevronRight size={16} color="#717171" /></View>}
          {content.lateness && <View style={g.policyRow}><Clock size={20} color="#222" strokeWidth={1.5} /><View style={{ flex: 1 }}><Text style={g.policyLabel}>Lateness</Text><Text style={g.policyText}>{content.lateness}</Text></View><ChevronRight size={16} color="#717171" /></View>}
          {content.refunds && <View style={g.policyRow}><Repeat2 size={20} color="#222" strokeWidth={1.5} /><View style={{ flex: 1 }}><Text style={g.policyLabel}>Refunds</Text><Text style={g.policyText}>{content.refunds}</Text></View><ChevronRight size={16} color="#717171" /></View>}
        </View>
        <Divider />
      </View>
    )
  }
  if (section.type === 'experience') {
    if (!content.summary) return null
    return (<View style={g.sectionWrap}><Text style={g.sectionTitle}>{section.title}</Text><Text style={g.bodyText}>{content.summary}</Text><Divider /></View>)
  }
  if (section.type === 'requirements') {
    const items: string[] = content.items ?? []
    if (!items.length) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        <View style={{ gap: 12, marginTop: 4 }}>
          {items.map((item, i) => <View key={i} style={g.checkRow}><View style={g.bullet} /><Text style={g.checkText}>{item}</Text></View>)}
        </View>
        <Divider />
      </View>
    )
  }
  return null
}

export default function ProviderProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('Overview')
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [draft, setDraft] = useState<any>({})
  const [sections, setSections] = useState<any[]>([])
  const [editingSection, setEditingSection] = useState<any>(null)
  const [showAddSection, setShowAddSection] = useState(false)
  const [showSectionEditor, setShowSectionEditor] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [bioExpanded, setBioExpanded] = useState(false)

  const [profile, setProfile] = useState({ id: '', full_name: '', username: '', bio: '', location: '', email: '', category: '', business_name: '', years_active: '', total_clients: '', opportunities: [] as any[] })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data }, { data: opps }, { data: secs }] = await Promise.all([
      supabase.from('profiles').select('*, provider_profiles(*)').eq('id', user.id).single(),
      supabase.from('opportunities').select('*').eq('provider_id', user.id).eq('status', 'active'),
      supabase.from('provider_overview_sections').select('*').eq('provider_id', user.id).order('position'),
    ])
    if (data) {
      setProfile({ id: user.id, full_name: data.full_name ?? '', username: data.username ?? '', bio: data.bio ?? '', location: data.location ?? '', email: user.email ?? '', category: data.provider_profiles?.category ?? '', business_name: data.provider_profiles?.business_name ?? '', years_active: data.provider_profiles?.years_active ?? '', total_clients: data.provider_profiles?.total_clients ?? '', opportunities: opps ?? [] })
    }
    setSections(secs ?? [])
    setLoading(false)
  }

  async function saveField(updates: any) {
    setSaving(true)
    const pu: any = {}; const pp: any = {}
    if (updates.full_name !== undefined) pu.full_name = updates.full_name
    if (updates.bio !== undefined) pu.bio = updates.bio
    if (updates.location !== undefined) pu.location = updates.location
    if (updates.category !== undefined) pp.category = updates.category
    if (updates.business_name !== undefined) pp.business_name = updates.business_name
    if (updates.years_active !== undefined) pp.years_active = updates.years_active
    if (updates.total_clients !== undefined) pp.total_clients = updates.total_clients
    if (Object.keys(pu).length) await supabase.from('profiles').update(pu).eq('id', profile.id)
    if (Object.keys(pp).length) await supabase.from('provider_profiles').upsert({ id: profile.id, ...pp })
    setProfile(p => ({ ...p, ...updates }))
    setSaving(false); setActiveSheet(null); setDraft({})
  }

  async function addSection(type: string) {
    const info = SECTION_TYPES.find(t => t.type === type)
    if (!info) return
    const maxPos = sections.length > 0 ? Math.max(...sections.map(s => s.position)) : 0
    const { data } = await supabase.from('provider_overview_sections').insert({ provider_id: profile.id, type, title: info.label, content: {}, position: maxPos + 1, visible: true }).select().single()
    if (data) { setSections(prev => [...prev, data]); setEditingSection(data); setShowAddSection(false); setShowSectionEditor(true) }
  }

  async function saveSection(id: string, updates: any) {
    await supabase.from('provider_overview_sections').update(updates).eq('id', id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    setShowSectionEditor(false); setEditingSection(null)
  }

  async function toggleSection(id: string) {
    const sec = sections.find(s => s.id === id); if (!sec) return
    const v = !sec.visible
    await supabase.from('provider_overview_sections').update({ visible: v }).eq('id', id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: v } : s))
  }

  async function moveSection(idx: number, dir: 'up' | 'down') {
    const arr = [...sections]; const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    const updated = arr.map((s, i) => ({ ...s, position: i }))
    setSections(updated)
    await Promise.all(updated.map(s => supabase.from('provider_overview_sections').update({ position: s.position }).eq('id', s.id)))
  }

  async function deleteSection(id: string) {
    Alert.alert('Delete section?', 'This removes it from your profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('provider_overview_sections').delete().eq('id', id)
        setSections(prev => prev.filter(s => s.id !== id))
        setShowSectionEditor(false); setEditingSection(null)
      }},
    ])
  }

  function bookService(opp: any) {
    let qs: any[] = []
    try { qs = typeof opp.booking_questions === 'string' ? JSON.parse(opp.booking_questions || '[]') : opp.booking_questions ?? [] } catch {}
    const valid = Array.isArray(qs) ? qs.filter((q: any) => q?.question?.trim()) : []
    const bp = { providerId: profile.id, serviceId: opp.id, serviceName: opp.title, servicePrice: String(opp.price_pence ?? 0), serviceDuration: String(opp.metadata?.duration ?? 60) }
    router.push(valid.length > 0 ? { pathname: '/book/[providerId]/questions' as any, params: { ...bp, questions: JSON.stringify(valid) } } : { pathname: '/book/[providerId]/calendar' as any, params: { ...bp, answers: '[]' } })
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#222" /></View>

  const name = profile.full_name || profile.business_name || 'Your Name'
  const firstName = name.split(' ')[0]
  const featuredOpp = profile.opportunities[0]
  const visibleSections = sections.filter(s => s.visible)
  const howSection = visibleSections.find(s => s.type === 'how_i_work')
  const faqSection = visibleSections.find(s => s.type === 'faqs')
  const areasSection = visibleSections.find(s => s.type === 'service_areas')
  const langSection = visibleSections.find(s => s.type === 'languages')
  const otherSections = visibleSections.filter(s => !['how_i_work','faqs','service_areas','languages'].includes(s.type))

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero */}
        <TouchableOpacity style={{ height: HERO_H }} activeOpacity={0.9}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
            <FeatherIcon name="camera" size={32} color="#bbb" />
            <Text style={{ fontSize: 13, color: '#bbb', marginTop: 8 }}>Tap to add cover photo</Text>
          </View>
          <View style={s.heroNav}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()}><ChevronLeft size={20} color="#222" /></TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.heroBtn}><Share2 size={18} color="#222" strokeWidth={1.5} /></TouchableOpacity>
              <TouchableOpacity style={s.heroBtn}><MoreHorizontal size={18} color="#222" /></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* Profile header */}
        <View style={s.profileHeader}>
          <View style={s.profileRow}>
            <TouchableOpacity style={s.avatarWrap} activeOpacity={0.85}>
              <View style={[s.avatar, { backgroundColor: '#ff385c', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{name.slice(0,1)}</Text>
              </View>
              <View style={s.avatarEditBtn}><FeatherIcon name="camera" size={12} color="#fff" /></View>
            </TouchableOpacity>
            <View style={s.profileNames}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => { setDraft({ full_name: profile.full_name, business_name: profile.business_name }); setActiveSheet('name') }}>
                <Text style={s.providerName}>{name}</Text>
                <BadgeCheck size={20} color="#1a73e8" fill="#1a73e8" />
                <FeatherIcon name="edit-2" size={13} color="#bbb" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setDraft({ category: profile.category }); setActiveSheet('category') }}>
                <Text style={s.providerCat}>{profile.category || 'Tap to set category'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.tagsRow} onPress={() => { setDraft({ location: profile.location }); setActiveSheet('location') }}>
                <MapPin size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>{profile.location || 'Add location'}</Text>
                <Text style={s.tagDot}>·</Text>
                <Shield size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>Verified</Text>
                <Text style={s.tagDot}>·</Text>
                <Star size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>Top rated</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats — tap to edit */}
          <TouchableOpacity style={s.statsBox} onPress={() => { setDraft({ years_active: profile.years_active, total_clients: profile.total_clients }); setActiveSheet('stats') }} activeOpacity={0.85}>
            <View style={s.statCell}>
              <Text style={s.statNum}>4.9</Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statCell}>
              <Text style={s.statNum}>0</Text>
              <Text style={s.statLabel}>Reviews</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.statCell}>
              <Text style={s.statNum}>{profile.total_clients || '0'}</Text>
              <Text style={s.statLabel}>Clients</Text>
            </View>
            {profile.years_active ? (
              <>
                <View style={s.statSep} />
                <View style={s.statCell}>
                  <Text style={s.statNum}>{profile.years_active}</Text>
                  <Text style={s.statLabel}>Yrs exp.</Text>
                </View>
              </>
            ) : null}
            <View style={s.statEditHint}>
              <FeatherIcon name="edit-2" size={11} color="#bbb" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabsContent}>
          {TABS.map(t => (
            <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Divider />

        {/* Overview */}
        {tab === 'Overview' && (
          <View>
            {/* About */}
            <View style={g.sectionWrap}>
              <View style={g.sectionRow}>
                <Text style={g.sectionTitle}>About me</Text>
                <EditBadge onPress={() => { setDraft({ bio: profile.bio }); setActiveSheet('bio') }} />
              </View>
              <Text style={g.bodyText} numberOfLines={bioExpanded ? undefined : 4}>
                {profile.bio || 'Tap Edit to add your bio — tell clients about yourself, your experience and what makes you special.'}
              </Text>
              {profile.bio && profile.bio.length > 120 && (
                <TouchableOpacity style={g.showMoreBtn} onPress={() => setBioExpanded(!bioExpanded)}>
                  <Text style={g.showMoreText}>{bioExpanded ? 'Show less' : 'Show more'}</Text>
                  {bioExpanded ? <ChevronUp size={15} color="#222" /> : <ChevronDown size={15} color="#222" />}
                </TouchableOpacity>
              )}
              <Divider />
            </View>

            {/* Reviews */}
            <View style={g.sectionWrap}>
              <View style={g.sectionRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Star size={16} color="#222" fill="#222" />
                  <Text style={g.sectionTitle}>4.9</Text>
                  <Text style={g.reviewCount}>· 0 reviews</Text>
                </View>
              </View>
              <Text style={g.noReviewsText}>Reviews appear here after completed bookings.</Text>
              <Divider />
            </View>

            {/* Services preview */}
            {profile.opportunities.length > 0 && (
              <View style={g.sectionWrap}>
                <View style={g.sectionRow}>
                  <Text style={g.sectionTitle}>Services</Text>
                  <TouchableOpacity onPress={() => setTab('Services')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={g.viewAll}>View all</Text>
                    <ChevronRight size={14} color="#717171" />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.howScroll}>
                  {profile.opportunities.map((opp: any) => (
                    <TouchableOpacity key={opp.id} style={g.serviceChip} onPress={() => bookService(opp)}>
                      <Text style={g.serviceChipTitle} numberOfLines={2}>{opp.title}</Text>
                      <Text style={g.serviceChipPrice}>£{((opp.price_pence ?? 0) / 100).toFixed(0)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Divider />
              </View>
            )}

            {/* Modular sections */}
            {otherSections.map(section => <SectionRenderer key={section.id} section={section} />)}
            {howSection && <SectionRenderer section={howSection} />}

            {/* 2-col grid */}
            {(areasSection || langSection) && (
              <View style={g.sectionWrap}>
                <View style={g.gridRow}>
                  {areasSection && (
                    <View style={g.gridCard}>
                      <View style={g.gridCardHeader}><Text style={g.gridCardTitle}>{areasSection.title}</Text></View>
                      <View style={g.gridCardContent}>
                        <Calendar size={18} color="#717171" strokeWidth={1.5} />
                        <Text style={g.gridCardValue} numberOfLines={2}>{areasSection.content?.areas ?? ''}</Text>
                      </View>
                    </View>
                  )}
                  {langSection && (
                    <View style={g.gridCard}>
                      <View style={g.gridCardHeader}><Text style={g.gridCardTitle}>{langSection.title}</Text></View>
                      <View style={g.gridCardContent}>
                        <Globe size={18} color="#717171" strokeWidth={1.5} />
                        <Text style={g.gridCardValue} numberOfLines={2}>{langSection.content?.languages ?? ''}</Text>
                      </View>
                    </View>
                  )}
                </View>
                <Divider />
              </View>
            )}

            {/* FAQ */}
            {faqSection && faqSection.content?.faqs?.length > 0 && (
              <View style={g.sectionWrap}>
                <Text style={g.sectionTitle}>{faqSection.title}</Text>
                {faqSection.content.faqs.map((faq: any, i: number) => (
                  <View key={i}>
                    <FaqRow q={faq.q} a={faq.a} />
                    {i < faqSection.content.faqs.length - 1 && <View style={{ height: 1, backgroundColor: '#f0f0f0' }} />}
                  </View>
                ))}
                <Divider />
              </View>
            )}

            {/* Edit overview bar */}
            <View style={g.sectionWrap}>
              <View style={g.editBar}>
                <Text style={g.editBarLabel}>Customise your overview</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={g.editBarBtn} onPress={() => setShowAddSection(true)}>
                    <Plus size={14} color="#ff385c" />
                    <Text style={g.editBarBtnText}>Add section</Text>
                  </TouchableOpacity>
                  {sections.length > 0 && (
                    <TouchableOpacity style={[g.editBarBtn, { borderColor: '#e0e0e0' }]} onPress={() => setShowManage(true)}>
                      <Edit3 size={14} color="#717171" />
                      <Text style={[g.editBarBtnText, { color: '#717171' }]}>Manage</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Portfolio */}
        {tab === 'Portfolio' && (
          <View>
            <View style={g.sectionWrap}>
              <Text style={[g.bodyText, { color: '#717171' }]}>Add photos and videos to show clients your work. Available after installing the app on your phone.</Text>
            </View>
          </View>
        )}

        {/* Services */}
        {tab === 'Services' && (
          <View style={{ paddingTop: 8 }}>
            {profile.opportunities.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No services yet</Text>
                <TouchableOpacity style={s.addServiceBtn} onPress={() => router.push('/provider/create-listing' as any)}>
                  <Plus size={16} color="#ff385c" />
                  <Text style={s.addServiceBtnText}>Add a service</Text>
                </TouchableOpacity>
              </View>
            ) : (
              profile.opportunities.map((opp: any, i: number) => (
                <View key={opp.id}>
                  <TouchableOpacity style={g.serviceRow} onPress={() => bookService(opp)} activeOpacity={0.85}>
                    <View style={[g.serviceImg, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 22, color: '#ccc' }}>{opp.title?.slice(0,1)}</Text>
                    </View>
                    <View style={g.serviceInfo}>
                      <Text style={g.serviceTitle}>{opp.title}</Text>
                      <Text style={g.serviceDesc} numberOfLines={2}>{opp.description}</Text>
                      <Text style={g.servicePrice}>£{((opp.price_pence ?? 0) / 100).toFixed(0)} / session</Text>
                    </View>
                    <ChevronRight size={16} color="#717171" />
                  </TouchableOpacity>
                  {i < profile.opportunities.length - 1 && <Divider />}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <ProviderNav />

      {/* ── Sheets ── */}
      <Sheet visible={activeSheet === 'name'} onClose={() => { setActiveSheet(null); setDraft({}) }} title="Edit name">
        <View style={sh.body}>
          <Text style={sh.label}>Display name</Text>
          <TextInput style={sh.input} value={draft.full_name ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, full_name: v }))} placeholder="Your full name" placeholderTextColor="#999" autoFocus />
          <Text style={sh.label}>Business name</Text>
          <TextInput style={sh.input} value={draft.business_name ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, business_name: v }))} placeholder="Your business name" placeholderTextColor="#999" />
          <TouchableOpacity style={sh.saveBtn} onPress={() => saveField({ full_name: draft.full_name, business_name: draft.business_name })} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Sheet>

      <Sheet visible={activeSheet === 'bio'} onClose={() => { setActiveSheet(null); setDraft({}) }} title="About me">
        <View style={sh.body}>
          <Text style={sh.label}>Your bio</Text>
          <TextInput multiline style={[sh.input, { height: 140, textAlignVertical: 'top', paddingTop: 14 }]} value={draft.bio ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, bio: v }))} placeholder="Tell clients about yourself..." placeholderTextColor="#999" autoFocus />
          <TouchableOpacity style={sh.saveBtn} onPress={() => saveField({ bio: draft.bio })} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Sheet>

      <Sheet visible={activeSheet === 'location'} onClose={() => { setActiveSheet(null); setDraft({}) }} title="Location">
        <View style={sh.body}>
          <Text style={sh.label}>Your location</Text>
          <TextInput style={sh.input} value={draft.location ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, location: v }))} placeholder="e.g. North London" placeholderTextColor="#999" autoFocus />
          <TouchableOpacity style={sh.saveBtn} onPress={() => saveField({ location: draft.location })} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Sheet>

      <Sheet visible={activeSheet === 'category'} onClose={() => { setActiveSheet(null); setDraft({}) }} title="Category">
        <View style={sh.body}>
          <Text style={sh.label}>Your category</Text>
          <TextInput style={sh.input} value={draft.category ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, category: v }))} placeholder="e.g. Nail Technician" placeholderTextColor="#999" autoFocus />
          <TouchableOpacity style={sh.saveBtn} onPress={() => saveField({ category: draft.category })} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Sheet>

      <Sheet visible={activeSheet === 'stats'} onClose={() => { setActiveSheet(null); setDraft({}) }} title="Edit your stats">
        <View style={sh.body}>
          <Text style={sh.label}>Years of experience</Text>
          <TextInput style={sh.input} value={draft.years_active ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, years_active: v }))} placeholder="e.g. 6+" placeholderTextColor="#999" keyboardType="default" autoFocus />
          <Text style={sh.label}>Total clients served</Text>
          <TextInput style={sh.input} value={draft.total_clients ?? ''} onChangeText={v => setDraft((d: any) => ({ ...d, total_clients: v }))} placeholder="e.g. 320" placeholderTextColor="#999" keyboardType="default" />
          <TouchableOpacity style={sh.saveBtn} onPress={() => saveField({ years_active: draft.years_active, total_clients: draft.total_clients })} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* Manage sections */}
      <Modal visible={showManage} animationType="slide" transparent>
        <View style={sh.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowManage(false)} />
          <View style={[sh.sheet, { maxHeight: '85%' }]}>
            <View style={sh.handle} />
            <View style={sh.header}>
              <Text style={sh.title}>Manage sections</Text>
              <TouchableOpacity style={sh.closeBtn} onPress={() => setShowManage(false)}><X size={18} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              {sections.map((sec, idx) => (
                <View key={sec.id} style={sh.manageRow}>
                  <View style={{ gap: 2 }}>
                    <TouchableOpacity onPress={() => moveSection(idx, 'up')} disabled={idx === 0} style={sh.arrowBtn}><ChevronUp size={14} color={idx === 0 ? '#ccc' : '#444'} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveSection(idx, 'down')} disabled={idx === sections.length - 1} style={sh.arrowBtn}><ChevronDown size={14} color={idx === sections.length - 1 ? '#ccc' : '#444'} /></TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sh.manageTitle, !sec.visible && { color: '#bbb' }]}>{sec.title}</Text>
                    <Text style={sh.managePreview}>{sec.visible ? 'Visible' : 'Hidden'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={sh.manageBtn} onPress={() => toggleSection(sec.id)}>
                      {sec.visible ? <Eye size={15} color="#444" /> : <EyeOff size={15} color="#bbb" />}
                    </TouchableOpacity>
                    <TouchableOpacity style={sh.manageBtn} onPress={() => { setEditingSection(sec); setShowManage(false); setShowSectionEditor(true) }}>
                      <Edit3 size={15} color="#ff385c" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {sections.length === 0 && <Text style={{ color: '#bbb', textAlign: 'center', padding: 32 }}>No sections yet</Text>}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add section */}
      <Modal visible={showAddSection} animationType="slide" transparent>
        <View style={sh.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAddSection(false)} />
          <View style={[sh.sheet, { maxHeight: '85%' }]}>
            <View style={sh.handle} />
            <View style={sh.header}>
              <Text style={sh.title}>Add a section</Text>
              <TouchableOpacity style={sh.closeBtn} onPress={() => setShowAddSection(false)}><X size={18} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              {SECTION_TYPES.filter(st => !sections.find(s => s.type === st.type)).map(st => (
                <TouchableOpacity key={st.type} style={sh.addRow} onPress={() => addSection(st.type)}>
                  <View style={sh.addIcon}><Text style={{ fontSize: 20 }}>{st.icon}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={sh.addLabel}>{st.label}</Text>
                    <Text style={sh.addDesc}>{st.desc}</Text>
                  </View>
                  <ChevronRight size={16} color="#bbb" />
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Section editor */}
      {editingSection && (
        <SectionEditorModal visible={showSectionEditor} section={editingSection} onSave={(u) => saveSection(editingSection.id, u)} onDelete={() => deleteSection(editingSection.id)} onClose={() => { setShowSectionEditor(false); setEditingSection(null) }} />
      )}
    </View>
  )
}

// ── Section editor modal ──────────────────────────────────────────────────────
function SectionEditorModal({ visible, section, onSave, onDelete, onClose }: { visible: boolean; section: any; onSave: (u: any) => void; onDelete: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(section.title ?? '')
  const [content, setContent] = useState<any>(section.content ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => { setTitle(section.title ?? ''); setContent(section.content ?? {}) }, [section])

  const uc = (key: string, val: any) => setContent((p: any) => ({ ...p, [key]: val }))

  async function save() { setSaving(true); await onSave({ title, content }); setSaving(false) }

  const renderEditor = () => {
    if (section.type === 'whats_included' || section.type === 'requirements') {
      const key = 'items'; const items: string[] = content[key] ?? []
      return (
        <View>
          {section.type === 'whats_included' && (<><Text style={sh.label}>Description (optional)</Text><TextInput style={sh.input} value={content.description ?? ''} onChangeText={v => uc('description', v)} placeholder="Short intro..." placeholderTextColor="#999" /></>)}
          <Text style={sh.label}>Items</Text>
          {items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput style={[sh.input, { flex: 1 }]} value={item} onChangeText={v => { const a = [...items]; a[i] = v; uc(key, a) }} placeholder={`Item ${i + 1}`} placeholderTextColor="#999" />
              <TouchableOpacity style={{ width: 44, height: 54, justifyContent: 'center', alignItems: 'center' }} onPress={() => uc(key, items.filter((_,j) => j !== i))}><X size={16} color="#dc2626" /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={sh.addItemBtn} onPress={() => uc(key, [...items, ''])}><Plus size={14} color="#ff385c" /><Text style={sh.addItemText}>Add item</Text></TouchableOpacity>
        </View>
      )
    }
    if (section.type === 'how_i_work') {
      const steps: any[] = content.steps ?? []
      return (
        <View>
          <Text style={sh.label}>Steps</Text>
          {steps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginTop: 14 }}><Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{i+1}</Text></View>
              <View style={{ flex: 1, gap: 6 }}>
                <TextInput style={sh.input} value={step.title ?? ''} onChangeText={v => { const ss=[...steps]; ss[i]={...ss[i],title:v}; uc('steps',ss) }} placeholder="Step title" placeholderTextColor="#999" />
                <TextInput style={sh.input} value={step.desc ?? ''} onChangeText={v => { const ss=[...steps]; ss[i]={...ss[i],desc:v}; uc('steps',ss) }} placeholder="Description (optional)" placeholderTextColor="#999" />
              </View>
              <TouchableOpacity style={{ paddingLeft: 8, justifyContent: 'center', paddingTop: 16 }} onPress={() => uc('steps', steps.filter((_,j) => j !== i))}><X size={16} color="#dc2626" /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={sh.addItemBtn} onPress={() => uc('steps', [...steps, { title: '', desc: '' }])}><Plus size={14} color="#ff385c" /><Text style={sh.addItemText}>Add step</Text></TouchableOpacity>
        </View>
      )
    }
    if (section.type === 'faqs') {
      const faqs: any[] = content.faqs ?? []
      return (
        <View>
          {faqs.map((faq, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 6 }}>
                <TextInput style={sh.input} value={faq.q ?? ''} onChangeText={v => { const ff=[...faqs]; ff[i]={...ff[i],q:v}; uc('faqs',ff) }} placeholder="Question" placeholderTextColor="#999" />
                <TextInput multiline style={[sh.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} value={faq.a ?? ''} onChangeText={v => { const ff=[...faqs]; ff[i]={...ff[i],a:v}; uc('faqs',ff) }} placeholder="Answer" placeholderTextColor="#999" />
              </View>
              <TouchableOpacity style={{ paddingLeft: 8, paddingTop: 16 }} onPress={() => uc('faqs', faqs.filter((_,j) => j !== i))}><X size={16} color="#dc2626" /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={sh.addItemBtn} onPress={() => uc('faqs', [...faqs, { q: '', a: '' }])}><Plus size={14} color="#ff385c" /><Text style={sh.addItemText}>Add question</Text></TouchableOpacity>
        </View>
      )
    }
    if (section.type === 'policies') {
      return (
        <View>
          <Text style={sh.label}>Cancellation</Text>
          <TextInput multiline style={[sh.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} value={content.cancellation ?? ''} onChangeText={v => uc('cancellation', v)} placeholder="e.g. Free cancellation up to 24 hours before..." placeholderTextColor="#999" />
          <Text style={sh.label}>Lateness</Text>
          <TextInput multiline style={[sh.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} value={content.lateness ?? ''} onChangeText={v => uc('lateness', v)} placeholder="e.g. 15 minute grace period..." placeholderTextColor="#999" />
          <Text style={sh.label}>Refunds</Text>
          <TextInput multiline style={[sh.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]} value={content.refunds ?? ''} onChangeText={v => uc('refunds', v)} placeholder="e.g. Full refund if provider cancels..." placeholderTextColor="#999" />
        </View>
      )
    }
    if (section.type === 'experience') {
      return (<View><Text style={sh.label}>Experience summary</Text><TextInput multiline style={[sh.input, { height: 120, textAlignVertical: 'top', paddingTop: 10 }]} value={content.summary ?? ''} onChangeText={v => uc('summary', v)} placeholder="Your background, qualifications..." placeholderTextColor="#999" /></View>)
    }
    if (section.type === 'service_areas') {
      return (<View><Text style={sh.label}>Areas you cover</Text><TextInput style={sh.input} value={content.areas ?? ''} onChangeText={v => uc('areas', v)} placeholder="e.g. North London, Islington" placeholderTextColor="#999" /><Text style={sh.label}>Travel radius (optional)</Text><TextInput style={sh.input} value={content.radius ?? ''} onChangeText={v => uc('radius', v)} placeholder="e.g. 10 miles" placeholderTextColor="#999" /></View>)
    }
    if (section.type === 'languages') {
      return (<View><Text style={sh.label}>Languages you speak</Text><TextInput style={sh.input} value={content.languages ?? ''} onChangeText={v => uc('languages', v)} placeholder="e.g. English, French" placeholderTextColor="#999" /></View>)
    }
    return null
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={sh.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <View style={[sh.sheet, { maxHeight: '92%' }]}>
            <View style={sh.handle} />
            <View style={sh.header}>
              <Text style={sh.title}>Edit section</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={onDelete} style={[sh.closeBtn, { backgroundColor: '#fff0f0' }]}><X size={16} color="#dc2626" /></TouchableOpacity>
                <TouchableOpacity style={sh.closeBtn} onPress={onClose}><X size={18} color="#111" /></TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <Text style={sh.label}>Section title</Text>
              <TextInput style={sh.input} value={title} onChangeText={setTitle} placeholderTextColor="#999" />
              {renderEditor()}
              <TouchableOpacity style={sh.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveBtnText}>Save section</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function OverviewSectionRenderer({ section }: { section: any }) {
  return <SectionRenderer section={section} />
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  heroNav: { position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  profileHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 20 },
  avatarWrap: { marginTop: -44, position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#fff' },
  avatarEditBtn: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff385c', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileNames: { flex: 1, paddingBottom: 4 },
  providerName: { fontSize: 22, fontWeight: '700', color: '#222', letterSpacing: -0.4 },
  providerCat: { fontSize: 14, color: '#717171', marginTop: 2, marginBottom: 6 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  tagText: { fontSize: 12, color: '#717171' },
  tagDot: { fontSize: 12, color: '#717171', marginHorizontal: 1 },
  statsBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, paddingVertical: 14, position: 'relative' },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#222', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#717171', marginTop: 2 },
  statSep: { width: 1, backgroundColor: '#e0e0e0', marginVertical: 4 },
  statEditHint: { position: 'absolute', top: 8, right: 10 },
  tabsWrap: {},
  tabsContent: { paddingHorizontal: 20 },
  tabBtn: { paddingVertical: 14, paddingHorizontal: 4, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#717171' },
  tabTextActive: { color: '#222', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#222', borderRadius: 1 },
  emptyState: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 16, color: '#717171', fontWeight: '500', marginBottom: 20 },
  addServiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#ff385c', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  addServiceBtnText: { fontSize: 14, fontWeight: '600', color: '#ff385c' },
})

const g = StyleSheet.create({
  divider: { height: 1, backgroundColor: '#e0e0e0', marginHorizontal: 24 },
  sectionWrap: { paddingHorizontal: 24, paddingVertical: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#222', letterSpacing: -0.4 },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#717171' },
  bodyText: { fontSize: 15, color: '#444', lineHeight: 24 },
  editBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff0f0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  editBadgeText: { fontSize: 12, fontWeight: '600', color: '#ff385c' },
  reviewCount: { fontSize: 16, color: '#717171' },
  noReviewsText: { fontSize: 14, color: '#717171', lineHeight: 22, marginTop: 4 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  showMoreText: { fontSize: 14, fontWeight: '700', color: '#222', textDecorationLine: 'underline' },
  howScroll: { gap: 14, paddingTop: 12 },
  howCard: { width: 140, padding: 14, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14 },
  howIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f7f7f7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 4 },
  howDesc: { fontSize: 12, color: '#717171', lineHeight: 17 },
  faqRow: { paddingVertical: 18 },
  faqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqQ: { fontSize: 15, fontWeight: '500', color: '#222', flex: 1, lineHeight: 22 },
  faqA: { fontSize: 14, color: '#717171', lineHeight: 22, marginTop: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 22 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#717171' },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  policyLabel: { fontSize: 11, color: '#717171', marginBottom: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  policyText: { fontSize: 14, color: '#444', lineHeight: 20 },
  gridRow: { flexDirection: 'row', gap: 14 },
  gridCard: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 16 },
  gridCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gridCardTitle: { fontSize: 14, fontWeight: '700', color: '#222' },
  gridCardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gridCardValue: { fontSize: 13, color: '#717171', lineHeight: 19, flex: 1 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 20 },
  serviceImg: { width: 80, height: 80, borderRadius: 12 },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  serviceDesc: { fontSize: 13, color: '#717171', lineHeight: 19, marginBottom: 6 },
  servicePrice: { fontSize: 14, fontWeight: '700', color: '#222' },
  serviceChip: { width: 160, padding: 16, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14 },
  serviceChipTitle: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 6, lineHeight: 20 },
  serviceChipPrice: { fontSize: 16, fontWeight: '700', color: '#222' },
  editBar: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 16 },
  editBarLabel: { fontSize: 13, color: '#717171', marginBottom: 12 },
  editBarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#ff385c', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  editBarBtnText: { fontSize: 13, fontWeight: '600', color: '#ff385c' },
})

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#111', height: 54 },
  saveBtn: { height: 54, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#ff385c', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 8 },
  addItemText: { fontSize: 13, fontWeight: '600', color: '#ff385c' },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  arrowBtn: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  manageTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  managePreview: { fontSize: 12, color: '#888', marginTop: 2 },
  manageBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  addIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  addLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  addDesc: { fontSize: 12, color: '#888', marginTop: 2 },
})
