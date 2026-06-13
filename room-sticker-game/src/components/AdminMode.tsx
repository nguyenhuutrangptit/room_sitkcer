import React, { useState, useEffect, useReducer } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Image, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Slider from '@react-native-community/slider';
import DraggableSticker from './DraggableSticker';
import { calculateRenderBounds } from '../utils/layout';
import { LEVELS, LevelId, getLevelById } from '../constants/levels';
import { defaultLevelData, defaultStickerImages, defaultRoomImage, defaultLevelId } from '../constants/defaultLevel';

type ImageSource = string | number;
type PlacedItem = { uid: string, uri: ImageSource, id: string, normX: number, normY: number, scale: number, rotation: number, rotation3D: number, layer: number };
type StickerAsset = { id: string, uri: ImageSource };

type HistoryState = {
  past: PlacedItem[][];
  present: PlacedItem[];
  future: PlacedItem[][];
};

type HistoryAction =
  | { type: 'UPDATE'; updater: (prev: PlacedItem[]) => PlacedItem[] }
  | { type: 'SET'; items: PlacedItem[]; skipHistory?: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const MAX_HISTORY = 50;

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'UPDATE': {
      const next = action.updater(state.present);
      if (next === state.present) return state;
      const past = [...state.past, state.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: next, future: [] };
    }
    case 'SET': {
      if (action.items === state.present) return state;
      if (action.skipHistory) {
        return { ...state, present: action.items };
      }
      const past = [...state.past, state.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: action.items, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return { past: newPast, present: previous, future: [state.present, ...state.future] };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return { past: [...state.past, state.present], present: next, future: newFuture };
    }
    default:
      return state;
  }
}

const resolveSource = (src: ImageSource | null) => {
  if (src === null) return undefined;
  if (typeof src === 'number') return src;
  return { uri: src };
};

type ControlPanelProps = {
  selectedStickerId: string | null;
  placedItems: PlacedItem[];
  onRemove: (uid: string) => void;
  onUpdateScale: (uid: string, scale: number) => void;
  onUpdateRotation: (uid: string, rotation: number) => void;
  onUpdateRotation3D: (uid: string, rotation3D: number) => void;
  onUpdateLayer: (uid: string, layer: number) => void;
};

