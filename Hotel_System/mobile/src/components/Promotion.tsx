import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  ViewStyle,
  TextStyle,
  ImageBackgroundProps,
} from 'react-native';

type Props = {
  imageUri?: string;
  title?: string;
  description?: string;
  onDetailsPress?: (e: GestureResponderEvent) => void;
  onRegisterPress?: (e: GestureResponderEvent) => void;
  containerStyle?: ViewStyle;
};

import { getPromotions } from '../api/promotionApi';

const Promotion: React.FC<Props> = ({
  imageUri,
  title,
  description,
  onDetailsPress,
  onRegisterPress,
  containerStyle,
}) => {
  const [remotePromo, setRemotePromo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // always fetch latest promotions so component has accurate data
      setLoading(true);
      console.log('[Promotion] Starting to fetch promotions...');
      try {
        const data = await getPromotions();
        console.log('[Promotion] Fetched data:', data);
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          // prefer the first active promotion when possible
          const active = data.find((p: any) => p.trangThai === 'active') || data[0];
          console.log('[Promotion] Selected promo:', active);
          setRemotePromo(active);
        } else {
          console.log('[Promotion] No promotions found or data is not array');
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('[Promotion] Error fetching:', err);
        setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [imageUri, title]);
 
  // Use only real data from props or DB; do not fall back to mock values.
  const promo = remotePromo;
  const imageSrc = imageUri && imageUri.length > 0 ? imageUri : promo?.hinhAnhBanner;

  const titleText = title && title.length > 0 ? title : promo?.tenKhuyenMai;
  const descriptionText = description || promo?.moTa;

  console.log('[Promotion] render - imageSrc:', imageSrc);
  console.log('[Promotion] render - titleText:', titleText);
  console.log('[Promotion] render - descriptionText:', descriptionText);
  console.log('[Promotion] render - promo:', promo);
  console.log('[Promotion] render - loading:', loading);
  console.log('[Promotion] render - error:', error);

  // If no real data is available, render nothing (no mock data)
  if (!imageSrc && !titleText && !descriptionText) {
    console.log('[Promotion] Returning null - no data');
    
    // Show placeholder while loading or error state for debugging
    if (loading) {
      return (
        <View style={[styles.wrap, containerStyle, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
          <Text style={styles.debugText}>⏳ Loading promotions...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={[styles.wrap, containerStyle, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#fdd' }]}>
          <Text style={[styles.debugText, { color: '#d00' }]}>❌ Error loading promotions:</Text>
          <Text style={[styles.debugText, { color: '#d00', fontSize: 12 }]}>{error}</Text>
        </View>
      );
    }
    
    // No data and not loading/error - means API returned empty array
    return (
      <View style={[styles.wrap, containerStyle, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' }]}>
        <Text style={styles.debugText}>ℹ️ No promotions available</Text>
        <Text style={[styles.debugText, { fontSize: 12, color: '#666' }]}>Check backend database</Text>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, containerStyle]}>
      <ImageBackground
        source={imageSrc ? { uri: imageSrc } : undefined}
        style={styles.bg}
        imageStyle={styles.imageStyle}
        resizeMode="cover"
      >
        {/* dark overlay for contrast */}
        <View style={styles.overlay} />

        <View style={styles.content} pointerEvents="box-none">
          <Text numberOfLines={3} style={styles.title}>
            {titleText}
          </Text>

          {descriptionText ? (
            <Text numberOfLines={2} style={styles.description}>
              {descriptionText}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onDetailsPress}
              style={[styles.button, styles.outlineButton]}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, styles.outlineButtonText]}>Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onRegisterPress}
              style={[styles.button, styles.filledButton]}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, styles.filledButtonText]}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginVertical: 12,
    // shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    // elevation (Android)
    elevation: 6,
  },
  bg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  imageStyle: {
    borderRadius: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: 8,
  } as TextStyle,
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 14,
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  } as ViewStyle,
  filledButton: {
    backgroundColor: '#fff',
  } as ViewStyle,
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  outlineButtonText: {
    color: '#fff',
  } as TextStyle,
  filledButtonText: {
    color: '#111',
  } as TextStyle,
  debugText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  } as TextStyle,
});

export default Promotion;
