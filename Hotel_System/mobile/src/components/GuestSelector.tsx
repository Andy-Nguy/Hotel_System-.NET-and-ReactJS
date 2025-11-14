import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../constants/theme';

interface GuestSelectorProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const GUEST_OPTIONS = [
  { value: 1, label: '1 khách' },
  { value: 2, label: '2 khách' },
  { value: 3, label: '3 khách' },
  { value: 4, label: '4 khách' },
];

const GuestSelector: React.FC<GuestSelectorProps> = ({
  value,
  onChange,
  label = 'Số khách',
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = GUEST_OPTIONS.find((opt) => opt.value === value);

  const handleSelect = (guestValue: number) => {
    onChange(guestValue);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
      >
        <Icon name="users" size={18} color={COLORS.gray} style={{ width: 24, marginRight: 10 }} />
        <Text style={styles.selectorText}>
          {selectedOption?.label || 'Chọn số khách'}
        </Text>
        <Icon name="chevron-down" size={14} color={COLORS.gray} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chọn số khách</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Icon name="times" size={20} color={COLORS.secondary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={GUEST_OPTIONS}
                  keyExtractor={(item) => item.value.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        value === item.value && styles.optionItemSelected,
                      ]}
                      onPress={() => handleSelect(item.value)}
                    >
                      <Icon
                        name="user"
                        size={16}
                        color={value === item.value ? COLORS.primary : COLORS.gray}
                        style={{ width: 20, marginRight: 12 }}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          value === item.value && styles.optionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {value === item.value && (
                        <Icon name="check" size={16} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    // use explicit spacing for icons/text
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // replace gap with margins
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.secondary,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default GuestSelector;
