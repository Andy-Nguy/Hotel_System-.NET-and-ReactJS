import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  G,
} from "react-native-svg";

const { width, height } = Dimensions.get("window");
const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  onFinish?: () => void;
  backgroundColor?: string;
  accentColor?: string;
  text?: React.ReactNode; // logo + title bạn truyền vào
};

const ANIMATION_DURATION = 1800; // Faster, more elegant sweep like Marriott
const HOLD_DURATION = 800; // Hold the final state

export default function SplashScreen({
  onFinish,
  backgroundColor = "#161617", // Dark elegant background like Marriott
  accentColor = "#F38E58", // Signature orange color
  text,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const fadeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main sweep animation with elegant easing
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Material design deceleration curve
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(ANIMATION_DURATION * 0.3), // Logo starts appearing after stroke begins
        Animated.timing(fadeProgress, {
          toValue: 1,
          duration: ANIMATION_DURATION * 0.5,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        onFinish && onFinish();
      }, HOLD_DURATION);
    });
  }, [progress, fadeProgress, onFinish]);

  // Signature stroke movement - smoother, more fluid
  const sweepX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.8, width * 0.15],
  });

  const sweepY = progress.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [0, -12, 8, -5, 0],
    extrapolate: "clamp",
  });

  // Stroke opacity - creates drawing effect
  const strokeOpacity = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 1, 0.3],
  });

  // Logo reveal with elegant fade and scale
  const logoOpacity = fadeProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0, 1],
  });

  const logoScale = fadeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const logoTranslateY = fadeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  // Signature highlight (the sweeping light effect)
  const highlightOpacity = progress.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [0, 0.8, 1, 0.6, 0],
  });

  const highlightX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 1.5, width * 0.5],
  });

  // Dot at the end of signature
  const dotOpacity = progress.interpolate({
    inputRange: [0, 0.6, 0.85, 1],
    outputRange: [0, 0, 1, 0.8],
  });

  const dotScale = progress.interpolate({
    inputRange: [0, 0.7, 0.85, 1],
    outputRange: [0, 0, 1.2, 1],
  });

  // Loading dots animation - wave effect
  const getDotAnimation = (index: number) => {
    const delay = index * 0.12; // Stagger each dot with more delay
    return fadeProgress.interpolate({
      inputRange: [0, delay, delay + 0.2, delay + 0.35, 1],
      outputRange: [0, 0, 1, 0.4, 0.5],
      extrapolate: "clamp",
    });
  };

  const getDotScale = (index: number) => {
    const delay = index * 0.12;
    return fadeProgress.interpolate({
      inputRange: [0, delay, delay + 0.2, 1],
      outputRange: [0, 0, 1.4, 1],
      extrapolate: "clamp",
    });
  };

  const longWidth = width * 2.5;
  const signatureY = height * 0.68; // Lower position for better balance

  // Signature path matching Marriott Bonvoy style - smoother, more natural curve
  const signaturePath = `
    M ${-width * 0.45},${signatureY + 10}
    C ${width * -0.05},${signatureY - 80}
      ${width * 0.08},${signatureY + 50}
      ${width * 0.22},${signatureY + 15}
    C ${width * 0.32},${signatureY - 35}
      ${width * 0.42},${signatureY + 45}
      ${width * 0.55},${signatureY + 18}
    C ${width * 0.65},${signatureY - 8}
      ${width * 0.78},${signatureY + 8}
      ${width * 0.92},${signatureY + 5}
    L ${width * 1.08},${signatureY + 3}
  `;

  // Glow path - slightly offset for depth
  const glowPath = `
    M ${-width * 0.43},${signatureY + 12}
    C ${width * -0.03},${signatureY - 75}
      ${width * 0.09},${signatureY + 52}
      ${width * 0.23},${signatureY + 17}
    C ${width * 0.33},${signatureY - 32}
      ${width * 0.43},${signatureY + 47}
      ${width * 0.56},${signatureY + 20}
    C ${width * 0.66},${signatureY - 6}
      ${width * 0.79},${signatureY + 10}
      ${width * 0.93},${signatureY + 7}
    L ${width * 1.09},${signatureY + 5}
  `;

  // Subtle decorative curve underneath
  const decorativePath = `
    M ${-width * 0.42},${signatureY + 22}
    C ${width * -0.02},${signatureY - 55}
      ${width * 0.1},${signatureY + 58}
      ${width * 0.24},${signatureY + 25}
    C ${width * 0.34},${signatureY - 20}
      ${width * 0.44},${signatureY + 52}
      ${width * 0.57},${signatureY + 28}
    C ${width * 0.67},${signatureY}
      ${width * 0.8},${signatureY + 15}
      ${width * 0.94},${signatureY + 12}
  `;

  const dotX = width * 1.08;
  const dotY = signatureY + 3;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* ANIMATED SIGNATURE STROKE */}
      <Animated.View
        style={[
          styles.svgWrapper,
          {
            opacity: strokeOpacity,
            transform: [{ translateX: sweepX }, { translateY: sweepY }],
          },
        ]}
      >
        <AnimatedSvg
          width={longWidth}
          height={height}
          viewBox={`0 0 ${longWidth} ${height}`}
        >
          <Defs>
            {/* Enhanced gradients for premium look */}
            <LinearGradient id="signatureGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <Stop offset="30%" stopColor={accentColor} stopOpacity="0.6" />
              <Stop offset="50%" stopColor={accentColor} stopOpacity="1" />
              <Stop offset="70%" stopColor={accentColor} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </LinearGradient>

            <LinearGradient id="glowGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <Stop offset="40%" stopColor={accentColor} stopOpacity="0.3" />
              <Stop offset="60%" stopColor={accentColor} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </LinearGradient>

            <LinearGradient id="decorativeGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <Stop offset="50%" stopColor={accentColor} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Decorative curve - subtle background element */}
          <Path
            d={decorativePath}
            stroke="url(#decorativeGradient)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={0.4}
          />

          {/* Outer glow for depth */}
          <Path
            d={glowPath}
            stroke="url(#glowGradient)"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
            opacity={0.5}
          />

          {/* Main signature stroke */}
          <Path
            d={signaturePath}
            stroke="url(#signatureGradient)"
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />

          {/* Fine detail line */}
          <Path
            d={signaturePath}
            stroke={accentColor}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={0.4}
          />

          {/* Signature dot */}
          <AnimatedCircle
            cx={dotX}
            cy={dotY}
            r={4.5}
            fill={accentColor}
            opacity={dotOpacity}
            scale={dotScale}
          />
        </AnimatedSvg>
      </Animated.View>

      {/* LOGO/TEXT CONTENT - BASE LAYER */}
      <AnimatedView
        style={[
          styles.content,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
          },
        ]}
      >
        {text}
      </AnimatedView>

      {/* HIGHLIGHT SWEEP - Creates the "painting" effect on logo */}
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Animated.View
            style={[
              styles.highlightMask,
              {
                transform: [{ translateX: highlightX }, { translateY: sweepY }],
              },
            ]}
          >
            <Svg
              width={longWidth}
              height={height}
              viewBox={`0 0 ${longWidth} ${height}`}
            >
              <Path
                d={signaturePath}
                stroke="#ffffff"
                strokeWidth={150}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        }
      >
        <AnimatedView
          style={[
            styles.content,
            {
              opacity: highlightOpacity,
            },
          ]}
        >
          {text}
        </AnimatedView>
      </MaskedView>

      {/* Elegant loading dots at bottom */}
      <Animated.View style={[styles.dotsContainer, { opacity: logoOpacity }]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const dotAnim = getDotAnimation(i / 4);
          const dotScaleAnim = getDotScale(i / 4);
          const isActive = i === 2;

          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: isActive ? accentColor : "#ffffff",
                  opacity: dotAnim,
                  transform: [{ scale: dotScaleAnim }],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  svgWrapper: {
    position: "absolute",
    width: width * 2.5,
    height: height,
  },
  highlightMask: {
    position: "absolute",
    width: width * 2.5,
    height: height,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  dotsContainer: {
    position: "absolute",
    bottom: height * 0.12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
});