const ControlPanel = React.memo(({
  selectedStickerId,
  placedItems,
  onRemove,
  onUpdateScale,
  onUpdateRotation,
  onUpdateRotation3D,
  onUpdateLayer,
}: ControlPanelProps) => {
  if (!selectedStickerId) return null;
  const selectedItem = placedItems.find(i => i.uid === selectedStickerId);
  if (!selectedItem) return null;
  const { scale, rotation, rotation3D, layer } = selectedItem;

  return (
    <View style={styles.controlPanel}>
      <TouchableOpacity onPress={() => onRemove(selectedStickerId)} style={[styles.btnAction, {backgroundColor: '#ef4444'}]}>
        <Text style={styles.btnActionText}>Delete</Text>
      </TouchableOpacity>
      <View style={styles.controlRow}>
        <Text style={{color: 'white', width: 55, fontSize: 12}}>Scale:</Text>
        <TouchableOpacity onPress={() => onUpdateScale(selectedStickerId, Math.max(0.5, scale - 0.1))} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
        <Slider
          style={{width: 100, height: 40}}
          minimumValue={0.5}
          maximumValue={5.0}
          value={scale}
          onSlidingComplete={(val) => onUpdateScale(selectedStickerId, val)}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#555"
        />
        <TouchableOpacity onPress={() => onUpdateScale(selectedStickerId, Math.min(5.0, scale + 0.1))} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <Text style={{color: 'white', width: 55, fontSize: 12}}>Rotate:</Text>
        <TouchableOpacity onPress={() => onUpdateRotation(selectedStickerId, rotation - 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
        <Slider
          style={{width: 100, height: 40}}
          minimumValue={0}
          maximumValue={360}
          value={rotation}
          onSlidingComplete={(val) => onUpdateRotation(selectedStickerId, val)}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#555"
        />
        <TouchableOpacity onPress={() => onUpdateRotation(selectedStickerId, rotation + 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <Text style={{color: 'white', width: 55, fontSize: 12}}>Rot 3D:</Text>
        <TouchableOpacity onPress={() => onUpdateRotation3D(selectedStickerId, rotation3D - 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>-</Text></TouchableOpacity>
        <Slider
          style={{width: 100, height: 40}}
          minimumValue={0}
          maximumValue={360}
          value={rotation3D}
          onSlidingComplete={(val) => onUpdateRotation3D(selectedStickerId, val)}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#555"
        />
        <TouchableOpacity onPress={() => onUpdateRotation3D(selectedStickerId, rotation3D + 15)} style={styles.btnSmall}><Text style={styles.btnTextSmall}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <Text style={{color: 'white', width: 50}}>Layer:</Text>
        <Slider
          style={{width: 150, height: 40}}
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={layer}
          onSlidingComplete={(val) => onUpdateLayer(selectedStickerId, val)}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#555"
        />
        <Text style={{color: 'white', width: 20}}>{layer}</Text>
      </View>
    </View>
  );
});

export default function AdminMode({ onBack }: { onBack: () => void }) {
  const [bgImage, setBgImage] = useState<ImageSource | null>(null);
  const [bgSize, setBgSize] = useState<{width: number, height: number} | null>(null);
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number}>({ width: 0, height: 0 });
  const [validCanvasSize, setValidCanvasSize] = useState<{width: number, height: number} | null>(null);
  const [stickerAssets, setStickerAssets] = useState<StickerAsset[]>([]);
  const [history, dispatchHistory] = useReducer(historyReducer, { past: [], present: [], future: [] });
  const placedItems = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState<LevelId | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const loadBundledLevel = (levelId: LevelId, skipHistory = false) => {
    const level = getLevelById(levelId);
    if (!level) return;

    setCurrentLevelId(levelId);
    const data = level.data;
    setBgImage(level.roomImage);
    if (data.bgSize) setBgSize(data.bgSize);

    // Show every sticker asset from the level directory in the bottom tray,
    // not only the ones that were auto-placed by the generator.
    const assets: StickerAsset[] = Object.entries(level.stickerImages).map(([id, src]) => ({
      id,
      uri: src as ImageSource,
    }));
    setStickerAssets(assets);

    dispatchHistory({
      type: 'SET',
      items: data.items.map((item: any, idx: number) => ({
        uid: `loaded_${idx}`,
        id: item.id,
        uri: level.stickerImages[item.id],
        normX: item.normX,
        normY: item.normY,
        scale: item.scale ?? 1,
        rotation: item.rotation ?? 0,
        rotation3D: item.rotation3D ?? 0,
        layer: item.layer ?? 1,
      })),
      skipHistory,
    });
  };

  const loadDefaultLevel = (skipHistory = false) => {
    setCurrentLevelId(defaultLevelId);
    setBgImage(defaultRoomImage);
    if (defaultLevelData.bgSize) setBgSize(defaultLevelData.bgSize);

    // Show every sticker asset from the default level directory in the bottom tray.
    const assets: StickerAsset[] = Object.entries(defaultStickerImages).map(([id, src]) => ({
      id,
      uri: src as ImageSource,
    }));
    setStickerAssets(assets);

    dispatchHistory({
      type: 'SET',
      items: defaultLevelData.items.map((item: any, idx: number) => ({
        uid: item.uid ?? `default_${idx}`,
        id: item.id,
        uri: defaultStickerImages[item.id] ?? item.uri,
        normX: item.normX,
        normY: item.normY,
        scale: item.scale ?? 1,
        rotation: item.rotation ?? 0,
        rotation3D: item.rotation3D ?? 0,
        layer: item.layer ?? 1,
      })),
      skipHistory,
    });
  };

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

          // Restore the level first so the full sticker tray and room are available.
          const savedLevelId: LevelId | undefined = data.levelId;
          if (savedLevelId && getLevelById(savedLevelId)) {
            loadBundledLevel(savedLevelId, true);
          } else if (data.bgImage) {
            setBgImage(data.bgImage);
            if (data.bgSize) setBgSize(data.bgSize);
          }

          if (data.items && Array.isArray(data.items)) {
            const loadedItems: PlacedItem[] = data.items.map((item: any, idx: number) => ({
              ...item,
              uid: `loaded_${idx}`
            }));
            dispatchHistory({ type: 'SET', items: loadedItems, skipHistory: true });

            // Fallback: rebuild tray from saved items if no bundled level was restored.
            if (!savedLevelId || !getLevelById(savedLevelId)) {
              const loadedAssets = data.items.map((i: any) => ({ id: i.id, uri: i.uri }));
              const uniqueAssets = Array.from(new Map(loadedAssets.map((item: any) => [item.uri, item])).values());
              setStickerAssets(uniqueAssets as StickerAsset[]);
            }
          }
        } else {
          // First launch: load the bundled default scene so users see a layout immediately.
          loadDefaultLevel(true);
        }
      } catch (e) {
        console.error("Failed to auto-load config", e);
        loadDefaultLevel();
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
    dispatchHistory({
      type: 'UPDATE',
      updater: prev => {
        const maxLayer = prev.reduce((max, item) => Math.max(max, item.layer || 1), 0);
        return [
          ...prev,
          { uid: newId, id: sticker.id, uri: sticker.uri, normX: 0.5, normY: 0.5, scale: 1.0, rotation: 0, rotation3D: 0, layer: maxLayer + 1 }
        ];
      }
    });
    setSelectedStickerId(newId);
  };

  const handleUpdatePosition = (id: string, screenX: number, screenY: number) => {
    const boundsCanvas = validCanvasSize || canvasSize;
    dispatchHistory({
      type: 'UPDATE',
      updater: prev => prev.map(item => {
        if (item.uid === id) {
          const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(boundsCanvas, bgSize);
          const normX = (screenX + 40 - offsetX) / renderWidth;
          const normY = (screenY + 40 - offsetY) / renderHeight;
          return { ...item, normX, normY };
        }
        return item;
      })
    });
  };

  const updateScale = (uid: string, scale: number) => {
    dispatchHistory({ type: 'UPDATE', updater: prev => prev.map(item => item.uid === uid ? { ...item, scale } : item) });
  };

  const updateRotation = (uid: string, rotation: number) => {
    dispatchHistory({ type: 'UPDATE', updater: prev => prev.map(item => item.uid === uid ? { ...item, rotation } : item) });
  };

  const updateRotation3D = (uid: string, rotation3D: number) => {
    dispatchHistory({ type: 'UPDATE', updater: prev => prev.map(item => item.uid === uid ? { ...item, rotation3D } : item) });
  };

  const updateLayer = (uid: string, layer: number) => {
    dispatchHistory({ type: 'UPDATE', updater: prev => prev.map(item => item.uid === uid ? { ...item, layer } : item) });
  };

  const removeSticker = (uid: string) => {
    dispatchHistory({ type: 'UPDATE', updater: prev => prev.filter(item => item.uid !== uid) });
    if (selectedStickerId === uid) setSelectedStickerId(null);
  };

  const serializeLevelData = () => ({
    room: currentLevelId ?? "custom_room",
    levelId: currentLevelId,
    bgImage: bgImage,
    bgSize: bgSize,
    items: placedItems.map(item => ({
      id: item.id,
      uid: item.uid,
      uri: item.uri,
      normX: item.normX,
      normY: item.normY,
      scale: item.scale,
      rotation: item.rotation || 0,
      rotation3D: item.rotation3D || 0,
      layer: item.layer || 1
    }))
  });

  const saveLevelData = async (silent = false) => {
    const levelData = serializeLevelData();
    const jsonString = JSON.stringify(levelData, null, 2);

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('levelData', jsonString);
      } else {
        const fileUri = FileSystem.documentDirectory + 'levelData.json';
        await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });
      }
      setLastSavedAt(new Date());
      if (!silent) {
        Alert.alert("Saved!", "The scene has been saved to levelData.json");
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        Alert.alert("Error", "Could not save file");
      }
    }
  };

  // Auto-save whenever the scene changes.
  useEffect(() => {
    if (!bgImage) return;
    const timeout = setTimeout(() => {
      saveLevelData(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, [placedItems, bgImage, bgSize, currentLevelId]);

  const handleSaveJson = async () => {
    if (placedItems.length === 0) {
      Alert.alert("Empty Room", "Please drag at least one sticker from the bottom tray into the room before saving!");
      return;
    }

    await saveLevelData(false);

    // Also offer to share the file on mobile.
    if (Platform.OS !== 'web') {
      try {
        const fileUri = FileSystem.documentDirectory + 'levelData.json';
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleLoadJson = async () => {
    try {
      let jsonString: string | null = null;
      if (Platform.OS === 'web') {
        jsonString = localStorage.getItem('levelData');
      } else {
        const fileUri = FileSystem.documentDirectory + 'levelData.json';
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          jsonString = await FileSystem.readAsStringAsync(fileUri);
        }
      }

      if (!jsonString) {
        Alert.alert("No Save File", "No saved scene found.");
        return;
      }

      const data = JSON.parse(jsonString);
      const savedLevelId: LevelId | undefined = data.levelId;
      if (savedLevelId && getLevelById(savedLevelId)) {
        loadBundledLevel(savedLevelId, true);
      } else if (data.bgImage) {
        setBgImage(data.bgImage);
        if (data.bgSize) setBgSize(data.bgSize);
      }

      if (data.items && Array.isArray(data.items)) {
        const loadedItems: PlacedItem[] = data.items.map((item: any, idx: number) => ({
          ...item,
          uid: item.uid ?? `loaded_${idx}`
        }));
        dispatchHistory({ type: 'SET', items: loadedItems });
      }

      setLastSavedAt(new Date());
      Alert.alert("Loaded!", "Saved scene has been loaded.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load saved scene");
    }
  };

  const clearConfig = () => {
    // Clear placed stickers only; keep the loaded level's background and tray
    // so the user isn't forced to upload assets again.
    dispatchHistory({ type: 'SET', items: [] });
    setSelectedStickerId(null);
  };

  const undo = () => dispatchHistory({ type: 'UNDO' });
  const redo = () => dispatchHistory({ type: 'REDO' });

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.btnNav} onPress={onBack}>
          <Text style={styles.btnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Level Editor</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 4 }}>
          {LEVELS.map(level => (
            <TouchableOpacity
              key={level.id}
              style={[styles.btnAction, {backgroundColor: '#10b981'}]}
              onPress={() => loadBundledLevel(level.id)}
            >
              <Text style={styles.btnActionText}>{level.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#f59e0b', opacity: canUndo ? 1 : 0.5}]} onPress={undo} disabled={!canUndo}>
            <Text style={styles.btnActionText}>↩ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#f59e0b', opacity: canRedo ? 1 : 0.5}]} onPress={redo} disabled={!canRedo}>
            <Text style={styles.btnActionText}>↪ Redo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#ef4444'}]} onPress={clearConfig}>
            <Text style={styles.btnActionText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAction} onPress={handleLoadJson}>
            <Text style={styles.btnActionText}>Load</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#06b6d4'}]} onPress={() => {
            Alert.alert(
              "Reset to Default",
              "Reload the bundled default level layout? Any unsaved changes will be lost.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", onPress: () => loadDefaultLevel() }
              ]
            );
          }}>
            <Text style={styles.btnActionText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#8b5cf6'}]} onPress={handleSaveJson}>
            <Text style={styles.btnActionText}>Save JSON</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {lastSavedAt && (
        <View style={{ backgroundColor: '#1e1e1e', paddingHorizontal: 16, paddingVertical: 4 }}>
          <Text style={{ color: '#888', fontSize: 12 }}>
            Auto-saved: {lastSavedAt.toLocaleTimeString()}
          </Text>
        </View>
      )}

      <View style={styles.canvasContainer} onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setCanvasSize({ width, height });
        if (width > 0 && height > 0) {
          setValidCanvasSize({ width, height });
        }
      }}>
        {bgImage ? (
          <ImageBackground source={resolveSource(bgImage)} style={styles.canvas} resizeMode="contain">
            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setSelectedStickerId(null)} />
            {[...placedItems].sort((a, b) => (a.layer || 1) - (b.layer || 1)).map(item => {
              const { renderWidth, renderHeight, offsetX, offsetY } = calculateRenderBounds(validCanvasSize || canvasSize, bgSize);
              const centerScreenX = (item.normX * renderWidth) + offsetX;
              const centerScreenY = (item.normY * renderHeight) + offsetY;
              const screenX = centerScreenX - 40;
              const screenY = centerScreenY - 40;
              const baseScale = renderWidth / 800;

              return (
                <DraggableSticker
                  key={item.uid}
                  id={item.uid}
                  source={resolveSource(item.uri)}
                  initialX={screenX}
                  initialY={screenY}
                  scale={item.scale}
                  baseScale={baseScale}
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
        <ControlPanel
          selectedStickerId={selectedStickerId}
          placedItems={placedItems}
          onRemove={removeSticker}
          onUpdateScale={updateScale}
          onUpdateRotation={updateRotation}
          onUpdateRotation3D={updateRotation3D}
          onUpdateLayer={updateLayer}
        />
      </View>

      {/* Sticker Tray */}
      <View style={styles.tray}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, alignItems: 'center' }}>
          <TouchableOpacity style={styles.btnAddSticker} onPress={pickStickers}>
            <Text style={{ color: '#fff', fontSize: 24 }}>+</Text>
          </TouchableOpacity>

          {stickerAssets.map(sticker => (
            <TouchableOpacity key={sticker.id} onPress={() => spawnSticker(sticker)} style={styles.trayItem}>
              <Image source={resolveSource(sticker.uri)} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
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
