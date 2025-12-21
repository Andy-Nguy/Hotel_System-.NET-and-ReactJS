import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { COLORS, SIZES } from "../constants/theme";
import AppIcon from "./AppIcon";

interface HeaderScreenProps {
  title: string;
  onClose: () => void;
  showRightSpace?: boolean;
  leftIcon?: React.ReactNode; // Custom left icon/button
  leftButtonStyle?: object; // Custom style for left button container
}

const HeaderScreen: React.FC<HeaderScreenProps> = ({
  title,
  onClose,
  showRightSpace = true,
  leftIcon,
  leftButtonStyle,
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={onClose} 
        style={[styles.closeButtonContainer, leftButtonStyle]}
      >
        {leftIcon || (
          <AppIcon 
            name="x" 
            size={24} 
            color={COLORS.secondary}
            library="Feather"
          />
        )}
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {showRightSpace && <View style={styles.rightSpace} />}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  closeButtonContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    flex: 1,
    textAlign: "center",
    includeFontPadding: false, // Android - remove extra padding
    textAlignVertical: "center", // Android - center text vertically
    ...Platform.select({
      ios: {
        lineHeight: 28, // iOS - ensure proper line height
      },
      android: {
        marginTop: 2, // Better vertical alignment on Android
      },
    }),
  },
  rightSpace: {
    width: 40,
  },
});

export default HeaderScreen;
