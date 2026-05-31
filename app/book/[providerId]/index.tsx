// app/book/[providerId]/index.tsx
// Step 1 — Service selection

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, MapPin, Star, Clock, Users, ChevronRight } from 'lucide-react-native'

export default function ServiceSelectionScreen() {
  const router = useRouter()
  const { providerId } = useLocalSearchParams<{ providerId: string }>()
  const [provider, setProvider] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [providerId])

  async function loadData() {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, provider_profiles(*)')
      .eq('id', providerId)
      .single()

    const { data: opps } = await supabase
      .from('opportunities')
      .select('*, opportunity_media(url, media_type)')
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setProvider(profile)
    setServices(opps ?? [])
    setLoading(false)
  }

  function selectService(service: any) {
    const rawQuestions = service.booking_questions

    let parsedQuestions: any[] = []
    try {
      parsedQuestions =
        typeof rawQuestions === 'string'
          ? JSON.parse(rawQuestions || '[]')
          : rawQuestions
    } catch {
      parsedQuestions = []
    }

    const bookingQuestions = Array.isArray(parsedQuestions)
      ? parsedQuestions.filter((q: any) => q?.question?.trim())
      : []

    Alert.alert(
      'selectService hit',
      `Service: ${service.title}\nQuestions: ${bookingQuestions.length}`
    )

    const baseParams = {
      providerId,
      serviceId: service.id,
      serviceName: service.title,
      servicePrice: String(service.price_pence ?? 0),
      serviceDuration: String(service.metadata?.duration ?? 60),
    }

    if (bookingQuestions.length > 0) {
      router.push({
        pathname: '/book/[providerId]/questions' as any,
        params: {
          ...baseParams,
          questions: JSON.stringify(bookingQuestions),
        },
      })
      return
    }

    router.push({
      pathname: '/book/[providerId]/calendar' as any,
      params: {
        ...baseParams,
        answers: '[]',
      },
    })
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#111" />
      </View>
    )
  }

  const name = provider?.full_name ?? 'Provider'
  const category = provider?.provider_profiles?.category ?? ''
  const location = provider?.location ?? ''
  const rating = '4.9'

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Book a service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.providerCard}>
          <View style={s.providerAvatar}>
            <Text style={s.providerAvatarText}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>

          <View style={s.providerInfo}>
            <Text style={s.providerName}>{name}</Text>
            <Text style={s.providerCategory}>{category}</Text>

            <View style={s.providerMeta}>
              {location ? (
                <View style={s.metaChip}>
                  <MapPin size={11} color="#888" />
                  <Text style={s.metaText}>{location}</Text>
                </View>
              ) : null}

              <View style={s.metaChip}>
                <Star size={11} color="#ff5a1f" fill="#ff5a1f" />
                <Text style={s.metaText}>{rating}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Select a service</Text>

        {services.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No services available</Text>
          </View>
        ) : (
          <View style={s.serviceList}>
            {services.map((service) => {
              const imageUrl = service.image_url ?? service.opportunity_media?.[0]?.url
              const duration = service.metadata?.duration
              const durationLabel = duration
                ? duration < 60
                  ? `${duration}m`
                  : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`
                : null
              const price = service.price_pence
                ? `£${(service.price_pence / 100).toFixed(0)}`
                : null

              return (
                <TouchableOpacity
                  key={service.id}
                  style={s.serviceCard}
                  onPress={() => selectService(service)}
                  activeOpacity={0.88}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={s.serviceImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.serviceImage, s.serviceImagePlaceholder]}>
                      <Text style={s.serviceImagePlaceholderText}>{service.title?.slice(0, 1)}</Text>
                    </View>
                  )}

                  <View style={s.serviceInfo}>
                    <Text style={s.serviceTitle}>{service.title}</Text>

                    {service.description ? (
                      <Text style={s.serviceDesc} numberOfLines={2}>{service.description}</Text>
                    ) : null}

                    <View style={s.serviceMeta}>
                      {durationLabel ? (
                        <View style={s.serviceMetaChip}>
                          <Clock size={11} color="#888" />
                          <Text style={s.serviceMetaText}>{durationLabel}</Text>
                        </View>
                      ) : null}

                      {service.metadata?.maxClients > 1 ? (
                        <View style={s.serviceMetaChip}>
                          <Users size={11} color="#888" />
                          <Text style={s.serviceMetaText}>Up to {service.metadata.maxClients}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={s.serviceRight}>
                    {price ? <Text style={s.servicePrice}>{price}</Text> : null}
                    <ChevronRight size={16} color="#ccc" />
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },

  content: { paddingHorizontal: 20, paddingTop: 24 },

  providerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 16 },
  providerAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#ff5a1f', justifyContent: 'center', alignItems: 'center' },
  providerAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  providerCategory: { fontSize: 13, color: '#888', marginBottom: 8 },
  providerMeta: { flexDirection: 'row', gap: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#888' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111', letterSpacing: -0.3, marginBottom: 16 },

  emptyBox: { padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16 },
  emptyText: { fontSize: 14, color: '#888' },

  serviceList: { gap: 12 },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 18,
    padding: 14, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  serviceImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#f0f0f0' },
  serviceImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  serviceImagePlaceholderText: { fontSize: 24, fontWeight: '700', color: '#ddd' },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  serviceDesc: { fontSize: 12, color: '#888', lineHeight: 17, marginBottom: 8 },
  serviceMeta: { flexDirection: 'row', gap: 10 },
  serviceMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceMetaText: { fontSize: 11, color: '#999' },
  serviceRight: { alignItems: 'flex-end', gap: 8 },
  servicePrice: { fontSize: 16, fontWeight: '700', color: '#111' },
})