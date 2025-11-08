import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { useAudioCall } from '@/hooks/useAudioCall';

export default function CallScreen() {
  const router = useRouter();

  const handleDisconnect = useCallback(() => {
    console.log('Call disconnected, navigating back to home...');
    router.back();
  }, [router]);

  const {
    isConnected,
    isRecording,
    isPlaying,
    isProcessing,
    isMuted,
    isSpeakerOn,
    callDuration,
    connectionStatus,
    connect,
    disconnect,
    toggleMute,
    toggleSpeaker,
  } = useAudioCall(handleDisconnect);

  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (isRecording || isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPlaying]);

  const handleEndCall = () => {
    disconnect();
    router.back();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (!isConnected) return connectionStatus;
    if (isProcessing) return 'Processing...';
    if (isPlaying) return 'AI Speaking';
    if (isRecording) return 'Listening';
    return 'Connected';
  };

  const getStatusColor = () => {
    if (!isConnected) return '#ef4444';
    if (isProcessing) return '#f59e0b';
    if (isPlaying) return '#3b82f6';
    if (isRecording) return '#10b981';
    return '#10b981';
  };

  return (
    <LinearGradient colors={['#1f2937', '#111827']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customer Support</Text>
        <Text style={styles.headerSubtitle}>AdrshyamAI Assistant</Text>
      </View>

      <View style={styles.callContent}>
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[getStatusColor(), '#60a5fa']}
            style={styles.avatarGradient}
          >
            <Phone color="#ffffff" size={64} strokeWidth={2} />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.statusText}>{getStatusText()}</Text>

        {isConnected && (
          <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
        )}

        <View style={styles.indicatorsContainer}>
          {isRecording && (
            <View style={styles.indicator}>
              <View style={[styles.indicatorDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.indicatorText}>Mic Active</Text>
            </View>
          )}

          {isPlaying && (
            <View style={styles.indicator}>
              <View style={[styles.indicatorDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.indicatorText}>Playing Audio</Text>
            </View>
          )}

          {isProcessing && (
            <View style={styles.indicator}>
              <View style={[styles.indicatorDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.indicatorText}>Processing</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            activeOpacity={0.7}
            disabled={!isConnected}
          >
            <View style={styles.controlIconContainer}>
              {isMuted ? (
                <MicOff color="#ffffff" size={28} strokeWidth={2} />
              ) : (
                <Mic color="#ffffff" size={28} strokeWidth={2} />
              )}
            </View>
            <Text style={styles.controlLabel}>
              {isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isSpeakerOn && styles.controlButtonActive,
            ]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
            disabled={!isConnected}
          >
            <View style={styles.controlIconContainer}>
              {isSpeakerOn ? (
                <Volume2 color="#ffffff" size={28} strokeWidth={2} />
              ) : (
                <VolumeX color="#ffffff" size={28} strokeWidth={2} />
              )}
            </View>
            <Text style={styles.controlLabel}>
              {isSpeakerOn ? 'Speaker' : 'Earpiece'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.endCallGradient}
          >
            <PhoneOff color="#ffffff" size={32} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  callContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarContainer: {
    marginBottom: 32,
  },
  avatarGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  durationText: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 24,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  controlsContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  controlButton: {
    alignItems: 'center',
    gap: 8,
  },
  controlButtonActive: {
    opacity: 1,
  },
  controlIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  endCallButton: {
    alignSelf: 'center',
  },
  endCallGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
