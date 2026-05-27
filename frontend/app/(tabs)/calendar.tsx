import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const FALLBACK_PLANTS = ['Mis Plantas 🌱']; 
const ACTION_OPTIONS = ['Regado 💧', 'Abonado 🧪', 'Poda ✂️', 'Cosecha 🧺'];

Notifications.setNotificationHandler({
  handleNotification: async (
    notification: Notifications.Notification
  ): Promise<Notifications.NotificationBehavior> => {
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

interface PlantEvent {
  id: string;
  plant: string;
  action: string;
  time: string;
  notes: string;
}

interface EventsState {
  [date: string]: PlantEvent[];
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<EventsState>({});
  const [botanicalOptions, setBotanicalOptions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>(ACTION_OPTIONS[0]);
  const [notes, setNotes] = useState<string>('');
  const [time, setTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  useEffect(() => {
    // 1. Inicializar notificaciones de Android y registrar el dispositivo en el backend
    configurarNotificacionesYRegistrar();
    // 2. Cargar datos del calendario
    loadInitialData();
  }, []);

  // 🟢 NUEVA LÓGICA: Configurar canal de Android, pedir permisos y guardar token en backend
  const configurarNotificacionesYRegistrar = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alertas-backend', {
        name: 'Recordatorios de Cuidado Botánico',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ade80',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permisos de notificación denegados');
        return;
      }

      try {
        // Generar token de Expo (Asegúrate de tener tu projectId configurado en app.json o EAS)
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'tu-project-id-de-eas' // ⚠️ Reemplazar por tu ID real de proyecto EAS
        });
        
        console.log("Token obtenido:", tokenData.data);

        // Enviar el token obtenido al backend
        await fetch('http://74.220.31.85/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenData.data })
        });
      } catch (err) {
        console.error("Error configurando Push Tokens:", err);
      }
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const plantsRes = await fetch('http://74.220.31.85/plants');
      const plantsData = await plantsRes.json();
      
      const finalPlants = plantsData.length > 0 ? plantsData : FALLBACK_PLANTS;
      setBotanicalOptions(finalPlants);
      setSelectedPlant(finalPlants[0]);

      const eventsRes = await fetch('http://desynth.dev/events');
      const eventsData = await eventsRes.json();

      const groupedEvents = eventsData.reduce((acc: EventsState, item: any) => {
        if (!acc[item.event_date]) acc[item.event_date] = [];
        acc[item.event_date].push({
          id: item.id.toString(),
          plant: item.plant_name,
          action: item.action,
          time: item.event_time,
          notes: item.notes || '',
        });
        return acc;
      }, {});

      setEvents(groupedEvents);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron sincronizar los datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const onChangeTime = (event: any, selectedValue?: Date) => {
    setShowTimePicker(false);
    if (selectedValue) setTime(selectedValue);
  };

  const handleAddEvent = async () => {
    if (!selectedPlant) {
      Alert.alert('Atención', 'Debes seleccionar una planta para la tarea.');
      return;
    }

    setIsSaving(true);
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const response = await fetch('http://desynth.dev/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: selectedDate,
          plant_name: selectedPlant,
          action: selectedAction,
          event_time: timeString,
          notes: notes.trim()
        })
      });

      if (!response.ok) throw new Error('Error al guardar');
      const resData = await response.json();
      const savedNode = resData.data;

      const currentDayEvents = events[selectedDate] || [];
      setEvents({
        ...events,
        [selectedDate]: [
          ...currentDayEvents,
          {
            id: savedNode.id.toString(),
            plant: savedNode.plant_name,
            action: savedNode.action,
            time: savedNode.event_time,
            notes: savedNode.notes || '',
          }
        ],
      });

      setNotes('');
      Alert.alert('¡Planificado!', 'Tarea agendada. El servidor te notificará a la hora fijada.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar la tarea.');
    } finally {
      setIsSaving(false);
    }
  };

  const getMarkedDates = () => {
    const marked: any = {};
    Object.keys(events).forEach((date) => {
      if (events[date].length > 0) {
        marked[date] = { marked: true, dotColor: '#10B981' };
      }
    });
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: '#4ade80',
    };
    return marked;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={{ color: '#6B7280', marginTop: 10 }}>Cargando bitácora y alertas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Calendario Botánico</Text>

      <View style={styles.calendarCard}>
        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          markedDates={getMarkedDates()}
          theme={{ todayTextColor: '#059669', arrowColor: '#059669', selectedDayTextColor: '#000' }}
        />
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Eventos para el: {selectedDate}</Text>
        {(!events[selectedDate] || events[selectedDate].length === 0) ? (
          <Text style={styles.noEventsText}>No hay tareas programadas para hoy 🌱.</Text>
        ) : (
          events[selectedDate].map((item) => (
            <View key={item.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventPlant}>{item.plant}</Text>
                <Text style={styles.eventTime}>{item.time}</Text>
              </View>
              <Text style={styles.eventAction}>{item.action}</Text>
              {item.notes ? <Text style={styles.eventNotes}>📝 {item.notes}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Programar Tareas de tu Bitácora</Text>

        <Text style={styles.label}>Selecciona la Planta:</Text>
        <View style={styles.chipsContainer}>
          {botanicalOptions.map((plant) => (
            <TouchableOpacity
              key={plant}
              style={[styles.chip, selectedPlant === plant && styles.chipActive]}
              onPress={() => setSelectedPlant(plant)}
            >
              <Text style={[styles.chipText, selectedPlant === plant && styles.chipTextActive]}>{plant}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Acción a realizar:</Text>
        <View style={styles.chipsContainer}>
          {ACTION_OPTIONS.map((action) => (
            <TouchableOpacity
              key={action}
              style={[styles.chip, selectedAction === action && styles.chipActiveAction]}
              onPress={() => setSelectedAction(action)}
            >
              <Text style={[styles.chipText, selectedAction === action && styles.chipTextActiveAction]}>{action}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Hora del evento:</Text>
        <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.timeButtonText}>
            ⏰ Configurar Hora ({time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
          </Text>
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker value={time} mode="time" is24Hour={false} display="default" onChange={onChangeTime} />
        )}

        <Text style={styles.label}>Notas u Observaciones (Opcional):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Agregar vitaminas al agua"
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleAddEvent} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Guardar en Calendario</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 15, textAlign: 'center' },
  calendarCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', elevation: 3, marginBottom: 20 },
  sectionContainer: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 10 },
  noEventsText: { color: '#6B7280', backgroundColor: '#FFF', padding: 15, borderRadius: 12, textAlign: 'center' },
  eventCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1, borderLeftWidth: 5, borderLeftColor: '#10B981' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  eventPlant: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  eventTime: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  eventAction: { fontSize: 14, color: '#4B5563', marginBottom: 4 },
  eventNotes: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },
  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, elevation: 3 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginTop: 10, marginBottom: 5 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#A7F3D0' },
  chipActiveAction: { backgroundColor: '#93C5FD' },
  chipText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#065F46', fontWeight: 'bold' },
  chipTextActiveAction: { color: '#1E40AF', fontWeight: 'bold' },
  timeButton: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', marginVertical: 5 },
  timeButtonText: { color: '#374151', fontWeight: '600' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, color: '#111827', marginTop: 5, marginBottom: 15 },
  saveButton: { backgroundColor: '#4ade80', padding: 15, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});