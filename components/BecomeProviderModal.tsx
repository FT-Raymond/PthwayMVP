import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Dimensions, SafeAreaView,
} from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

type Props = {
  visible: boolean
  onClose: () => void
  onContinue: () => void
}

export default function BecomeProviderModal({ visible, onClose, onContinue }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.backLayer} />
        <SafeAreaView style={styles.modal}>
          <View style={styles.handle} />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={34} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Start offering services on Pthway</Text>
          <TouchableOpacity activeOpacity={0.9} style={styles.optionCard}>
            <View>
              <Text style={styles.optionText}>Services</Text>
              <Text style={styles.optionSubtext}>
                Hair, nails, fitness,{'\n'}driving lessons and more.
              </Text>
            </View>
            <View style={styles.iconWrapper}>
              <Feather name="scissors" size={48} color="#111" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={styles.nextButton} onPress={onContinue}>
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  backLayer: {
    position: 'absolute', top: 120, alignSelf: 'center',
    width: width - 24, height: height * 0.9,
    backgroundColor: '#BDBDBD',
    borderTopLeftRadius: 42, borderTopRightRadius: 42, opacity: 0.85,
  },
  modal: {
    width: '100%', height: height * 0.72,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 42, borderTopRightRadius: 42,
    paddingHorizontal: 24,
  },
  handle: {
    width: 54, height: 6, borderRadius: 100,
    backgroundColor: '#E2E2E2', alignSelf: 'center', marginTop: 10,
  },
  closeButton: { position: 'absolute', top: 34, right: 24, zIndex: 10 },
  title: {
    marginTop: 72, fontSize: 34, lineHeight: 40,
    fontWeight: '700', color: '#111', letterSpacing: -1.5, width: '92%',
  },
  optionCard: {
    width: '100%', height: 180, backgroundColor: '#F8F8F8',
    borderRadius: 30, marginTop: 36, borderWidth: 1.5, borderColor: '#111',
    paddingHorizontal: 28, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  optionText: { fontSize: 28, fontWeight: '600', color: '#111', letterSpacing: -0.8 },
  optionSubtext: { marginTop: 14, fontSize: 17, lineHeight: 26, color: '#6D6D6D', fontWeight: '400' },
  iconWrapper: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center',
  },
  nextButton: {
    marginTop: 34, height: 76, borderRadius: 28,
    backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center',
  },
  nextButtonText: { fontSize: 24, fontWeight: '600', color: '#FFF', letterSpacing: -0.5 },
})