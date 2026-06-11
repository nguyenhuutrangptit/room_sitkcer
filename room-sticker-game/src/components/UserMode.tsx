import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image, Alert, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import DraggableSticker from './DraggableSticker';
import { calculateRenderBounds } from '../utils/layout';
import { LevelId, getLevelById } from '../constants/levels';

type LevelData = {
  room: string;
  bgImage: string;
  bgSize?: { width: number, height: number };
  items: Array<{
    id: string;
    uri: string;
    normX: number;
    normY: number;
    scale: number;
    rotation: number;
    rotation3D: number;
    layer: number;
  }>;
};

type PlayItem = LevelData['items'][0] & {
  currentX: number;
  currentY: number;
  isSnapped: boolean;
};

const GhostSticker = ({ item, playItem, renderWidth, renderHeight, offsetX, offsetY, source }: { item: any, playItem: any, renderWidth: number, renderHeight: number, offsetX: number, offsetY: number, source: any }) => {
  const isSnapped = playItem?.isSnapped || false;
  const responsiveScale = item.scale * (renderWidth / 800);
  const size = 80 * responsiveScale;
  const offset = (size - 80) / 2;
  const centerX = (item.normX * renderWidth) + offsetX;
  const centerY = (item.normY * renderHeight) + offsetY;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isSnapped ? 0 : 0.4, { duration: 1000 })
    };
  }, [isSnapped]);

  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size,
      height: size,
      zIndex: 5,
      transform: [
        { translateX: centerX - 40 - offset },
        { translateY: centerY - 40 - offset },
        { rotate: `${item.rotation}deg` },
        { rotateY: `${item.rotation3D}deg` }
      ]
    }, animatedStyle]}>
      <Image source={source} style={{ width: '100%', height: '100%', resizeMode: 'contain', tintColor: '#666' }} />
    </Animated.View>
  );
};

