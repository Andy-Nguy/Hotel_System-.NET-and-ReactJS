import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import Icon from "react-native-vector-icons/FontAwesome";

interface BookingProgressProps {
  totalRooms?: number;
  currentStage?: "select" | "services" | "checkout" | "complete";
  currentRoom?: number; // 1-based current room when selecting
  selectedRoomNumbers?: number[]; // list of selected room numbers (1-based)
}

const BookingProgress: React.FC<BookingProgressProps> = ({
  totalRooms = 1,
  currentStage = "select",
  currentRoom = 1,
  selectedRoomNumbers = [],
}) => {
  const items: any[] = [];

  for (let i = 1; i <= totalRooms; i++) {
    const finished = selectedRoomNumbers.includes(i);
    const isCurrent = currentStage === "select" && currentRoom === i;
    const status = finished ? "finish" : isCurrent ? "process" : "wait";
    items.push({
      title: `Phòng ${i}`,
      status,
      icon: finished ? "check-circle" : "circle",
      isEmoji: false,
    });
  }

  // Dịch vụ
  const servicesStatus =
    currentStage === "services"
      ? "process"
      : ["checkout", "complete"].includes(currentStage)
      ? "finish"
      : "wait";
  items.push({
    title: "Dịch vụ",
    status: servicesStatus,
    icon: "🛎️",
    isEmoji: true,
  });

  // Thanh toán
  const paymentStatus =
    currentStage === "checkout"
      ? "process"
      : currentStage === "complete"
      ? "finish"
      : "wait";
  items.push({
    title: "Thanh toán",
    status: paymentStatus,
    icon: "💳",
    isEmoji: true,
  });

  // Hoàn tất
  items.push({
    title: "Hoàn tất",
    status: currentStage === "complete" ? "finish" : "wait",
    icon: "✅",
    isEmoji: true,
  });

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={index} style={styles.stepContainer}>
          <View style={styles.stepContent}>
            <View
              style={[
                styles.stepIcon,
                item.status === "finish" && styles.stepIconFinish,
                item.status === "process" && styles.stepIconProcess,
                item.status === "wait" && styles.stepIconWait,
              ]}
            >
              {item.isEmoji ? (
                <Text
                  style={[
                    styles.emojiIcon,
                    {
                      color:
                        item.status === "finish"
                          ? COLORS.white
                          : item.status === "process"
                          ? COLORS.primary
                          : COLORS.gray,
                    },
                  ]}
                >
                  {item.icon}
                </Text>
              ) : (
                <Icon
                  name={item.icon}
                  size={16}
                  color={
                    item.status === "finish"
                      ? COLORS.white
                      : item.status === "process"
                      ? COLORS.primary
                      : COLORS.gray
                  }
                />
              )}
            </View>
            <Text
              style={[
                styles.stepTitle,
                item.status === "finish" && styles.stepTitleFinish,
                item.status === "process" && styles.stepTitleProcess,
                item.status === "wait" && styles.stepTitleWait,
              ]}
            >
              {item.title}
            </Text>
          </View>
          {index < items.length - 1 && (
            <View
              style={[
                styles.connector,
                item.status === "finish" && styles.connectorFinish,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stepContent: {
    alignItems: "center",
    flex: 1,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepIconFinish: {
    backgroundColor: "#52c41a",
  },
  stepIconProcess: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  stepIconWait: {
    backgroundColor: COLORS.lightGray,
  },
  stepTitle: {
    ...FONTS.body4,
    textAlign: "center",
    fontSize: 12,
  },
  stepTitleFinish: {
    color: "#52c41a",
    fontWeight: "600",
  },
  stepTitleProcess: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  stepTitleWait: {
    color: COLORS.gray,
  },
  connector: {
    position: "absolute",
    right: -20,
    top: 16,
    width: 40,
    height: 2,
    backgroundColor: COLORS.lightGray,
  },
  connectorFinish: {
    backgroundColor: "#52c41a",
  },
  emojiIcon: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default BookingProgress;
