import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  Platform,
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView
} from "react-native";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000");
const HISTORY_KEY = "weather-travel-trips-v1";
const DEFAULT_ORIGIN = { latitude: 10.7769, longitude: 106.7009 };
const DEFAULT_DESTINATION = { latitude: 10.7326, longitude: 106.7199 };
const REMINDER_CHANNEL = "trip-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

function parseCoordinates(value) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const coordinates = {
    latitude: Number(match[1]),
    longitude: Number(match[2])
  };
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    return null;
  }
  return coordinates;
}

function localDateTime(date) {
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function riskColor(score) {
  if (score >= 80) return "#b42318";
  if (score >= 60) return "#d92d20";
  if (score >= 30) return "#b54708";
  return "#027a48";
}

export default function App() {
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [originLabel, setOriginLabel] = useState("Demo start location");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState(null);
  const [places, setPlaces] = useState([]);
  const [departure, setDeparture] = useState(
    new Date(Date.now() + 2 * 60 * 60 * 1000)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [result, setResult] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(null);
  const [tripFilter, setTripFilter] = useState("history");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    async function restoreTrips() {
      try {
        const storedTrips = await AsyncStorage.getItem(HISTORY_KEY);
        if (storedTrips) setTrips(JSON.parse(storedTrips));
      } catch (error) {
        setFeedback("Unable to load saved trip history from this device.");
      }
    }
    restoreTrips();
  }, []);

  async function persistTrips(nextTrips) {
    setTrips(nextTrips);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextTrips));
    } catch (error) {
      setFeedback("Trip data could not be saved on this device.");
    }
  }

  async function useCurrentLocation() {
    setFeedback("");
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setFeedback("Allow location access to use your current GPS position.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setTripId(null);
      setResult(null);
      setOrigin({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      setOriginLabel("Current GPS location");
    } catch (error) {
      setFeedback("Unable to read your GPS position. Check location services and try again.");
    } finally {
      setLocationLoading(false);
    }
  }

  async function searchPlaces() {
    const query = destinationQuery.trim();
    if (query.length < 2) {
      setFeedback("Enter at least two characters to search for a place.");
      return;
    }

    setFeedback("");
    try {
      setSearchingPlaces(true);
      const response = await fetch(
        `${API_URL}/api/places?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Place search failed.");
      }
      setPlaces(data.places || []);
      if (!data.places?.length) setFeedback("No matching places found.");
    } catch (error) {
      setFeedback(error.message || "Place search is unavailable.");
    } finally {
      setSearchingPlaces(false);
    }
  }

  function choosePlace(place) {
    setTripId(null);
    setResult(null);
    setDestination(place);
    setDestinationQuery([place.name, place.region, place.country]
      .filter(Boolean)
      .join(", "));
    setPlaces([]);
    setFeedback("");
  }

  async function analyzeTrip() {
    const destinationCoordinates =
      destination?.coordinates ?? parseCoordinates(destinationQuery);
    if (!destinationCoordinates) {
      setFeedback("Choose a search result or enter valid latitude,longitude coordinates.");
      return;
    }
    if (departure <= new Date()) {
      setFeedback("Choose a departure time in the future.");
      return;
    }

    setFeedback("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analyze-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination: destinationCoordinates,
          departureTime: departure.toISOString()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to analyze this trip.");
      }

      setResult(data);
      const nextTripId = `${Date.now()}`;
      const existingTrip = trips.find((trip) => trip.id === tripId);
      const savedTripId = existingTrip ? tripId : nextTripId;
      setTripId(savedTripId);
      const newTrip = {
        ...existingTrip,
        id: savedTripId,
        origin,
        originLabel,
        destination: destinationCoordinates,
        destinationLabel:
          destination?.name ||
          destinationQuery ||
          `${destinationCoordinates.latitude.toFixed(4)}, ${destinationCoordinates.longitude.toFixed(4)}`,
        departureTime: data.departureTime,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        recommendation: data.recommendation,
        distanceKm: data.route?.distanceKm,
        durationMinutes: data.route?.durationMinutes,
        isSaved: existingTrip?.isSaved ?? false
      };
      const updatedTrips = existingTrip
        ? trips.map((trip) => trip.id === savedTripId ? newTrip : trip)
        : [newTrip, ...trips].slice(0, 50);
      await persistTrips(updatedTrips);
    } catch (error) {
      setResult(null);
      setFeedback(error.message || "Cannot connect to the travel service.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAndScheduleReminder() {
    const activeTrip = trips.find((trip) => trip.id === tripId);
    if (!activeTrip) {
      setFeedback("Analyze the trip before saving it.");
      return;
    }

    const nextTrips = trips.map((trip) =>
      trip.id === tripId ? { ...trip, isSaved: true } : trip
    );
    await persistTrips(nextTrips);

    const reminderAt = new Date(activeTrip.departureTime).getTime() - 60 * 60 * 1000;
    if (reminderAt <= Date.now()) {
      setFeedback("Trip saved. The one-hour reminder time has already passed, so no notification was scheduled.");
      return;
    }

    try {
      if (activeTrip.reminderNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          activeTrip.reminderNotificationId
        );
      }
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setFeedback("Trip saved, but notification permission is disabled on this device.");
        return;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
          name: "Trip reminders",
          importance: Notifications.AndroidImportance.DEFAULT
        });
      }

      const reminderNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Trip weather check",
          body: `Your trip to ${activeTrip.destinationLabel} starts in one hour.`,
          data: { tripId }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderAt),
          ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {})
        }
      });
      await persistTrips(trips.map((trip) =>
        trip.id === tripId ? { ...trip, reminderNotificationId } : trip
      ));
      setFeedback("Trip saved. A reminder is scheduled for one hour before departure.");
    } catch (error) {
      setFeedback("Trip saved, but the reminder could not be scheduled.");
    }
  }

  function loadTrip(trip) {
    setOrigin(trip.origin);
    setOriginLabel(trip.originLabel);
    setDestination({
      name: trip.destinationLabel,
      coordinates: trip.destination
    });
    setDestinationQuery(trip.destinationLabel);
    setDeparture(new Date(trip.departureTime));
    setTripId(trip.id);
    setFeedback("");
    setResult(null);
  }

  const visibleTrips = trips.filter(
    (trip) => tripFilter === "history" || trip.isSaved
  );
  const chartTrips = trips.slice(0, 5).reverse();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRAVEL WEATHER</Text>
          <Text style={styles.title}>Plan with confidence</Text>
          <Text style={styles.subtitle}>
            Weather risks along your route, timed to your departure.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your route</Text>
          <Text style={styles.label}>Starting point</Text>
          <Text style={styles.locationText}>
            {originLabel} · {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={useCurrentLocation}
            disabled={locationLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {locationLoading ? "Finding location…" : "Use my current location"}
            </Text>
          </Pressable>

          <Text style={styles.label}>Destination</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              placeholder="City, address, or latitude,longitude"
              value={destinationQuery}
              onChangeText={(value) => {
                setTripId(null);
                setResult(null);
                setDestinationQuery(value);
                setDestination(null);
                setPlaces([]);
              }}
              onSubmitEditing={searchPlaces}
              returnKeyType="search"
            />
            <Pressable
              style={styles.searchButton}
              onPress={searchPlaces}
              disabled={searchingPlaces}
            >
              <Text style={styles.searchButtonText}>
                {searchingPlaces ? "…" : "Search"}
              </Text>
            </Pressable>
          </View>
          {places.map((place, index) => (
            <Pressable
              key={`${place.name}-${place.coordinates.latitude}-${index}`}
              style={styles.placeResult}
              onPress={() => choosePlace(place)}
            >
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeDetail}>
                {[place.region, place.country].filter(Boolean).join(", ")}
              </Text>
            </Pressable>
          ))}

          <Text style={[styles.label, styles.departureLabel]}>Departure</Text>
          <View style={styles.dateRow}>
            <Pressable
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonCaption}>DATE</Text>
              <Text style={styles.dateButtonValue}>
                {departure.toLocaleDateString()}
              </Text>
            </Pressable>
            <Pressable
              style={styles.dateButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateButtonCaption}>TIME</Text>
              <Text style={styles.dateButtonValue}>
                {departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={departure}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, value) => {
                setShowDatePicker(Platform.OS === "ios");
                if (value) {
                  setTripId(null);
                  setResult(null);
                  const next = new Date(departure);
                  next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
                  setDeparture(next);
                }
              }}
            />
          )}
          {showDatePicker && Platform.OS === "ios" && (
            <Pressable style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.secondaryButtonText}>Done</Text>
            </Pressable>
          )}
          {showTimePicker && (
            <DateTimePicker
              value={departure}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, value) => {
                setShowTimePicker(Platform.OS === "ios");
                if (value) {
                  setTripId(null);
                  setResult(null);
                  const next = new Date(departure);
                  next.setHours(value.getHours(), value.getMinutes());
                  setDeparture(next);
                }
              }}
            />
          )}
          {showTimePicker && Platform.OS === "ios" && (
            <Pressable style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.secondaryButtonText}>Done</Text>
            </Pressable>
          )}
          <Text style={styles.helperText}>{localDateTime(departure)}</Text>

          <Pressable
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={analyzeTrip}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Checking route weather…" : "Analyze my trip"}
            </Text>
          </Pressable>
        </View>

        {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

        {result && (
          <View style={styles.card}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.sectionTitle}>Trip outlook</Text>
                <Text style={styles.resultSubtitle}>
                  {localDateTime(new Date(result.departureTime))}
                </Text>
              </View>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: riskColor(result.riskScore) }
                ]}
              >
                <Text style={styles.riskBadgeText}>{result.riskScore}/100</Text>
              </View>
            </View>

            <Text style={styles.recommendation}>{result.recommendation}</Text>
            <Text style={styles.recommendationDetail}>
              {result.riskLevel} weather risk for this trip
            </Text>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {result.route?.distanceKm?.toFixed(1) ?? "—"}
                </Text>
                <Text style={styles.metricLabel}>km route</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {result.route?.durationMinutes
                    ? `${Math.round(result.route.durationMinutes)} min`
                    : "—"}
                </Text>
                <Text style={styles.metricLabel}>estimated travel</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {result.originWeather?.source === "DEMO" ? "Demo" : "Live"}
                </Text>
                <Text style={styles.metricLabel}>weather data</Text>
              </View>
            </View>

            {result.route?.warning ? (
              <Text style={styles.warning}>{result.route.warning}</Text>
            ) : (
              <Text style={styles.helperText}>
                Driving route and duration estimated by the routing service.
              </Text>
            )}
            {result.originWeather?.source === "DEMO" && (
              <Text style={styles.warning}>
                Demo weather is shown. Add a valid OpenWeather API key for real forecasts.
              </Text>
            )}

            {result.routeWeather?.length > 0 && (
              <View style={styles.chart}>
                <Text style={styles.chartTitle}>Weather risk along the route</Text>
                <View style={styles.routeChart}>
                  {result.routeWeather.map((point, index) => (
                    <View key={`${point.progress}-${index}`} style={styles.chartPoint}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${Math.max(point.riskScore, 5)}%`,
                              backgroundColor: riskColor(point.riskScore)
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.chartScore}>{point.riskScore}</Text>
                      <Text style={styles.chartLabel}>
                        {index === 0
                          ? "Start"
                          : index === result.routeWeather.length - 1
                            ? "End"
                            : `${Math.round(point.progress * 100)}%`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!result.reasons?.length && (
              <View style={styles.reasonGroup}>
                <Text style={styles.chartTitle}>What affects the forecast</Text>
                {result.reasons.map((reason, index) => (
                  <Text key={`${reason}-${index}`} style={styles.reason}>
                    • {reason}
                  </Text>
                ))}
              </View>
            )}
            <Pressable style={styles.secondaryButton} onPress={saveAndScheduleReminder}>
              <Text style={styles.secondaryButtonText}>
                {trips.find((trip) => trip.id === tripId)?.isSaved
                  ? "Update saved trip + reminder"
                  : "Save trip + 1-hour reminder"}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>Your trips</Text>
            <View style={styles.filterRow}>
              <Pressable
                style={[styles.filterButton, tripFilter === "history" && styles.activeFilter]}
                onPress={() => setTripFilter("history")}
              >
                <Text style={[styles.filterText, tripFilter === "history" && styles.activeFilterText]}>
                  History
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterButton, tripFilter === "saved" && styles.activeFilter]}
                onPress={() => setTripFilter("saved")}
              >
                <Text style={[styles.filterText, tripFilter === "saved" && styles.activeFilterText]}>
                  Saved
                </Text>
              </Pressable>
            </View>
          </View>
          {chartTrips.length > 0 && (
            <View style={styles.historyChart}>
              <Text style={styles.chartTitle}>Recent risk scores</Text>
              {chartTrips.map((trip) => (
                <View key={trip.id} style={styles.historyBarRow}>
                  <Text numberOfLines={1} style={styles.historyBarLabel}>
                    {trip.destinationLabel}
                  </Text>
                  <View style={styles.historyBarTrack}>
                    <View
                      style={[
                        styles.historyBar,
                        {
                          width: `${Math.max(trip.riskScore, 2)}%`,
                          backgroundColor: riskColor(trip.riskScore)
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.historyScore}>{trip.riskScore}</Text>
                </View>
              ))}
            </View>
          )}
          {visibleTrips.length ? visibleTrips.map((trip) => (
            <Pressable
              key={trip.id}
              style={styles.tripRow}
              onPress={() => loadTrip(trip)}
            >
              <View style={styles.tripDetails}>
                <Text style={styles.tripTitle}>{trip.destinationLabel}</Text>
                <Text style={styles.tripMeta}>
                  {localDateTime(new Date(trip.departureTime))}
                </Text>
              </View>
              <View style={styles.tripRisk}>
                <Text style={[styles.tripScore, { color: riskColor(trip.riskScore) }]}>
                  {trip.riskScore}
                </Text>
                {trip.isSaved && <Text style={styles.savedMark}>SAVED</Text>}
              </View>
            </Pressable>
          )) : (
            <Text style={styles.helperText}>
              {tripFilter === "saved"
                ? "No saved trips yet. Save an analyzed trip to find it here."
                : "Analyzed trips will appear here on this device."}
            </Text>
          )}
        </View>
        <Text style={styles.footer}>
          Place search: Open-Meteo · Road routing: OSRM · Weather: OpenWeather
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 18, paddingBottom: 36 },
  header: { paddingTop: 24, paddingBottom: 22 },
  eyebrow: { color: "#2563eb", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#101828", fontSize: 30, fontWeight: "800", marginTop: 7 },
  subtitle: { color: "#667085", fontSize: 15, lineHeight: 22, marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e8edf5"
  },
  sectionTitle: { color: "#101828", fontSize: 19, fontWeight: "750" },
  label: { color: "#344054", fontSize: 14, fontWeight: "650", marginTop: 18, marginBottom: 7 },
  locationText: { color: "#475467", fontSize: 14, lineHeight: 20 },
  secondaryButton: {
    backgroundColor: "#edf4ff",
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    marginTop: 12
  },
  secondaryButtonText: { color: "#175cd3", fontWeight: "700", fontSize: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: "#fff",
    borderColor: "#d0d5dd",
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 13,
    color: "#101828"
  },
  searchInput: { flex: 1 },
  searchButton: {
    backgroundColor: "#175cd3",
    borderRadius: 12,
    height: 48,
    minWidth: 74,
    justifyContent: "center",
    alignItems: "center"
  },
  searchButtonText: { color: "#fff", fontWeight: "700" },
  placeResult: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#eaecf0" },
  placeName: { color: "#101828", fontWeight: "700", fontSize: 14 },
  placeDetail: { color: "#667085", fontSize: 12, marginTop: 3 },
  departureLabel: { marginTop: 20 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateButton: {
    flex: 1,
    borderColor: "#d0d5dd",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12
  },
  dateButtonCaption: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  dateButtonValue: { color: "#101828", fontSize: 14, fontWeight: "700", marginTop: 5 },
  pickerDone: { alignItems: "flex-end", padding: 8 },
  helperText: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 8 },
  primaryButton: {
    backgroundColor: "#175cd3",
    borderRadius: 13,
    padding: 16,
    alignItems: "center",
    marginTop: 17
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  feedback: {
    color: "#b42318",
    backgroundColor: "#fef3f2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    lineHeight: 19
  },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultSubtitle: { color: "#667085", fontSize: 12, marginTop: 5 },
  riskBadge: { borderRadius: 100, paddingHorizontal: 13, paddingVertical: 9 },
  riskBadgeText: { color: "#fff", fontWeight: "800" },
  recommendation: { color: "#101828", fontSize: 26, fontWeight: "800", marginTop: 19 },
  recommendationDetail: { color: "#667085", fontSize: 13, marginTop: 2 },
  metricsRow: { flexDirection: "row", marginTop: 20, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 11, marginRight: 6 },
  metricValue: { color: "#101828", fontWeight: "800", fontSize: 17 },
  metricLabel: { color: "#667085", fontSize: 10, lineHeight: 14, marginTop: 4 },
  warning: {
    color: "#9a3412",
    backgroundColor: "#fff7ed",
    borderRadius: 9,
    padding: 10,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10
  },
  chart: { marginTop: 20 },
  chartTitle: { color: "#344054", fontWeight: "700", fontSize: 14, marginBottom: 12 },
  routeChart: {
    height: 110,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderColor: "#e4e7ec"
  },
  chartPoint: { alignItems: "center", width: 44, height: "100%", justifyContent: "flex-end" },
  barTrack: {
    height: 70,
    width: 18,
    justifyContent: "flex-end",
    backgroundColor: "#f2f4f7",
    borderRadius: 9,
    overflow: "hidden"
  },
  bar: { width: "100%", borderRadius: 9 },
  chartScore: { color: "#344054", fontSize: 10, fontWeight: "700", marginTop: 5 },
  chartLabel: { color: "#667085", fontSize: 9, marginTop: 2, marginBottom: 3 },
  reasonGroup: { marginTop: 19 },
  reason: { color: "#475467", fontSize: 13, lineHeight: 20, marginTop: 3 },
  filterRow: { flexDirection: "row", backgroundColor: "#f2f4f7", borderRadius: 9, padding: 3 },
  filterButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 7 },
  activeFilter: { backgroundColor: "#fff" },
  filterText: { color: "#667085", fontSize: 11, fontWeight: "700" },
  activeFilterText: { color: "#175cd3" },
  historyChart: { marginTop: 20, marginBottom: 14 },
  historyBarRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  historyBarLabel: { width: 95, color: "#667085", fontSize: 10 },
  historyBarTrack: { flex: 1, height: 8, backgroundColor: "#f2f4f7", borderRadius: 5 },
  historyBar: { height: 8, borderRadius: 5 },
  historyScore: { width: 24, textAlign: "right", color: "#344054", fontSize: 11, fontWeight: "700" },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: "#f2f4f7"
  },
  tripDetails: { flex: 1 },
  tripTitle: { color: "#101828", fontSize: 14, fontWeight: "700" },
  tripMeta: { color: "#667085", fontSize: 11, marginTop: 4 },
  tripRisk: { alignItems: "flex-end", marginLeft: 10 },
  tripScore: { fontWeight: "800", fontSize: 16 },
  savedMark: { color: "#175cd3", fontWeight: "800", fontSize: 8, marginTop: 2 },
  footer: { textAlign: "center", color: "#98a2b3", fontSize: 10, marginTop: 4 }
});
