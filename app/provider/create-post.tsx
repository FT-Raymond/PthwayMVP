import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Dimensions, Image, Alert, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { X, SlidersHorizontal } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

const { width } = Dimensions.get('window')

export default function CreatePostScreen() {
  const [selected, setSelected] = useState<any[]>([])
  const [phase, setPhase] = useState<'pick' | 'caption'>('pick')
  const [caption, setCaption] = useState('')
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles').select('*, provider_profiles(*)')
      .eq('id', user.id).single()
    if (data) setProfile(data)
  }

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed'); return }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1,
    })
    if (!result.canceled) {
      setSelected([{ uri: result.assets[0].uri, mediaType: result.assets[0].type ?? 'image' }])
      setPhase('caption')
    }
  }

  async function openLibrary(multiple = false) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: multiple ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? 10 : 1,
      quality: 1,
    })
    if (!result.canceled) {
      setSelected(result.assets.map(a => ({ uri: a.uri, mediaType: a.type ?? 'image' })))
      setPhase('caption')
    }
  }

  if (phase === 'caption') {
    return (
      <CaptionScreen
        selected={selected}
        caption={caption}
        setCaption={setCaption}
        profile={profile}
        onBack={() => setPhase('pick')}
      />
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <X size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add to Pthway</Text>
        <TouchableOpacity style={s.headerBtn}>
          <SlidersHorizontal size={20} color="#111" />
        </TouchableOpacity>
      </View>
      <Text style={s.headerSub}>Share your work, services or updates.</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.optionRow}>
          <TouchableOpacity style={s.optionCard} onPress={openCamera}>
            <View style={[s.optionIcon, { backgroundColor: '#FFF0EB' }]}>
              <Ionicons name="camera-outline" size={28} color="#111" />
            </View>
            <Text style={s.optionTitle}>Camera</Text>
            <Text style={s.optionDesc}>Take a photo{'\n'}or video</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.optionCard} onPress={() => openLibrary(false)}>
            <View style={[s.optionIcon, { backgroundColor: '#EBF5FF' }]}>
              <Ionicons name="videocam-outline" size={28} color="#111" />
            </View>
            <Text style={s.optionTitle}>Video</Text>
            <Text style={s.optionDesc}>Share a{'\n'}single video</Text>
          </TouchableOpacity>
        </View>

        {/* Photo slideshow option */}
        <TouchableOpacity style={s.slideshowBtn} onPress={() => openLibrary(true)}>
          <View style={s.slideshowLeft}>
            <View style={[s.optionIcon, { backgroundColor: '#F0EBFF', width: 52, height: 52 }]}>
              <Ionicons name="images-outline" size={26} color="#6366f1" />
            </View>
            <View>
              <Text style={s.slideshowTitle}>Photo slideshow</Text>
              <Text style={s.slideshowSub}>Select up to 10 photos — clients swipe through</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={s.bigPickerBtn} onPress={() => openLibrary(false)}>
          <Ionicons name="add-circle-outline" size={36} color="#ff5a1f" />
          <Text style={s.bigPickerText}>Browse photos & videos</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function CaptionScreen({ selected, caption, setCaption, profile, onBack }: any) {
  const [publishing, setPublishing] = useState(false)

  const name = profile?.provider_profiles?.business_name || profile?.full_name || 'You'
  const category = profile?.provider_profiles?.category || ''
  const location = profile?.location || ''
  const initial = name.slice(0, 1).toUpperCase()
  const isMultiple = selected.length > 1
  const isVideo = !isMultiple && selected[0]?.mediaType === 'video'

  async function uploadOne(uri: string, userId: string, index: number): Promise<string | null> {
    try {
      const ext = uri.endsWith('.mp4') || isVideo ? 'mp4' : 'jpg'
      const fileName = `${userId}/${Date.now()}_${index}.${ext}`
      const contentType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg'

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/posts/${fileName}`
      const response = await fetch(uri)
      const arrayBuffer = await response.arrayBuffer()

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: arrayBuffer,
      })

      if (!uploadResponse.ok) { console.error('Upload failed:', await uploadResponse.text()); return null }

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName)
      return publicUrl
    } catch (err) {
      console.error('Upload error:', err)
      return null
    }
  }

  async function publish() {
    if (!selected.length) { Alert.alert('No media selected'); return }
    setPublishing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPublishing(false); return }

      if (isMultiple) {
        // Upload all photos
        const urls = await Promise.all(selected.map((a: any, i: number) => uploadOne(a.uri, user.id, i)))
        const validUrls = urls.filter(Boolean) as string[]

        if (!validUrls.length) {
          Alert.alert('Upload failed', 'Could not upload photos. Try again.')
          setPublishing(false)
          return
        }

        const { error } = await supabase.from('posts').insert({
          provider_id: user.id,
          caption: caption.trim() || null,
          media_url: validUrls[0],
          media_urls: validUrls,
          media_type: 'image',
          category: profile?.provider_profiles?.category ?? null,
          location: profile?.location ?? null,
          status: 'active',
        })

        if (error) { Alert.alert('Error', error.message); setPublishing(false); return }
      } else {
        // Single video or photo
        const url = await uploadOne(selected[0].uri, user.id, 0)
        if (!url) {
          Alert.alert('Upload failed', 'Could not upload. Try again.')
          setPublishing(false)
          return
        }

        const { error } = await supabase.from('posts').insert({
          provider_id: user.id,
          caption: caption.trim() || null,
          media_url: url,
          media_urls: [url],
          media_type: isVideo ? 'video' : 'image',
          category: profile?.provider_profiles?.category ?? null,
          location: profile?.location ?? null,
          status: 'active',
        })

        if (error) { Alert.alert('Error', error.message); setPublishing(false); return }
      }

      setPublishing(false)
      Alert.alert('Posted! 🎉', 'Your post is now live on the feed.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      console.error(err)
      setPublishing(false)
      Alert.alert('Something went wrong', 'Please try again.')
    }
  }

  return (
    <SafeAreaView style={cs.container}>
      <View style={cs.header}>
        <TouchableOpacity onPress={onBack} style={cs.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={cs.headerTitle}>New Post</Text>
        <TouchableOpacity style={cs.publishBtn} onPress={publish} disabled={publishing}>
          {publishing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={cs.publishBtnText}>Publish</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Preview */}
          {isMultiple ? (
            <View style={cs.multiPreview}>
              <FlatList
                data={selected}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
                renderItem={({ item: asset, index }) => (
                  <View style={cs.multiThumb}>
                    <Image source={{ uri: asset.uri }} style={cs.multiThumbImg} resizeMode="cover" />
                    <View style={cs.multiThumbNum}>
                      <Text style={cs.multiThumbNumText}>{index + 1}</Text>
                    </View>
                  </View>
                )}
              />
              <Text style={cs.multiHint}>{selected.length} photos · clients swipe through these</Text>
            </View>
          ) : (
            <View style={cs.previewWrap}>
              <Image source={{ uri: selected[0]?.uri }} style={cs.previewImage} resizeMode="cover" />
              {isVideo && (
                <View style={cs.videoTag}>
                  <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                </View>
              )}
            </View>
          )}

          {/* Profile row */}
          <View style={cs.profileRow}>
            <View style={cs.avatar}>
              <Text style={cs.avatarText}>{initial}</Text>
            </View>
            <View>
              <Text style={cs.name}>{name}</Text>
              <Text style={cs.cat}>{category}</Text>
            </View>
          </View>

          {/* Caption */}
          <View style={cs.captionWrap}>
            <TextInput
              style={cs.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              maxLength={300}
            />
            <Text style={cs.captionCount}>{caption.length}/300</Text>
          </View>

          {/* Meta */}
          <View style={cs.metaRow}>
            {!!location && (
              <View style={cs.metaItem}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={cs.metaText}>{location}</Text>
              </View>
            )}
            {!!category && (
              <View style={cs.metaItem}>
                <Ionicons name="pricetag-outline" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={cs.metaText}>{category}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={cs.footer}>
        <TouchableOpacity style={[cs.footerBtn, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
          {publishing
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={cs.footerBtnText}>Uploading...</Text>
              </View>
            : <Text style={cs.footerBtnText}>Publish post</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 },
  optionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  optionCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f0f0f0', padding: 20, alignItems: 'center', gap: 10 },
  optionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  optionDesc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },
  slideshowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f0f0f0', padding: 16 },
  slideshowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  slideshowTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  slideshowSub: { fontSize: 12, color: '#888', lineHeight: 17 },
  bigPickerBtn: { marginHorizontal: 20, padding: 32, borderRadius: 20, backgroundColor: '#f9f9f9', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#f0f0f0', borderStyle: 'dashed' },
  bigPickerText: { fontSize: 15, fontWeight: '600', color: '#333' },
})

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  publishBtn: { backgroundColor: '#ff5a1f', paddingHorizontal: 18, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  previewWrap: { position: 'relative' },
  previewImage: { width, height: width, backgroundColor: '#1a1a1a' },
  videoTag: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  multiPreview: { paddingVertical: 16 },
  multiThumb: { position: 'relative' },
  multiThumbImg: { width: 120, height: 120, borderRadius: 12 },
  multiThumbNum: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  multiThumbNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  multiHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ff5a1f', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cat: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  captionWrap: { marginHorizontal: 20, marginBottom: 16 },
  captionInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, fontSize: 15, color: '#fff', lineHeight: 22, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  captionCount: { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 6 },
  metaRow: { paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#09090b', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  footerBtn: { height: 58, borderRadius: 16, backgroundColor: '#ff5a1f', alignItems: 'center', justifyContent: 'center' },
  footerBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
