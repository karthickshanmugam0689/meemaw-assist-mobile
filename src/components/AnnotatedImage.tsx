import { useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import type { Region } from "../lib/openai";

export function AnnotatedImage({
  src,
  regions,
}: {
  src: string;
  regions: Region[];
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />
      {size &&
        regions.map((r, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                left: r.x * size.w,
                top: r.y * size.h,
                width: r.width * size.w,
                height: r.height * size.h,
              },
            ]}
          >
            {r.label ? (
              <View style={styles.labelWrap}>
                <Text style={styles.labelText}>{r.label}</Text>
              </View>
            ) : null}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", aspectRatio: 4 / 3, position: "relative" },
  image: { width: "100%", height: "100%", borderRadius: 12 },
  box: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#dc2626",
    borderRadius: 8,
  },
  labelWrap: {
    position: "absolute",
    top: -22,
    left: 0,
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: { color: "white", fontSize: 12, fontWeight: "700" },
});
