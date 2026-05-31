// app/book/[providerId]/questions.tsx
// Step 2 — Progressive booking questions

import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, ScrollView, KeyboardAvoidingView,
  Platform, Image, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, ChevronRight, Camera, Check } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'

type Question = {
  id: string
  type: 'short_text' | 'yes_no' | 'multiple_choice' | 'photo'
  question: string
  options?: string[]
  required: boolean
}

type Answers = Record<string, any>

export default function QuestionsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    providerId: string
    serviceId: string
    serviceName: string
    servicePrice: string
    serviceDuration: string
    questions: string
  }>()

  const questions: Question[] = params.questions ? JSON.parse(params.questions) : []
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [textDraft, setTextDraft] = useState('')
  const slideAnim = useRef(new Animated.Value(0)).current

  const current = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1
  const progress = questions.length > 0 ? (currentIdx + 1) / questions.length : 0
  const answer = current ? answers[current.id] : undefined
  const currentAnswer = current?.type === 'short_text' ? textDraft : answer
  const canContinue = !current?.required || (
    currentAnswer !== undefined &&
    currentAnswer !== '' &&
    currentAnswer !== null
  )

  function animateNext(forward = true) {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: forward ? -30 : 30,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start()
  }

  function setAnswer(value: any) {
    if (!current) return
    setAnswers(prev => ({ ...prev, [current.id]: value }))
  }

  function saveCurrentTextAnswer() {
    if (!current || current.type !== 'short_text') return answers

    const trimmed = textDraft.trim()
    if (!trimmed) return answers

    const nextAnswers = { ...answers, [current.id]: trimmed }
    setAnswers(nextAnswers)
    return nextAnswers
  }

  function handleContinue() {
    if (!current || !canContinue) return

    const nextAnswers = saveCurrentTextAnswer()

    if (isLast) {
      goToCalendar(nextAnswers)
      return
    }

    animateNext(true)
    setCurrentIdx(i => i + 1)

    const nextQuestion = questions[currentIdx + 1]
    const nextAnswer = nextQuestion ? nextAnswers[nextQuestion.id] : ''
    setTextDraft(typeof nextAnswer === 'string' ? nextAnswer : '')
  }

  function handleBack() {
    if (currentIdx === 0) {
      router.back()
      return
    }

    animateNext(false)

    const prevQuestion = questions[currentIdx - 1]
    const prevAnswer = prevQuestion ? answers[prevQuestion.id] : ''
    setCurrentIdx(i => i - 1)
    setTextDraft(typeof prevAnswer === 'string' ? prevAnswer : '')
  }

  function handleSkip() {
    if (!current || current.required) return

    if (isLast) {
      goToCalendar(answers)
      return
    }

    animateNext(true)
    setCurrentIdx(i => i + 1)

    const nextQuestion = questions[currentIdx + 1]
    const nextAnswer = nextQuestion ? answers[nextQuestion.id] : ''
    setTextDraft(typeof nextAnswer === 'string' ? nextAnswer : '')
  }

  function goToCalendar(finalAnswers: Answers) {
    const answersPayload = questions.map(q => ({
      questionId: q.id,
      question: q.question,
      type: q.type,
      answer: finalAnswers[q.id] ?? null,
    }))

    router.push({
      pathname: '/book/[providerId]/calendar' as any,
      params: {
        providerId: params.providerId,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        servicePrice: params.servicePrice,
        serviceDuration: params.serviceDuration,
        answers: JSON.stringify(answersPayload),
      },
    })
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })

    if (!result.canceled) {
      setAnswer(result.assets[0].uri)
    }
  }

  if (!current) return null

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>

        <Text style={s.stepLabel}>Question {currentIdx + 1} of {questions.length}</Text>

        {!current.required ? (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {current.required ? (
            <View style={s.requiredBadge}>
              <Text style={s.requiredBadgeText}>Required</Text>
            </View>
          ) : null}

          <Text style={s.question}>{current.question}</Text>

          {current.type === 'short_text' ? (
            <TextInput
              style={s.textInput}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Type your answer..."
              placeholderTextColor="#bbb"
              multiline
              autoFocus
              maxLength={300}
            />
          ) : null}

          {current.type === 'yes_no' ? (
            <View style={s.yesNoRow}>
              {['Yes', 'No'].map((opt) => {
                const isSelected = answer === opt

                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.yesNoBtn, isSelected && s.yesNoBtnActive]}
                    onPress={() => setAnswer(opt)}
                    activeOpacity={0.8}
                  >
                    {isSelected ? <Check size={18} color="#fff" style={{ marginRight: 6 }} /> : null}
                    <Text style={[s.yesNoBtnText, isSelected && s.yesNoBtnTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}

          {current.type === 'multiple_choice' && current.options ? (
            <View style={s.optionsList}>
              {current.options.map((opt, i) => {
                const isSelected = answer === opt

                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.optionBtn, isSelected && s.optionBtnActive]}
                    onPress={() => setAnswer(opt)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.optionBtnText, isSelected && s.optionBtnTextActive]}>{opt}</Text>
                    {isSelected ? (
                      <View style={s.optionCheck}>
                        <Check size={14} color="#fff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}

          {current.type === 'photo' ? (
            <View style={s.photoArea}>
              {answer ? (
                <TouchableOpacity onPress={pickPhoto} activeOpacity={0.9}>
                  <Image source={{ uri: answer }} style={s.photoPreview} resizeMode="cover" />
                  <Text style={s.photoChange}>Tap to change</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.photoUploadBtn} onPress={pickPhoto} activeOpacity={0.8}>
                  <Camera size={32} color="#ccc" />
                  <Text style={s.photoUploadText}>Upload a photo</Text>
                  <Text style={s.photoUploadSub}>Tap to browse your library</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.continueBtn, !canContinue && s.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.88}
        >
          <Text style={[s.continueBtnText, !canContinue && s.continueBtnTextDisabled]}>
            {isLast ? 'Continue to calendar' : 'Continue'}
          </Text>
          <ChevronRight size={18} color={canContinue ? '#fff' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#888' },
  skipText: { fontSize: 14, fontWeight: '600', color: '#888' },

  progressTrack: { height: 3, backgroundColor: '#f0f0f0', marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#111', borderRadius: 2 },

  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 },

  requiredBadge: {
    alignSelf: 'flex-start', backgroundColor: '#fff0e8', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16,
  },
  requiredBadgeText: { fontSize: 11, fontWeight: '600', color: '#ff5a1f' },

  question: {
    fontSize: 28, fontWeight: '700', color: '#111',
    letterSpacing: -0.5, lineHeight: 34, marginBottom: 32,
  },

  textInput: {
    fontSize: 18, color: '#111', lineHeight: 26,
    borderBottomWidth: 2, borderBottomColor: '#111',
    paddingBottom: 12, minHeight: 80,
    textAlignVertical: 'top',
  },

  yesNoRow: { flexDirection: 'row', gap: 12 },
  yesNoBtn: {
    flex: 1, height: 56, borderRadius: 14,
    borderWidth: 2, borderColor: '#e0e0e0',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  yesNoBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  yesNoBtnText: { fontSize: 16, fontWeight: '600', color: '#888' },
  yesNoBtnTextActive: { color: '#fff' },

  optionsList: { gap: 10 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 14,
  },
  optionBtnActive: { borderColor: '#111', backgroundColor: '#111' },
  optionBtnText: { fontSize: 16, fontWeight: '500', color: '#111' },
  optionBtnTextActive: { color: '#fff' },
  optionCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  photoArea: { marginTop: 8 },
  photoUploadBtn: {
    height: 200, borderRadius: 16,
    borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  photoUploadText: { fontSize: 16, fontWeight: '600', color: '#888' },
  photoUploadSub: { fontSize: 13, color: '#bbb' },
  photoPreview: { width: '100%', height: 240, borderRadius: 16 },
  photoChange: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 10 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  continueBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#111',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  continueBtnDisabled: { backgroundColor: '#f0f0f0' },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  continueBtnTextDisabled: { color: '#ccc' },
})