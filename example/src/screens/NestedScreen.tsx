import { StyleSheet, Text, View } from 'react-native';

export function NestedScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Nested</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#e6edf3' },
});
