import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import AppIcon from "./AppIcon";
import { COLORS } from "../constants/theme";

interface DatePickerInputProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Chọn ngày",
}) => {
  const [show, setShow] = useState(false);

  const handleChange = (selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return placeholder;
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputButton}
        onPress={() => setShow(true)}
      >
        <AppIcon
          name="calendar"
          size={18}
          color={COLORS.gray}
          style={{ width: 24, marginRight: 10 }}
        />
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {formatDate(value)}
        </Text>
        <AppIcon
          name="chevron-down"
          size={14}
          color={COLORS.gray}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={show}
        mode="date"
        date={value || new Date()}
        onConfirm={(date) => handleChange(date)}
        onCancel={() => setShow(false)}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        display={Platform.OS === "ios" ? "spinner" : "default"}
        locale="vi-VN"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 6,
  },
  inputButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    // replace gap with explicit spacing for cross-platform support
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.secondary,
  },
  placeholderText: {
    color: COLORS.gray,
  },
});

export default DatePickerInput;
