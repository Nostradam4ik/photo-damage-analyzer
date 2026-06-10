import React from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { COLORS, MAX_PHOTOS, RADIUS } from "../constants/config";

interface Props {
  photos: ImagePicker.ImagePickerAsset[];
  onChange: (photos: ImagePicker.ImagePickerAsset[]) => void;
}

async function requestAndLaunch(
  source: "camera" | "gallery",
): Promise<ImagePicker.ImagePickerAsset[]> {
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to take photos.");
      return [];
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    return result.canceled ? [] : result.assets;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission required", "Photo library access is needed to select photos.");
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: MAX_PHOTOS,
    quality: 0.9,
  });
  return result.canceled ? [] : result.assets;
}

export default function PhotoPicker({ photos, onChange }: Props) {
  const canAdd = photos.length < MAX_PHOTOS;

  function handleAdd() {
    Alert.alert("Add photo", "Choose a source", [
      {
        text: "Camera",
        onPress: async () => {
          try {
            const assets = await requestAndLaunch("camera");
            if (assets.length > 0) {
              onChange([...photos, ...assets].slice(0, MAX_PHOTOS));
            }
          } catch {
            Alert.alert("Error", "Could not open camera. Please try again.");
          }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          try {
            const assets = await requestAndLaunch("gallery");
            if (assets.length > 0) {
              onChange([...photos, ...assets].slice(0, MAX_PHOTOS));
            }
          } catch {
            Alert.alert("Error", "Could not open photo library. Please try again.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleRemove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {photos.map((asset, i) => (
          <View key={asset.uri} style={styles.thumb}>
            <Image source={{ uri: asset.uri }} style={styles.thumbImage} />
            <Pressable
              style={styles.removeBtn}
              onPress={() => handleRemove(i)}
              hitSlop={8}
              accessibilityLabel="Remove photo"
            >
              <Text style={styles.removeIcon}>✕</Text>
            </Pressable>
          </View>
        ))}

        {canAdd && (
          <Pressable
            style={({ pressed }) => [styles.addSlot, pressed && styles.addSlotPressed]}
            onPress={handleAdd}
            accessibilityLabel="Add photo"
            accessibilityRole="button"
          >
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addLabel}>Add photo</Text>
          </Pressable>
        )}
      </ScrollView>

      <Text style={styles.hint}>
        {photos.length}/{MAX_PHOTOS} photo{photos.length !== 1 ? "s" : ""} selected
      </Text>
    </View>
  );
}

const THUMB_SIZE = 96;

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { gap: 10, paddingVertical: 4 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    position: "relative",
  },
  thumbImage: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeIcon: { color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 },
  addSlot: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    gap: 4,
  },
  addSlotPressed: { backgroundColor: COLORS.primaryLight },
  addIcon: { fontSize: 26, color: COLORS.textTertiary, lineHeight: 30 },
  addLabel: { fontSize: 11, color: COLORS.textTertiary },
  hint: { fontSize: 12, color: COLORS.textTertiary },
});
