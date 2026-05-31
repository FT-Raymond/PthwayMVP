import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Send, Phone, MoreHorizontal } from 'lucide-react-native'

function initials(name: string) {
  return (name ?? '?').split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ap}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MessageThread() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [conversation, setConversation] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    loadData()
  }, [conversationId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, provider_id, customer_id')
      .eq('id', conversationId)
      .single()

    if (convs) {
      const ids = [convs.provider_id, convs.customer_id]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
      setConversation({
        ...convs,
        provider: profileMap.get(convs.provider_id),
        customer: profileMap.get(convs.customer_id),
      })
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    setMessages(msgs ?? [])
    setLoading(false)
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100)
  }

  async function send() {
    if (!text.trim() || !userId) return
    setSending(true)
    const content = text.trim()
    setText('')

    const { data: newMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
      })
      .select()
      .single()

    if (newMsg) {
      setMessages(prev => [...prev, newMsg])
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    }

    setSending(false)
  }

  function getOther() {
    if (!conversation) return null
    if (conversation.provider_id === userId) return conversation.customer
    return conversation.provider
  }

  const other = getOther()

  const grouped: any[] = []
  let lastDate = ''
  messages.forEach((msg) => {
    const dateLabel = formatDate(msg.created_at)
    if (dateLabel !== lastDate) {
      grouped.push({ type: 'date', label: dateLabel, id: `date-${msg.id}` })
      lastDate = dateLabel
    }
    grouped.push({ ...msg, type: 'message' })
  })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initials(other?.full_name ?? '?')}</Text>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerName}>{other?.full_name ?? 'Unknown'}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}>
            <Phone size={20} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <MoreHorizontal size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Booking card */}
      <View style={styles.bookingCard}>
        <View style={styles.bookingCardLeft}>
          <View style={styles.bookingCardIcon}>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </View>
          <View>
            <Text style={styles.bookingCardTitle}>Booking request</Text>
            <Text style={styles.bookingCardSub}>Tap to view details</Text>
          </View>
        </View>
        <ChevronLeft size={16} color="#888" style={{ transform: [{ rotate: '180deg' }] }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#ff6b35" />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={grouped}
          keyExtractor={(item) => item.id ?? item.created_at}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return (
                <View style={styles.dateSeparator}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateLabel}>{item.label}</Text>
                  <View style={styles.dateLine} />
                </View>
              )
            }
            const isMe = item.sender_id === userId
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <View style={styles.msgAvatar}>
                    <Text style={styles.msgAvatarText}>{initials(other?.full_name ?? '?')}</Text>
                  </View>
                )}
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            )
          }}
        />
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          <Send size={18} color={text.trim() ? '#fff' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerAvatarText: { fontSize: 14, fontWeight: '600', color: '#111' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#111' },
  headerStatus: { fontSize: 12, color: '#10b981', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  bookingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginVertical: 10,
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 16, padding: 14,
  },
  bookingCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingCardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff8f6', alignItems: 'center', justifyContent: 'center' },
  bookingCardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  bookingCardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#f0f0f0' },
  dateLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  msgAvatarText: { fontSize: 10, fontWeight: '600', color: '#111' },
  bubble: { maxWidth: '72%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: '#111', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#f5f5f5', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#111', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  inputWrapper: {
    flex: 1, borderWidth: 1.5, borderColor: '#e8e8e8',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 120,
  },
  input: { fontSize: 15, color: '#111', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#f0f0f0' },
})