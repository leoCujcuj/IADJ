import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Server } from 'lucide-react-native';

export default function SettingsModal({
  visible,
  tempIp,
  setTempIp,
  onClose,
  onSave
}) {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Server color="#A78BFA" size={24} />
            <Text style={styles.modalTitle}>Configuración del Servidor</Text>
          </View>
          <Text style={styles.modalLabel}>IP y Puerto del Servidor Backend:</Text>
          <TextInput
            style={styles.modalInput}
            value={tempIp}
            onChangeText={setTempIp}
            placeholder="e.g. 192.168.1.100:3001"
            placeholderTextColor="#6B7280"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.modalHint}>
            * En emulador Android, usa "10.0.2.2:3001".{"\n"}
            * En dispositivo físico, usa la IP local de tu PC (ej: "192.168.1.50:3001").
          </Text>
          
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
              <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnSave} onPress={onSave}>
              <Text style={styles.modalBtnTextSave}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 12,
  },
  modalHint: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalBtnTextCancel: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnSave: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalBtnTextSave: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
