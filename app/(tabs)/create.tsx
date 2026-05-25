import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

export default function CreateScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="close" size={30} color="#111" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Add to Pthway</Text>
            <Text style={styles.subtitle}>Share your work, services or updates.</Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="sliders" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity activeOpacity={0.9} style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: '#FDF1EC' }]}>
              <Ionicons name="camera-outline" size={32} color="#111" />
            </View>
            <Text style={styles.cardTitle}>Camera</Text>
            <Text style={styles.cardDescription}>Take a photo{'\n'}or video</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: '#F2EBFF' }]}>
              <Ionicons name="images-outline" size={32} color="#111" />
            </View>
            <Text style={styles.cardTitle}>Gallery</Text>
            <Text style={styles.cardDescription}>Choose from{'\n'}your library</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.uploadArea}>
          <Ionicons name="cloud-upload-outline" size={48} color="#ccc" />
          <Text style={styles.uploadText}>Tap Camera or Gallery to get started</Text>
          <Text style={styles.uploadSubtext}>Photos and videos supported</Text>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity>
            <Text style={styles.previewText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextButtonDisabled}>
            <Text style={styles.nextButtonTextDisabled}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 34,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerCenter: {
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15.5,
    color: '#6B6B6B',
    fontWeight: '400',
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginTop: 42,
  },
  card: {
    width: width * 0.36,
    height: 250,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    paddingTop: 34,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    marginTop: 30,
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  cardDescription: {
    marginTop: 12,
    fontSize: 15,
    color: '#6E6E6E',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '400',
  },
  uploadArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  uploadText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  uploadSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#ccc',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  previewText: {
    fontSize: 18,
    color: '#8B8B8B',
    fontWeight: '500',
  },
  nextButtonDisabled: {
    height: 58,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: '#F2F2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonTextDisabled: {
    color: '#B0B0B0',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 6,
  },
})