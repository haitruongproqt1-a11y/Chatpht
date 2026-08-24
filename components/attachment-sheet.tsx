import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { UploadCandidate } from "@/lib/upload";

type AttachmentSheetProps = { visible: boolean; onClose: () => void; onSelect: (assets: UploadCandidate[]) => void };
function asCandidate(asset: ImagePicker.ImagePickerAsset, fallback: string): UploadCandidate {
  return { uri: asset.uri, name: asset.fileName ?? fallback, mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg") };
}

export function AttachmentSheet({ visible, onClose, onSelect }: AttachmentSheetProps) {
  const selectMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsMultipleSelection: true, quality: 0.9, videoMaxDuration: 180 });
    if (!result.canceled && result.assets.length) { onSelect(result.assets.map((asset, index) => asCandidate(asset, `media-${Date.now()}-${index}`))); onClose(); }
  };
  const ensureCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Cần quyền camera", permission.canAskAgain ? "Hãy cấp quyền camera để chụp hoặc quay và gửi trực tiếp." : "Quyền camera đang bị tắt. Hãy bật lại trong Cài đặt thiết bị."); return false; }
    return true;
  };
  const capturePhoto = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled && result.assets[0]) { onSelect([asCandidate(result.assets[0], `camera-${Date.now()}`)]); onClose(); }
  };
  const captureVideo = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 300, quality: 0.9 });
    if (!result.canceled && result.assets[0]) { onSelect([asCandidate(result.assets[0], `video-${Date.now()}.mp4`)]); onClose(); }
  };
  const selectDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: "*/*", multiple: true });
    if (!result.canceled && result.assets.length) { onSelect(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" }))); onClose(); }
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} /><View style={styles.sheet}><View style={styles.handle} /><Text style={styles.title}>Gửi nội dung</Text><TouchableOpacity style={styles.option} onPress={selectMedia}><View style={[styles.optionIcon, { backgroundColor: "#E5F0FF" }]}><MaterialIcons name="perm-media" size={22} color="#0B74E5" /></View><View><Text style={styles.optionTitle}>Ảnh hoặc video</Text><Text style={styles.optionCopy}>Chọn nhiều mục và gửi theo hàng đợi</Text></View></TouchableOpacity><TouchableOpacity style={styles.option} onPress={capturePhoto}><View style={[styles.optionIcon, { backgroundColor: "#E8F8F1" }]}><MaterialIcons name="photo-camera" size={22} color="#16A34A" /></View><View><Text style={styles.optionTitle}>Chụp ảnh</Text><Text style={styles.optionCopy}>Mở camera và gửi trực tiếp</Text></View></TouchableOpacity><TouchableOpacity style={styles.option} onPress={captureVideo}><View style={[styles.optionIcon, { backgroundColor: "#F3E8FF" }]}><MaterialIcons name="videocam" size={22} color="#7C3AED" /></View><View><Text style={styles.optionTitle}>Quay video</Text><Text style={styles.optionCopy}>Tối đa 5 phút, có âm thanh</Text></View></TouchableOpacity><TouchableOpacity style={styles.option} onPress={selectDocument}><View style={[styles.optionIcon, { backgroundColor: "#FFF5E3" }]}><MaterialIcons name="insert-drive-file" size={22} color="#D97706" /></View><View><Text style={styles.optionTitle}>Tệp</Text><Text style={styles.optionCopy}>Tài liệu và định dạng khác</Text></View></TouchableOpacity><TouchableOpacity style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Hủy</Text></TouchableOpacity></View></View></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.38)" }, sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 38 }, handle: { alignSelf: "center", width: 38, height: 5, borderRadius: 5, backgroundColor: "#CBD5E1", marginBottom: 18 }, title: { fontSize: 19, fontWeight: "700", color: "#172033", marginBottom: 14 }, option: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB" }, optionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" }, optionTitle: { fontSize: 16, fontWeight: "600", color: "#172033" }, optionCopy: { fontSize: 13, color: "#64748B", marginTop: 2 }, cancel: { marginTop: 20, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9", borderRadius: 15 }, cancelText: { fontSize: 16, fontWeight: "700", color: "#334155" } });
