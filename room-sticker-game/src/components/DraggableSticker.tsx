import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, ZoomIn, withTiming, withSequence, runOnJS } from 'react-native-reanimated';

type DraggableStickerProps = {
  id: string;
  source: any;
  initialX: number;
  initialY: number;
  initialScale?: number;
  rotation?: number;
  rotation3D?: number;
  isSelected?: boolean;
  isSnapped?: boolean;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateScale?: (id: string, scale: number) => void;
  onSelect?: () => void;
};

export default function DraggableSticker({ id, source, initialX, initialY, initialScale = 1.0, rotation = 0, rotation3D = 0, isSelected = false, isSnapped = false, onUpdatePosition, onUpdateScale, onSelect }: DraggableStickerProps) {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(initialScale);
  const savedScale = useSharedValue(initialScale);
  const savedTranslateX = useSharedValue(initialX);
  const savedTranslateY = useSharedValue(initialY);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    scale.value = initialScale;
    savedScale.value = initialScale;
  }, [initialScale]);

  useEffect(() => {
    translateX.value = initialX;
    translateY.value = initialY;
  }, [initialX, initialY]);

  useEffect(() => {
    if (isSnapped) {
      scale.value = withSequence(
        withTiming(initialScale * 1.2, { duration: 200 }),
        withTiming(initialScale, { duration: 800 })
      );
    }
  }, [isSnapped, initialScale]);

  const pan = Gesture.Pan()
    .enabled(!isSnapped)
    .onStart(() => {
      isDragging.value = true;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      if (onSelect) runOnJS(onSelect)(id);
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(onUpdatePosition)(id, translateX.value, translateY.value);
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    })
    .runOnJS(true)
    .onFinalize(() => {
      if (onUpdateScale) {
        onUpdateScale(id, scale.value);
      }
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (onSelect) onSelect();
    });

  const composed = Gesture.Simultaneous(pan, pinch, tap);

  const animatedStyle = useAnimatedStyle(() => {
    const size = 80 * scale.value;
    const offset = (size - 80) / 2;
    return {
      width: size,
      height: size,
      transform: [
        { translateX: translateX.value - offset },
        { translateY: translateY.value - offset },
        { rotate: `${rotation}deg` },
        { rotateY: `${rotation3D}deg` }
      ],
    };
  });

  const chopsticksStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      right: -25,
      top: -25,
      fontSize: 40,
      opacity: withTiming(isDragging.value ? 1 : 0, { duration: 150 }),
      transform: [
        { rotate: isDragging.value ? '-15deg' : '0deg' }
      ]
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View 
        style={[{ position: 'absolute', top: 0, left: 0, zIndex: 10 }, animatedStyle]}
      >
        <View style={{ borderWidth: isSelected ? 2 : 0, borderColor: '#3b82f6', borderStyle: 'dashed', flex: 1 }}>
          <Image source={source} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>
        <Animated.Text style={chopsticksStyle}>🥢</Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}
