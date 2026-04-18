import { StatusBar } from "expo-status-bar";
import { Platform, SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from "react-native";
import { Home } from "./src/screens/Home";

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <Home />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fffbf5",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0,
  },
});
