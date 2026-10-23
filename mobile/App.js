import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView
} from "react-native";

const API_URL = "http://localhost:3000";

export default function App() {
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyzeTrip() {
    setLoading(true);

    try {
      // Demo coordinates. Replace with GPS coordinates.
      const origin = {
        latitude: 10.7769,
        longitude: 106.7009
      };

      const destinationCoords = {
        latitude: 10.7326,
        longitude: 106.7199
      };

      const response = await fetch(`${API_URL}/api/analyze-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination: destinationCoords
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Cannot connect to backend." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Weather Travel</Text>
        <Text style={styles.subtitle}>
          Check weather before you travel
        </Text>

        <Text style={styles.label}>Destination</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter destination"
          value={destination}
          onChangeText={setDestination}
        />

        <Pressable style={styles.button} onPress={analyzeTrip}>
          <Text style={styles.buttonText}>
            {loading ? "Checking..." : "Analyze Trip"}
          </Text>
        </Pressable>

        {result && !result.error && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trip Analysis</Text>

            <Text style={styles.metric}>
              Risk: {result.riskLevel}
            </Text>

            <Text style={styles.metric}>
              Score: {result.riskScore}/100
            </Text>

            <Text style={styles.metric}>
              Recommendation: {result.recommendation}
            </Text>

            {result.reasons?.map((reason, index) => (
              <Text key={index} style={styles.reason}>
                • {reason}
              </Text>
            ))}
          </View>
        )}

        {result?.error && (
          <Text style={styles.error}>{result.error}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb"
  },
  content: {
    padding: 24
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 30
  },
  subtitle: {
    color: "#667085",
    marginTop: 8,
    marginBottom: 30
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15
  },
  button: {
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 12,
    alignItems: "center"
  },
  buttonText: {
    color: "white",
    fontWeight: "700"
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginTop: 24
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16
  },
  metric: {
    fontSize: 16,
    marginBottom: 10
  },
  reason: {
    marginTop: 6,
    color: "#555"
  },
  error: {
    color: "red",
    marginTop: 20
  }
});
