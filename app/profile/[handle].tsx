import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Share2, MoreHorizontal, MapPin, BadgeCheck,
  ChevronRight, ChevronDown, ChevronUp, MessageCircle,
  UserPlus, Bookmark, Star, Shield, Clock, Repeat2,
  CheckCircle, Globe, Calendar,
} from 'lucide-react-native'

const { width } = Dimensions.get('window')
const HERO_H = 220
const TABS = ['Overview', 'Portfolio', 'Services', 'Reviews'] as const
type Tab = typeof TABS[number]

function Divider() { return <View style={g.divider} /> }

// ── Expandable FAQ row ────────────────────────────────────────────────────────
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

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: any }) {
  return (
    <View style={g.reviewCard}>
      <View style={g.reviewHeader}>
        <View style={g.reviewAvatar}>
          <Text style={g.reviewAvatarText}>{(review.name ?? 'C').slice(0,1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={g.reviewName}>{review.name ?? 'Client'}</Text>
          <Text style={g.reviewTime}>{review.time ?? '1 month ago'}</Text>
        </View>
        {review.photo && (
          <Image source={{ uri: review.photo }} style={g.reviewPhoto} />
        )}
      </View>
      <View style={g.reviewStars}>
        {[1,2,3,4,5].map(s => <Star key={s} size={12} color="#222" fill="#222" />)}
      </View>
      <Text style={g.reviewText} numberOfLines={4}>{review.text}</Text>
    </View>
  )
}

// ── Section renderer ──────────────────────────────────────────────────────────
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
              <View style={g.howIcon}>
                <Text style={{ fontSize: 20 }}>{['💬','📅','🎯','✅'][i % 4]}</Text>
              </View>
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
            {i < faqs.length - 1 && <View style={{ height: 1, backgroundColor: '#f0f0f0', marginLeft: 0 }} />}
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
          {content.cancellation && (
            <View style={g.policyRow}>
              <Shield size={20} color="#222" strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={g.policyLabel}>Cancellation</Text>
                <Text style={g.policyText}>{content.cancellation}</Text>
              </View>
              <ChevronRight size={16} color="#717171" />
            </View>
          )}
          {content.lateness && (
            <View style={g.policyRow}>
              <Clock size={20} color="#222" strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={g.policyLabel}>Lateness</Text>
                <Text style={g.policyText}>{content.lateness}</Text>
              </View>
              <ChevronRight size={16} color="#717171" />
            </View>
          )}
          {content.refunds && (
            <View style={g.policyRow}>
              <Repeat2 size={20} color="#222" strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={g.policyLabel}>Refunds</Text>
                <Text style={g.policyText}>{content.refunds}</Text>
              </View>
              <ChevronRight size={16} color="#717171" />
            </View>
          )}
        </View>
        <Divider />
      </View>
    )
  }

  if (section.type === 'experience') {
    if (!content.summary) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        <Text style={g.bodyText}>{content.summary}</Text>
        <Divider />
      </View>
    )
  }

  if (section.type === 'requirements') {
    const items: string[] = content.items ?? []
    if (!items.length) return null
    return (
      <View style={g.sectionWrap}>
        <Text style={g.sectionTitle}>{section.title}</Text>
        <View style={{ gap: 12, marginTop: 4 }}>
          {items.map((item, i) => (
            <View key={i} style={g.checkRow}>
              <View style={g.bullet} />
              <Text style={g.checkText}>{item}</Text>
            </View>
          ))}
        </View>
        <Divider />
      </View>
    )
  }

  // 2-column grid sections: service_areas + languages
  if (section.type === 'service_areas' || section.type === 'languages') {
    const value = section.type === 'service_areas' ? content.areas : content.languages
    if (!value) return null
    const icon = section.type === 'service_areas' ? '📍' : '🌍'
    return null // Rendered in 2-col grid below
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CustomerProviderProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [media, setMedia] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')
  const [bioExpanded, setBioExpanded] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [handle])

  async function load() {
    const { data } = await supabase.from('profiles').select('*, provider_profiles(*)').eq('username', handle).single()
    if (data) {
      setProfile(data)
      const [{ data: opps }, { data: secs }] = await Promise.all([
        supabase.from('opportunities').select('*, opportunity_media(url, media_type)').eq('provider_id', data.id).eq('status', 'active'),
        supabase.from('provider_overview_sections').select('*').eq('provider_id', data.id).eq('visible', true).order('position'),
      ])
      setOpportunities(opps ?? [])
      setSections(secs ?? [])
      setMedia((opps ?? []).flatMap((o: any) => o.opportunity_media ?? []))
    }
    setLoading(false)
  }

  function book(opp: any) {
    if (!opp) return
    let qs: any[] = []
    try { qs = typeof opp.booking_questions === 'string' ? JSON.parse(opp.booking_questions || '[]') : opp.booking_questions ?? [] } catch {}
    const validQs = Array.isArray(qs) ? qs.filter((q: any) => q?.question?.trim()) : []
    const bp = { providerId: profile.id, serviceId: opp.id, serviceName: opp.title, servicePrice: String(opp.price_pence ?? 0), serviceDuration: String(opp.metadata?.duration ?? 60) }
    router.push(validQs.length > 0
      ? { pathname: '/book/[providerId]/questions' as any, params: { ...bp, questions: JSON.stringify(validQs) } }
      : { pathname: '/book/[providerId]/calendar' as any, params: { ...bp, answers: '[]' } }
    )
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#222" /></View>
  if (!profile) return (
    <View style={s.center}>
      <Text style={{ color: '#717171', fontSize: 16 }}>Provider not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color: '#222', fontWeight: '600', textDecorationLine: 'underline' }}>Go back</Text>
      </TouchableOpacity>
    </View>
  )

  const name = profile.full_name ?? handle
  const firstName = name.split(' ')[0]
  const category = profile.provider_profiles?.category ?? 'Service Provider'
  const location = profile.location ?? 'London, UK'
  const bio = profile.bio ?? ''
  const yearsActive = profile.provider_profiles?.years_active ?? ''
  const totalClients = profile.provider_profiles?.total_clients ?? '0'
  const featuredOpp = opportunities[0]
  const heroUrl = media[0]?.url ?? null

  // Section lookups
  const howSection = sections.find(s => s.type === 'how_i_work')
  const faqSection = sections.find(s => s.type === 'faqs')
  const areasSection = sections.find(s => s.type === 'service_areas')
  const langSection = sections.find(s => s.type === 'languages')
  const otherSections = sections.filter(s => !['how_i_work','faqs','service_areas','languages'].includes(s.type))

  // Mock reviews for demo
  const reviews: any[] = []

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── Hero ── */}
        <View style={{ height: HERO_H }}>
          {heroUrl
            ? <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#e8e8e8' }]} />
          }
          <View style={s.heroNav}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()}>
              <ChevronLeft size={20} color="#222" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.heroBtn}>
                <Share2 size={18} color="#222" strokeWidth={1.5} />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn}>
                <MoreHorizontal size={18} color="#222" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Profile header ── */}
        <View style={s.profileHeader}>
          <View style={s.profileRow}>
            {/* Avatar overlaps hero */}
            <View style={s.avatarWrap}>
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                : <View style={[s.avatar, { backgroundColor: '#ff385c', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{name.slice(0,1)}</Text>
                  </View>
              }
              <View style={s.onlineDot} />
            </View>
            <View style={s.profileNames}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.providerName}>{name}</Text>
                <BadgeCheck size={20} color="#1a73e8" fill="#1a73e8" />
              </View>
              <Text style={s.providerCat}>{category}</Text>
              <View style={s.tagsRow}>
                <MapPin size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>{location}</Text>
                <Text style={s.tagDot}>·</Text>
                <Shield size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>Verified</Text>
                <Text style={s.tagDot}>·</Text>
                <Star size={12} color="#717171" strokeWidth={1.5} />
                <Text style={s.tagText}>Top rated</Text>
              </View>
            </View>
          </View>

          {/* Stats box */}
          <View style={s.statsBox}>
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
              <Text style={s.statNum}>{totalClients}</Text>
              <Text style={s.statLabel}>Clients</Text>
            </View>
            {yearsActive ? (
              <>
                <View style={s.statSep} />
                <View style={s.statCell}>
                  <Text style={s.statNum}>{yearsActive}</Text>
                  <Text style={s.statLabel}>Yrs exp.</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabsContent}>
          {TABS.map(t => (
            <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Divider />

        {/* ── Overview ── */}
        {tab === 'Overview' && (
          <View>
            {/* Featured work */}
            {media.length > 0 && (
              <View style={g.sectionWrap}>
                <View style={g.sectionRow}>
                  <Text style={g.sectionTitle}>Featured work</Text>
                  <TouchableOpacity onPress={() => setTab('Portfolio')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={g.viewAll}>View all</Text>
                    <ChevronRight size={14} color="#717171" />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.featuredScroll}>
                  {media.slice(0, 6).map((item: any, i: number) => (
                    <TouchableOpacity key={i} style={g.featuredCard}>
                      <Image source={{ uri: item.url }} style={g.featuredImg} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Divider />
              </View>
            )}

            {/* About me */}
            <View style={g.sectionWrap}>
              <View style={g.aboutRow}>
                <View style={{ flex: 1, paddingRight: media.length > 0 ? 16 : 0 }}>
                  <Text style={g.sectionTitle}>About me</Text>
                  <Text style={g.bodyText} numberOfLines={bioExpanded ? undefined : 4}>
                    {bio || `${name} is a ${category} provider on Pthway.`}
                  </Text>
                  {bio && bio.length > 120 && (
                    <TouchableOpacity style={g.showMoreBtn} onPress={() => setBioExpanded(!bioExpanded)}>
                      <Text style={g.showMoreText}>{bioExpanded ? 'Show less' : 'Show more'}</Text>
                      {bioExpanded ? <ChevronUp size={15} color="#222" /> : <ChevronDown size={15} color="#222" />}
                    </TouchableOpacity>
                  )}
                </View>
                {heroUrl && (
                  <Image source={{ uri: heroUrl }} style={g.aboutImg} resizeMode="cover" />
                )}
              </View>
              <Divider />
            </View>

            {/* Reviews preview */}
            <View style={g.sectionWrap}>
              <View style={g.sectionRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Star size={16} color="#222" fill="#222" />
                  <Text style={g.sectionTitle}>4.9</Text>
                  <Text style={g.reviewCount}>· {reviews.length} reviews</Text>
                </View>
                {reviews.length > 0 && (
                  <TouchableOpacity onPress={() => setTab('Reviews')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={g.viewAll}>View all</Text>
                    <ChevronRight size={14} color="#717171" />
                  </TouchableOpacity>
                )}
              </View>
              {reviews.length === 0 ? (
                <Text style={g.noReviewsText}>No reviews yet — they'll appear here after completed bookings.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.reviewsScroll}>
                  {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
                </ScrollView>
              )}
              <Divider />
            </View>

            {/* Other sections (whats_included, policies, experience, requirements) */}
            {otherSections.map(section => (
              <SectionRenderer key={section.id} section={section} />
            ))}

            {/* How I work */}
            {howSection && <SectionRenderer section={howSection} />}

            {/* 2-col grid: areas + languages */}
            {(areasSection || langSection) && (
              <View style={g.sectionWrap}>
                <View style={g.gridRow}>
                  {areasSection && (
                    <TouchableOpacity style={g.gridCard}>
                      <View style={g.gridCardHeader}>
                        <Text style={g.gridCardTitle}>{areasSection.title}</Text>
                        <ChevronRight size={16} color="#717171" />
                      </View>
                      <View style={g.gridCardContent}>
                        <Calendar size={18} color="#717171" strokeWidth={1.5} />
                        <Text style={g.gridCardValue} numberOfLines={2}>{areasSection.content?.areas ?? ''}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {langSection && (
                    <TouchableOpacity style={g.gridCard}>
                      <View style={g.gridCardHeader}>
                        <Text style={g.gridCardTitle}>{langSection.title}</Text>
                        <ChevronRight size={16} color="#717171" />
                      </View>
                      <View style={g.gridCardContent}>
                        <Globe size={18} color="#717171" strokeWidth={1.5} />
                        <Text style={g.gridCardValue} numberOfLines={2}>{langSection.content?.languages ?? ''}</Text>
                      </View>
                    </TouchableOpacity>
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
          </View>
        )}

        {/* ── Portfolio ── */}
        {tab === 'Portfolio' && (
          <View>
            {media.length === 0 ? (
              <View style={s.emptyState}><Text style={s.emptyText}>No portfolio yet</Text></View>
            ) : (
              <View style={g.galleryGrid}>
                {media.map((item: any, i: number) => (
                  <TouchableOpacity key={i} style={g.galleryItem}>
                    <Image source={{ uri: item.url }} style={g.galleryImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Services ── */}
        {tab === 'Services' && (
          <View style={{ paddingTop: 8 }}>
            {opportunities.length === 0 ? (
              <View style={s.emptyState}><Text style={s.emptyText}>No services yet</Text></View>
            ) : (
              opportunities.map((opp: any, i: number) => (
                <View key={opp.id}>
                  <TouchableOpacity style={g.serviceRow} onPress={() => book(opp)} activeOpacity={0.85}>
                    {opp.opportunity_media?.[0]?.url
                      ? <Image source={{ uri: opp.opportunity_media[0].url }} style={g.serviceImg} resizeMode="cover" />
                      : <View style={[g.serviceImg, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 22, color: '#ccc' }}>{opp.title?.slice(0,1)}</Text>
                        </View>
                    }
                    <View style={g.serviceInfo}>
                      <Text style={g.serviceTitle}>{opp.title}</Text>
                      <Text style={g.serviceDesc} numberOfLines={2}>{opp.description}</Text>
                      <Text style={g.servicePrice}>£{((opp.price_pence ?? 0) / 100).toFixed(0)} / session</Text>
                    </View>
                    <ChevronRight size={16} color="#717171" />
                  </TouchableOpacity>
                  {i < opportunities.length - 1 && <Divider />}
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Reviews tab ── */}
        {tab === 'Reviews' && (
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Star size={20} color="#222" fill="#222" />
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#222' }}>4.9</Text>
              <Text style={{ fontSize: 16, color: '#717171' }}>· {reviews.length} reviews</Text>
            </View>
            {reviews.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No reviews yet</Text>
                <Text style={{ fontSize: 14, color: '#717171', marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Reviews appear here after completed bookings.</Text>
              </View>
            ) : (
              <View style={{ gap: 20 }}>
                {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.bottomAction}>
          <UserPlus size={20} color="#222" strokeWidth={1.5} />
          <Text style={s.bottomActionText}>Follow</Text>
        </TouchableOpacity>
        <View style={s.bottomSep} />
        <TouchableOpacity style={s.bottomAction} onPress={() => router.push(`/messages/${profile.id}` as any)}>
          <MessageCircle size={20} color="#222" strokeWidth={1.5} />
          <Text style={s.bottomActionText}>Message</Text>
        </TouchableOpacity>
        <View style={s.bottomSep} />
        <TouchableOpacity style={s.bottomAction} onPress={() => setSaved(!saved)}>
          <Bookmark size={20} color={saved ? '#ff385c' : '#222'} fill={saved ? '#ff385c' : 'transparent'} strokeWidth={1.5} />
          <Text style={s.bottomActionText}>Save</Text>
        </TouchableOpacity>
        {featuredOpp && (
          <>
            <View style={s.bottomSep} />
            <TouchableOpacity style={s.bookBtn} onPress={() => book(featuredOpp)}>
              <Text style={s.bookBtnText}>Book</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
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
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  profileNames: { flex: 1, paddingBottom: 4 },
  providerName: { fontSize: 22, fontWeight: '700', color: '#222', letterSpacing: -0.4 },
  providerCat: { fontSize: 14, color: '#717171', marginTop: 2, marginBottom: 6 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  tagText: { fontSize: 12, color: '#717171' },
  tagDot: { fontSize: 12, color: '#717171', marginHorizontal: 1 },

  statsBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, paddingVertical: 14 },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#222', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#717171', marginTop: 2 },
  statSep: { width: 1, backgroundColor: '#e0e0e0', marginVertical: 4 },

  tabsWrap: { borderBottomWidth: 0 },
  tabsContent: { paddingHorizontal: 20, gap: 0 },
  tabBtn: { paddingVertical: 14, paddingHorizontal: 4, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#717171' },
  tabTextActive: { color: '#222', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#222', borderRadius: 1 },

  emptyState: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 16, color: '#717171', fontWeight: '500' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  bottomAction: { flex: 1, alignItems: 'center', gap: 4 },
  bottomActionText: { fontSize: 11, fontWeight: '500', color: '#222' },
  bottomSep: { width: 1, height: 32, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
  bookBtn: { backgroundColor: '#ff385c', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, marginLeft: 8 },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})

const g = StyleSheet.create({
  divider: { height: 1, backgroundColor: '#e0e0e0', marginHorizontal: 24 },
  sectionWrap: { paddingHorizontal: 24, paddingVertical: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#222', letterSpacing: -0.4 },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#717171' },
  bodyText: { fontSize: 15, color: '#444', lineHeight: 24 },
  reviewCount: { fontSize: 16, color: '#717171' },
  noReviewsText: { fontSize: 14, color: '#717171', lineHeight: 22, marginTop: 8 },

  // Featured work
  featuredScroll: { gap: 12, paddingTop: 4 },
  featuredCard: { width: 160, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0' },
  featuredImg: { width: '100%', height: '100%' },

  // About
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start' },
  aboutImg: { width: 120, height: 120, borderRadius: 12, marginTop: 28 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  showMoreText: { fontSize: 14, fontWeight: '700', color: '#222', textDecorationLine: 'underline' },

  // Reviews
  reviewsScroll: { gap: 14, paddingTop: 16 },
  reviewCard: { width: 280, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16, padding: 18 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ff385c', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  reviewName: { fontSize: 14, fontWeight: '600', color: '#222' },
  reviewTime: { fontSize: 12, color: '#717171', marginTop: 1 },
  reviewPhoto: { width: 48, height: 48, borderRadius: 8 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewText: { fontSize: 14, color: '#444', lineHeight: 21 },

  // Check
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 22 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#717171' },

  // How I work
  howScroll: { gap: 16, paddingTop: 16 },
  howCard: { width: 140, padding: 14, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14 },
  howIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f7f7f7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 4 },
  howDesc: { fontSize: 12, color: '#717171', lineHeight: 17 },

  // FAQ
  faqRow: { paddingVertical: 18 },
  faqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqQ: { fontSize: 15, fontWeight: '500', color: '#222', flex: 1, lineHeight: 22 },
  faqA: { fontSize: 14, color: '#717171', lineHeight: 22, marginTop: 12 },

  // Policies
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  policyLabel: { fontSize: 11, color: '#717171', marginBottom: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  policyText: { fontSize: 14, color: '#444', lineHeight: 20 },

  // 2-col grid
  gridRow: { flexDirection: 'row', gap: 14 },
  gridCard: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 16 },
  gridCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gridCardTitle: { fontSize: 14, fontWeight: '700', color: '#222' },
  gridCardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gridCardValue: { fontSize: 13, color: '#717171', lineHeight: 19, flex: 1 },

  // Services
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 20 },
  serviceImg: { width: 80, height: 80, borderRadius: 12 },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  serviceDesc: { fontSize: 13, color: '#717171', lineHeight: 19, marginBottom: 6 },
  servicePrice: { fontSize: 14, fontWeight: '700', color: '#222' },

  // Gallery
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  galleryItem: { width: width / 3, height: width / 3 },
  galleryImg: { width: '100%', height: '100%' },
})
