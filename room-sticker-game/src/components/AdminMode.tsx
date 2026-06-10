import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Image, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Slider from '@react-native-community/slider';
import DraggableSticker from './DraggableSticker';
import { calculateRenderBounds } from '../utils/layout';

type PlacedItem = { uid: string, uri: string, id: string, normX: number, normY: number, scale: number, rotation: number, rotation3D: number, layer: number };
type StickerAsset = { id: string, uri: string };

export default function AdminMode({ onBack }: { onBack: () => void }) {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgSize, setBgSize] = useState<{width: number, height: number} | null>(null);
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number}>({ width: 0, height: 0 });
  const [stickerAssets, setStickerAssets] = useState<StickerAsset[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  useEffect(() => {
    const loadLevel = async () => {
      try {
        let jsonString: string | null = null;
        if (Platform.OS === 'web') {
          jsonString = localStorage.getItem('levelData');
        } else {
          const fileUri = FileSystem.documentDirectory + 'levelData.json';
          const fileExists = await FileSystem.getInfoAsync(fileUri);
          if (fileExists.exists) {
            jsonString = await FileSystem.readAsStringAsync(fileUri);
          }
        }
        
        if (jsonString) {
          const data = JSON.parse(jsonString);
          if (data.bgImage) setBgImage(data.bgImage);
          if (data.bgSize) setBgSize(data.bgSize);
          
          if (data.items && Array.isArray(data.items)) {
            const loadedItems: PlacedItem[] = data.items.map((item: any, idx: number) => ({
              ...item,
              uid: `loaded_${idx}`
            }));
            setPlacedItems(loadedItems);
            
            const loadedAssets = data.items.map((i: any) => ({ id: i.id, uri: i.uri }));
            const uniqueAssets = Array.from(new Map(loadedAssets.map((item: any) => [item.uri, item])).values());
            setStickerAssets(uniqueAssets as StickerAsset[]);
          }
        }
      } catch (e) {
        console.error("Failed to auto-load config", e);
      }
    };
    loadLevel();
  }, []);

  const assetToBase64 = async (asset: any) => {
    if (Platform.OS === 'web' && asset.file) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(asset.file);
      });
    }
    return asset.uri;
  };

  const pickBackground = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
    if (!result.canceled && result.assets.length > 0) {
      const uri = await assetToBase64(result.assets[0]);
      Image.getSize(uri, (width, height) => {
        setBgSize({ width, height });
        setBgImage(uri);
      }, (e) => {
        setBgImage(uri);
      });
    }
  };

  const pickStickers = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
    if (!result.canceled && result.assets) {
      const newStickers = await Promise.all(result.assets.map(async (asset, index) => ({
        id: `sticker_${Date.now()}_${index}`,
        uri: await assetToBase64(asset)
      })));
      setStickerAssets([...stickerAssets, ...newStickers]);
    }
  };

  const spawnSticker = (sticker: StickerAsset) => {
    const newId = Date.now().toString();
    const maxLayer = placedItems.reduce((max, item) => Math.max(max, item.layer || 1), 0);
    setPlacedItems([
      ...placedItems,
      { uid: newId, id: sticker.id, uri: sticker.uri, normX: 0.5, normY: 0.5, scale: 1.0, rotation: 0, rotation3D: 0, layer: maxLayer + 1 }
    ]);
    setSelectedStickerId(newId);
  };

  const handleUpdatePosition = (id: string, screenX: number, screenY: number) => {
    setPlacedItems(prev => prev.map(item => {
      if (item.uid === id) {
        const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(canvasSize, bgSize);
        const normX = (screenX + 40 - offsetX) / renderWidth;
        const normY = (screenY + 40 - offsetY) / renderHeight;
        return { ...item, normX, normY };
      }
      return item;
    }));
  };

  const updateScale = (uid: string, scale: number) => {
    setPlacedItems(prev => prev.map(item => item.uid === uid ? { ...item, scale } : item));
  };

  const updateRotation = (uid: string, rotation: number) => {
    setPlacedItems(prev => prev.map(item => item.uid === uid ? { ...item, rotation } : item));
  };

  const updateRotation3D = (uid: string, rotation3D: number) => {
    setPlacedItems(prev => prev.map(item => item.uid === uid ? { ...item, rotation3D } : item));
  };

  const updateLayer = (uid: string, layer: number) => {
    setPlacedItems(prev => prev.map(item => item.uid === uid ? { ...item, layer } : item));
  };

  const removeSticker = (uid: string) => {
    setPlacedItems(prev => prev.filter(item => item.uid !== uid));
    if (selectedStickerId === uid) setSelectedStickerId(null);
  };

  const handleSaveJson = async () => {
    if (placedItems.length === 0) {
      Alert.alert("Empty Room", "Please drag at least one sticker from the bottom tray into the room before saving!");
      return;
    }

    const levelData = {
      room: "custom_room",
      bgImage: bgImage,
      bgSize: bgSize,
      items: placedItems.map(item => ({
        id: item.uid, // use uid to ensure unique keys in UserMode
        uri: item.uri,
        normX: item.normX,
        normY: item.normY,
        scale: item.scale,
        rotation: item.rotation || 0,
        rotation3D: item.rotation3D || 0,
        layer: item.layer || 1
      }))
    };
    
    const jsonString = JSON.stringify(levelData, null, 2);
    console.log(jsonString);

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('levelData', jsonString);
        Alert.alert("Saved!", "The JSON has been saved to your browser's local storage.");
      } else {
        const fileUri = FileSystem.documentDirectory + 'levelData.json';
        await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("Saved!", `The JSON has been saved to ${fileUri}`);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save file");
    }
  };

  const clearConfig = () => {
    setBgImage(null);
    setBgSize(null);
    setStickerAssets([]);
    setPlacedItems([]);
    setSelectedStickerId(null);
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem('levelData');
      } catch (e) { console.error("Could not clear localStorage", e); }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.btnNav} onPress={onBack}>
          <Text style={styles.btnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Level Editor</Text>
        <View style={{flexDirection: 'row', gap: 10}}>
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#ef4444'}]} onPress={clearConfig}>
            <Text style={styles.btnActionText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAction} onPress={handleSaveJson}>
            <Text style={styles.btnActionText}>Save JSON</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.canvasContainer} onLayout={e => setCanvasSize({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}>
        {bgImage ? (
          <ImageBackground source={{ uri: bgImage }} style={styles.canvas} resizeMode="contain">
            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setSelectedStickerId(null)} />
            {[...placedItems].sort((a, b) => (a.layer || 1) - (b.layer || 1)).map(item => {
              const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(canvasSize, bgSize);
              const centerScreenX = (item.normX * renderWidth) + offsetX;
              const centerScreenY = (item.normY * renderHeight) + offsetY;
              const screenX = centerScreenX - 40;
              const screenY = centerScreenY - 40;
              const responsiveScale = item.scale * (renderWidth / 800);

              return (
                <DraggableSticker 
                  key={item.uid}
                  id={item.uid}
                  source={{ uri: item.uri }}
                  initialX={screenX}
                  initialY={screenY}
                  initialScale={responsiveScale}
                  rotation={item.rotation || 0}
                  rotation3D={item.rotation3D || 0}
                  isSelected={selectedStickerId === item.uid}
                  onSelect={() => setSelectedStickerId(item.uid)}
                  onUpdatePosition={handleUpdatePosition}
                  onUpdateScale={updateScale}
                />
              );
            })}
          </ImageBackground>
        ) : (
          <View style={styles.emptyCanvas}>
            <Text style={{color: '#aaa', marginBottom: 20}}>No config loaded yet.</Text>
            <TouchableOpacity style={styles.btnAction} onPress={pickBackground}>
              <Text style={styles.btnActionText}>Upload Background</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Selected Sticker Controls Overlay */}
        {selectedStickerId && (
          <View style={styles.controlPanel}>
            <TouchableOpacity onPress={() => removeSticker(selectedStickerId)} style={[styles.btnAction, {backgroundColor: '#ef4444'}]}>
              <Text style={styles.btnActionText}>Delete</Text>
            </TouchableOpacity>
            <View style={styles.controlRow}>
              <Text style={{color: 'white', width: 55, fontSize: 12}}>Scale:</Text>
              <TouchableOpacity onPress={() => updateScale(selectedStickerId, Math.max(0.5, (placedItems.find(i => i.uid === selectedStickerId)?.scale || 1) - 0.1))} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
              <Slider
                style={{width: 100, height: 40}}
                minimumValue={0.5}
                maximumValue={5.0}
                value={placedItems.find(i => i.uid === selectedStickerId)?.scale || 1}
                onValueChange={(val) => updateScale(selectedStickerId, val)}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#555"
              />
              <TouchableOpacity onPress={() => updateScale(selectedStickerId, Math.min(5.0, (placedItems.find(i => i.uid === selectedStickerId)?.scale || 1) + 0.1))} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
            </View>
            <View style={styles.controlRow}>
              <Text style={{color: 'white', width: 55, fontSize: 12}}>Rotate:</Text>
              <TouchableOpacity onPress={() => updateRotation(selectedStickerId, (placedItems.find(i => i.uid === selectedStickerId)?.rotation || 0) - 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
              <Slider
                style={{width: 100, height: 40}}
                minimumValue={0}
                maximumValue={360}
                value={placedItems.find(i => i.uid === selectedStickerId)?.rotation || 0}
                onValueChange={(val) => updateRotation(selectedStickerId, val)}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#555"
              />
              <TouchableOpacity onPress={() => updateRotation(selectedStickerId, (placedItems.find(i => i.uid === selectedStickerId)?.rotation || 0) + 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
            </View>
            <View style={styles.controlRow}>
              <Text style={{color: 'white', width: 55, fontSize: 12}}>Rot 3D:</Text>
              <TouchableOpacity onPress={() => updateRotation3D(selectedStickerId, (placedItems.find(i => i.uid === selectedStickerId)?.rotation3D || 0) - 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
              <Slider
                style={{width: 100, height: 40}}
                minimumValue={0}
                maximumValue={360}
                value={placedItems.find(i => i.uid === selectedStickerId)?.rotation3D || 0}
                onValueChange={(val) => updateRotation3D(selectedStickerId, val)}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#555"
              />
              <TouchableOpacity onPress={() => updateRotation3D(selectedStickerId, (placedItems.find(i => i.uid === selectedStickerId)?.rotation3D || 0) + 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
            </View>
            <View style={styles.controlRow}>
              <Text style={{color: 'white', width: 50}}>Layer:</Text>
              <Slider
                style={{width: 150, height: 40}}
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={placedItems.find(i => i.uid === selectedStickerId)?.layer || 1}
                onValueChange={(val) => updateLayer(selectedStickerId, val)}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#555"
              />
              <Text style={{color: 'white', width: 20}}>{placedItems.find(i => i.uid === selectedStickerId)?.layer || 1}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Sticker Tray */}
      <View style={styles.tray}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, alignItems: 'center' }}>
          <TouchableOpacity style={styles.btnAddSticker} onPress={pickStickers}>
            <Text style={{ color: '#fff', fontSize: 24 }}>+</Text>
          </TouchableOpacity>

          {stickerAssets.map(sticker => (
            <TouchableOpacity key={sticker.id} onPress={() => spawnSticker(sticker)} style={styles.trayItem}>
              <Image source={{ uri: sticker.uri }} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  btnAction: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnActionText: { color: '#fff', fontWeight: 'bold' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
  emptyCanvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tray: { height: 90, backgroundColor: '#1e1e1e', borderTopWidth: 1, borderTopColor: '#333' },
  btnAddSticker: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#555', borderStyle: 'dashed' },
  trayItem: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  controlPanel: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(30,30,30,0.9)', padding: 12, borderRadius: 8, gap: 10, borderWidth: 1, borderColor: '#444' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnSmall: { backgroundColor: '#4b5563', padding: 8, borderRadius: 4, width: 30, alignItems: 'center' },
  btnTextSmall: { color: 'white', fontWeight: 'bold' }
});
