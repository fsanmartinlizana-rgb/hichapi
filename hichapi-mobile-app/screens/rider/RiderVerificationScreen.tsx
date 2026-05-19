import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { setDocumentUrl } from '../../services/rider/api'
import type { RiderProfile } from '../../../lib/delivery/types'

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''

interface Props {
  profile: RiderProfile
  token: string
  onLogout: () => void
  onRefresh: () => void
}

type DocType = 'national_id' | 'license' | 'insurance' | 'permit' | 'inspection' | 'driver_record'

export default function RiderVerificationScreen({ profile, token, onLogout, onRefresh }: Props) {
  const [loadingDoc, setLoadingDoc] = useState<DocType | null>(null)
  const hasMissingDocs = 
    !profile.doc_national_id_url ||
    !profile.doc_license_url ||
    !profile.doc_insurance_url ||
    !profile.doc_permit_url ||
    !profile.doc_inspection_url ||
    !profile.doc_driver_record_url

  const isPendingUpload = profile.document_status === 'pending' || hasMissingDocs

  async function handleUpload(docType: DocType) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      Alert.alert('Error de Configuración', 'Faltan las credenciales de Cloudinary en la app.')
      return
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para subir los documentos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    })

    if (result.canceled || !result.assets[0].uri) return

    setLoadingDoc(docType)
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() || 'jpg'

      // 1. Upload directly to Cloudinary using FormData
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: `doc_${docType}_${profile.user_id}.${ext}`,
        type: `image/${ext}`,
      } as any)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', `rider-documents/${profile.user_id}`)

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
      const uploadRes = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errBody = await uploadRes.json()
        throw new Error(errBody.error?.message || 'Error al subir a Cloudinary')
      }

      const uploadData = await uploadRes.json()
      const secureUrl = uploadData.secure_url

      // 2. Update DB with the Cloudinary URL
      await setDocumentUrl(token, docType, secureUrl)
      
      Alert.alert('Éxito', 'Documento subido correctamente.')
      onRefresh() // Refresh profile to get updated URLs
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo subir el documento.')
    } finally {
      setLoadingDoc(null)
    }
  }

  function renderDocRow(docType: DocType, title: string, isUploaded: boolean) {
    // If the rider uses a bicycle, they might not have a license or insurance.
    // However, currently the backend expects all 3. For bicycles, we can upload an ID photo three times as a workaround,
    // or ideally the backend should be updated. For now, we show all 3.
    return (
      <View style={styles.docRow}>
        <View style={styles.docInfo}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={[styles.docStatus, isUploaded && styles.docStatusOk]}>
            {isUploaded ? 'Subido ✅' : 'Falta subir'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadBtn, isUploaded && styles.uploadBtnSecondary]}
          onPress={() => handleUpload(docType)}
          disabled={loadingDoc !== null}
        >
          {loadingDoc === docType ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.uploadBtnText}>{isUploaded ? 'Reemplazar' : 'Subir foto'}</Text>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  if (!isPendingUpload) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⏳</Text>
        </View>
        <Text style={styles.title}>Cuenta en Revisión</Text>
        <Text style={styles.subtitle}>
          Hemos recibido tus documentos. Nuestro equipo los revisará en breve para habilitar tu cuenta.
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onRefresh}>
            <Text style={styles.primaryBtnText}>Actualizar estado</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onLogout}>
            <Text style={styles.secondaryBtnText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📄</Text>
      </View>
      
      <Text style={styles.title}>Faltan Documentos</Text>
      
      <Text style={styles.subtitle}>
        Para proteger la plataforma, necesitamos verificar tu identidad y tu vehículo. Sube fotos claras de los siguientes documentos.
      </Text>

      <View style={styles.docsList}>
        {renderDocRow('national_id', 'RUT (Cédula de Identidad)', !!profile.doc_national_id_url)}
        {renderDocRow('license', 'Licencia de Conducir', !!profile.doc_license_url)}
        {renderDocRow('insurance', 'Seguro / Padrón', !!profile.doc_insurance_url)}
        {renderDocRow('permit', 'Permiso de Circulación', !!profile.doc_permit_url)}
        {renderDocRow('inspection', 'Revisión Técnica', !!profile.doc_inspection_url)}
        {renderDocRow('driver_record', 'Hoja de Vida del Conductor', !!profile.doc_driver_record_url)}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onRefresh}>
          <Text style={styles.primaryBtnText}>Actualizar estado</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onLogout}>
          <Text style={styles.secondaryBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0A0A14', justifyContent: 'center', alignItems: 'center', padding: 32 },
  scrollContainer: { flex: 1, backgroundColor: '#0A0A14' },
  scrollContent:   { alignItems: 'center', padding: 32, paddingTop: 80, paddingBottom: 60 },
  iconContainer:   { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,107,53,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  icon:            { fontSize: 32 },
  title:           { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle:        { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 40 },
  docsList:        { width: '100%', gap: 16, marginBottom: 40 },
  docRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16 },
  docInfo:         { flex: 1, marginRight: 12 },
  docTitle:        { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  docStatus:       { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  docStatusOk:     { color: '#10B981' },
  uploadBtn:       { backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  uploadBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.1)' },
  uploadBtnText:   { color: '#fff', fontSize: 14, fontWeight: '600' },
  actions:         { width: '100%', gap: 16 },
  primaryBtn:      { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn:    { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  secondaryBtnText:{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600' },
})
