import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

type Props = {
  onFinish?: () => void;
  backgroundColor?: string;
  accentColor?: string;
  text?: React.ReactNode;
};

export default function SplashScreen({
  onFinish,
  backgroundColor = "#19191a",
  accentColor = "#dfa974",
  text,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  // Sweep position - moves from left to right
  const sweepX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.8, width * 1.8],
  });

  // Vertical wave motion for organic feel
  const sweepY = progress.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [0, -30, 20, -15, 0],
  });

  // Content fade in gradually
  const contentOpacity = progress.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, 0, 1, 1],
  });
  const contentScale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 0.98, 1],
  });

  // Overall scene fade
  const sceneOpacity = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [1, 1, 1, 0],
  });

  useEffect(() => {
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 2500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(500),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, [progress, onFinish]);

  return (
    <Animated.View
      style={[styles.container, { backgroundColor, opacity: sceneOpacity }]}
    >
      {/* Content that gets revealed */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: contentOpacity,
            transform: [{ scale: contentScale }],
          },
        ]}
      >
        {text}
      </Animated.View>

      {/* SVG Organic curved line that sweeps across */}
      <Animated.View
        style={[
          styles.svgContainer,
          {
            transform: [{ translateX: sweepX }, { translateY: sweepY }],
          },
        ]}
      >
        <Svg
          width={width * 2.5}
          height={height}
          viewBox={`0 0 ${width * 2.5} ${height}`}
        >
          {/* Main organic curve - thin wavy line */}
          <Path
            d={`M 0,${height * 0.45} Q ${width * 0.4},${height * 0.35} ${
              width * 0.8
            },${height * 0.5} Q ${width * 1.2},${height * 0.65} ${
              width * 1.6
            },${height * 0.48} Q ${width * 2},${height * 0.38} ${width * 2.5},${
              height * 0.5
            }`}
            stroke={accentColor}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            opacity={0.5}
          />
          {/* Secondary subtle curve */}
          <Path
            d={`M 0,${height * 0.52} Q ${width * 0.5},${height * 0.42} ${
              width * 0.9
            },${height * 0.55} Q ${width * 1.3},${height * 0.68} ${
              width * 1.7
            },${height * 0.52} Q ${width * 2.1},${height * 0.4} ${
              width * 2.5
            },${height * 0.53}`}
            stroke={accentColor}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            opacity={0.3}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  svgContainer: {
    position: "absolute",
    width: width * 2.5,
    height: height,
  },
});
