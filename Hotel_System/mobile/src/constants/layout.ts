import { Platform, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_HEIGHT < 700;

// Bottom tab bar heights for different platforms
export const BOTTOM_TAB_HEIGHT = Platform.select({
  ios: isSmallDevice ? 75 : 85,
  android: isSmallDevice ? 60 : 68,
  default: 68,
});

// Extra padding to ensure content is not hidden behind tab bar
export const BOTTOM_TAB_PADDING = Platform.select({
  ios: BOTTOM_TAB_HEIGHT + 20, // Extra space for iOS safe area
  android: BOTTOM_TAB_HEIGHT + 16,
  default: BOTTOM_TAB_HEIGHT + 16,
});

export const getBottomTabPadding = (bottomInset: number = 0) => {
  return BOTTOM_TAB_HEIGHT + (Platform.OS === 'ios' ? bottomInset : 0) + 16;
};
