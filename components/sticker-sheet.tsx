import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";

const PACKS = [
  { id: "recent", label: "Gần đây", icon: "schedule", stickers: ["😀", "😂", "🥰", "😍", "😎", "🥳", "😭", "😡", "👍", "❤️", "👏", "🙏"] },
  { id: "hello", label: "Chào hỏi", icon: "waving-hand", stickers: ["👋", "🤝", "🙋", "🫡", "🤗", "💬", "✨", "🌈", "☀️", "🌙", "🎉", "💐"] },
  { id: "love", label: "Yêu thương", icon: "favorite", stickers: ["💖", "💕", "💘", "💝", "💞", "😘", "🥹", "🫶", "🌹", "💌", "💋", "🧸"] },
  { id: "fun", label: "Vui nhộn", icon: "sentiment-very-satisfied", stickers: ["🤣", "🤪", "😜", "🤭", "🙈", "🤩", "🤡", "👻", "🎈", "🎊", "🍿", "🕺"] },
  { id: "work", label: "Công việc", icon: "business-center", stickers: ["✅", "📌", "📣", "📝", "📅", "💡", "🚀", "⏰", "📞", "💻", "📊", "🏆"] },
  { id: "food", label: "Ăn uống", icon: "restaurant", stickers: ["🍜", "🍔", "🍕", "🍟", "🍰", "☕", "🧋", "🍻", "🍉", "🍓", "🍣", "🥗"] },
] as const;

type StickerSheetProps = { visible: boolean; onClose: () => void; onSelect: (sticker: string) => void };

export function StickerSheet({ visible, onClose, onSelect }: StickerSheetProps) {
  const [activePack, setActivePack] = useState("recent");
  const pack = useMemo(() => PACKS.find((item) => item.id === activePack) ?? PACKS[0], [activePack]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} /><View style={styles.sheet}><View style={styles.handle} /><View style={styles.heading}><View><Text style={styles.title}>Sticker</Text><Text style={styles.copy}>{pack.label} · {pack.stickers.length} sticker</Text></View><TouchableOpacity style={styles.close} onPress={onClose}><MaterialIcons name="close" size={20} color="#64748B" /></TouchableOpacity></View><View style={styles.grid}>{pack.stickers.map((sticker, index) => <TouchableOpacity key={`${pack.id}-${index}`} style={styles.sticker} onPress={() => { onSelect(sticker); onClose(); }}><Text style={styles.stickerText}>{sticker}</Text></TouchableOpacity>)}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packs}>{PACKS.map((item) => <TouchableOpacity key={item.id} style={[styles.pack, activePack === item.id && styles.packActive]} onPress={() => setActivePack(item.id)}><MaterialIcons name={item.icon as any} size={19} color={activePack === item.id ? "#0B74E5" : "#64748B"} /><Text style={[styles.packLabel, activePack === item.id && styles.packLabelActive]}>{item.label}</Text></TouchableOpacity>)}</ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.38)" }, sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 26 }, handle: { width: 38, height: 5, borderRadius: 5, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 12 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 }, title: { color: "#172033", fontSize: 19, fontWeight: "800" }, copy: { color: "#64748B", fontSize: 12, marginTop: 2 }, close: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }, grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingBottom: 10 }, sticker: { width: "16.666%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }, stickerText: { fontSize: 34 }, packs: { paddingHorizontal: 14, gap: 8, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#E7EDF5" }, pack: { minHeight: 40, paddingHorizontal: 11, borderRadius: 13, backgroundColor: "#F5F8FC", flexDirection: "row", alignItems: "center", gap: 5 }, packActive: { backgroundColor: "#E5F0FF" }, packLabel: { color: "#64748B", fontSize: 12, fontWeight: "700" }, packLabelActive: { color: "#0B74E5" },
});
