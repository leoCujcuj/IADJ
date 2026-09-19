import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Settings, Radio } from 'lucide-react-native';

export default function Header({ onSettingsPress }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleContainer}>
        <Radio color="#8B5CF6" size={22} style={styles.headerIcon} />
        <Text style={styles.headerText}>Gemini Radio AI</Text>
      </View>
      <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
        <Settings color="#E0E0E0" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
    backgroundColor: '#0F0F0F'
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  iconButton: {
    padding: 6,
  },
});
