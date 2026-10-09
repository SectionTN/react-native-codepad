export const tsx = `import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type CounterProps = {
  label: string;
  step?: number;
};

/** A counter with a label, the kind of thing every app has once. */
export function Counter({ label, step = 1 }: CounterProps) {
  const [count, setCount] = useState(0);
  const tone = count > 10 ? "warm" : "cool";
  return (
    <View style={{ padding: 16 }}>
      <Text accessibilityRole="header">{label}</Text>
      <Pressable onPress={() => setCount((c) => c + step)}>
        <Text>{\`Tapped \${count} times (\${tone})\`}</Text>
      </Pressable>
      {count === 0 && <Text>Tap to start</Text>}
    </View>
  );
}
`;
