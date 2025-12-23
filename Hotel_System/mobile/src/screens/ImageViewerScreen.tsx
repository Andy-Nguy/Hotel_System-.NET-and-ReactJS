import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as theme from "../constants/theme";

const { width, height } = Dimensions.get("window");

interface RouteParams {
  images: string[];
  initialIndex?: number;
}

const ZoomableImage: React.FC<{
  uri: string;
  resetKey: number;
}> = ({ uri, resetKey }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastPan = useRef({ x: 0, y: 0 });
  const doubleTapRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset on image change
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
    pan.setValue({ x: 0, y: 0 });
    lastScale.current = 1;
    lastPan.current = { x: 0, y: 0 };
  }, [resetKey]);

  const handleDoubleTap = () => {
    const toValue = lastScale.current > 1 ? 1 : 2;
    Animated.timing(scale, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      lastScale.current = toValue;
      if (toValue === 1) {
        pan.setValue({ x: 0, y: 0 });
        lastPan.current = { x: 0, y: 0 };
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gesture) => {
        if (lastScale.current > 1) {
          // allow panning only when zoomed
          const nx = lastPan.current.x + gesture.dx;
          const ny = lastPan.current.y + gesture.dy;
          pan.setValue({ x: nx, y: ny });
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (lastScale.current > 1) {
          lastPan.current = {
            x: lastPan.current.x + gesture.dx,
            y: lastPan.current.y + gesture.dy,
          };
        }
      },
    })
  ).current;

  // Double tap detection
  const onSingleTap = () => {
    const now = Date.now();
    if (doubleTapRef.current && now - doubleTapRef.current < 300) {
      doubleTapRef.current = null;
      handleDoubleTap();
    } else {
      doubleTapRef.current = now;
      setTimeout(() => {
        doubleTapRef.current = null;
      }, 350);
    }
  };

  return (
    <View style={styles.zoomableWrap}>
      <TouchableWithoutFeedback onPress={onSingleTap}>
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [
              { scale: scale },
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          }}
        >
          <Image
            source={{ uri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const ImageViewerScreen: React.FC<any> = ({ route, navigation }) => {
  const { images = [], initialIndex = 0 } = route.params as RouteParams;
  const [index, setIndex] = useState(initialIndex || 0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    // scroll to initial index
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: index * width, animated: false });
      }
    }, 0);
  }, []);

  const onMomentum = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIndex !== index) {
      setIndex(newIndex);
      // reset zoom on image change
      setResetKey((k) => k + 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
          <View style={styles.closeBtn}>
            <Text style={styles.closeText}>Đóng</Text>
          </View>
        </TouchableWithoutFeedback>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentum}
        contentContainerStyle={{ alignItems: "center" }}
      >
        {images.map((uri, i) => (
          <View key={i} style={{ width, height }}>
            <ZoomableImage uri={uri} resetKey={resetKey + i} />
          </View>
        ))}
      </ScrollView>

      {/* Small dot indicator */}
      <View style={styles.indicator} pointerEvents="none">
        {images.map((_, i) => (
          <View
            key={i}
            style={[styles.indDot, i === index ? styles.indDotActive : null]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { position: "absolute", top: 10, left: 10, zIndex: 10 },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 6,
  },
  closeText: { color: "#fff" },
  zoomableWrap: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: width, height: height, flex: 1 },
  indicator: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  indDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 4,
  },
  indDotActive: { backgroundColor: theme.COLORS.white, width: 10, height: 10 },
});

export default ImageViewerScreen;