export default function UserMode({ onBack, levelId }: { onBack: () => void; levelId: LevelId }) {
  const { width: winWidth, height: winHeight } = Dimensions.get('window');
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [stickerImages, setStickerImages] = useState<Record<string, any>>({});
  const [roomImage, setRoomImage] = useState<any>(null);
  const [playItems, setPlayItems] = useState<PlayItem[]>([]);
  const [trayHeight, setTrayHeight] = useState(90);
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number}>({ 
    width: winWidth, 
    height: winHeight - 110 - 90 
  });

  useEffect(() => {
    const level = getLevelById(levelId);
    if (!level) {
      Alert.alert("Error", "Level not found.");
      return;
    }

    const data: LevelData = level.data;
    if (data.items[0] && data.items[0].normX === undefined) {
      Alert.alert("Outdated Config", "Please Clear All in AdminMode and recreate the level.");
      return;
    }

    setLevelData(data);
    setStickerImages(level.stickerImages);
    setRoomImage(level.roomImage);
    
    const cols = Math.max(1, Math.floor(winWidth / 90));
    const rowsCount = Math.ceil(data.items.length / cols) || 1;
    const calculatedTrayHeight = Math.max(90, rowsCount * 90 + 30);
    setTrayHeight(calculatedTrayHeight);
    setCanvasSize(prev => ({ ...prev, height: winHeight - 110 - calculatedTrayHeight }));

    const activeItems = data.items.map((item: any, index: number) => {
      const row = Math.floor(index / cols);
      const itemsInThisRow = row === rowsCount - 1 ? (data.items.length - row * cols) : cols;
      const startX = (winWidth - (itemsInThisRow * 90)) / 2;
      const col = index % cols;
      
      const trayY = (winHeight - 110 - calculatedTrayHeight) + 15;
      return {
        ...item,
        currentX: startX + col * 90 + 5,
        currentY: trayY + row * 90,
        isSnapped: false
      };
    });
    setPlayItems(activeItems);
  }, [levelId, winWidth, winHeight]);

  const handleUpdatePosition = (id: string, screenX: number, screenY: number) => {
    setPlayItems(prev => {
      const newItems = prev.map(item => {
        if (item.id === id) {
          const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(canvasSize, levelData?.bgSize || null);
          const targetCenterX = offsetX + (item.normX * renderWidth);
          const targetCenterY = offsetY + (item.normY * renderHeight);
          
          const dx = (screenX + 40) - targetCenterX;
          const dy = (screenY + 40) - targetCenterY;
          const distance = Math.sqrt(dx*dx + dy*dy);
          
          if (distance < 50) {
            return { ...item, currentX: targetCenterX - 40, currentY: targetCenterY - 40, isSnapped: true };
          }
          return { ...item, currentX: screenX, currentY: screenY, isSnapped: false };
        }
        return item;
      });

      if (newItems.every(i => i.isSnapped)) {
        setTimeout(() => {
          Alert.alert("You Win!", "You've successfully decorated the room!");
        }, 300);
      }

      return newItems;
    });
  };

  if (!levelData || !roomImage) {
    return (
      <View style={styles.container}>
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.btnNav} onPress={onBack}>
            <Text style={styles.btnText}>← Back to Menu</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.btnNav} onPress={onBack}>
          <Text style={styles.btnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Play Mode</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={[styles.canvasContainer, { overflow: 'visible', zIndex: 10 }]} onLayout={e => setCanvasSize({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}>
        <ImageBackground source={roomImage} style={[styles.canvas, { overflow: 'visible' }]} resizeMode="contain">
          
          <Text style={{ position: 'absolute', top: 5, right: 5, color: 'lime', fontSize: 12, zIndex: 999 }}>
            Items: {levelData.items.length} | Play: {playItems.length} | W: {Math.round(canvasSize.width)}
          </Text>

          {/* Empty Level Warning */}
          {levelData.items.length === 0 && (
            <Text style={{ position: 'absolute', top: '50%', width: '100%', textAlign: 'center', color: 'white', fontSize: 18, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10 }}>
              Không có sticker nào được lưu trong phòng này!{"\n"}Vui lòng vào Admin Mode và kéo thả sticker vào phòng trước khi Save.
            </Text>
          )}

          {/* Ghost Images */}
          {levelData.items.map(item => {
             const playItem = playItems.find(p => p.id === item.id);
             const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(canvasSize, levelData.bgSize || null);
             const stickerSource = stickerImages[item.id];
             return <GhostSticker key={`ghost_${item.id}`} item={item} playItem={playItem} renderWidth={renderWidth} renderHeight={renderHeight} offsetX={offsetX} offsetY={offsetY} source={stickerSource} />;
          })}
        </ImageBackground>

        {/* Draggable Stickers at root level of canvasContainer */}
        {[...playItems].sort((a, b) => (a.layer || 1) - (b.layer || 1)).map(item => {
          const { renderWidth } = calculateRenderBounds(canvasSize, levelData.bgSize || null);
          const responsiveScale = item.scale * (renderWidth / 800);
          const stickerSource = stickerImages[item.id];

          return (
            <DraggableSticker
              key={item.id}
              id={item.id}
              source={stickerSource}
              initialX={item.currentX}
              initialY={item.currentY}
              initialScale={responsiveScale}
              rotation={item.rotation}
              rotation3D={item.rotation3D}
              isSnapped={item.isSnapped}
              onUpdatePosition={handleUpdatePosition}
            />
          );
        })}
      </View>

      <View style={[styles.tray, { zIndex: 1, height: trayHeight }]}>
        <Text style={[styles.trayText, { position: 'absolute', top: 5 }]}>Kéo stickers từ khay lên phòng</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 40 },
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#1e1e1e', height: 70 },
  btnNav: { padding: 8 },
  btnText: { color: '#ccc', fontSize: 16 },
  navTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
  tray: { backgroundColor: '#1e1e1e', borderTopWidth: 1, borderTopColor: '#333', justifyContent: 'center', alignItems: 'center' },
  trayText: { color: '#888', fontSize: 12 },
});
