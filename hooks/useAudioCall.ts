import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { convertAudioForTeler, resampleAudio, convertFileToRawPCM } from '@/utils/audioProcessing';
import * as FileSystem from 'expo-file-system/legacy';

interface AudioMessage {
  type: 'audio';
  stream_id: string;
  message_id: string;
  data: {
    audio_b64: string;
  };
}

interface StartMessage {
  type: 'start';
  user_id:'demo-user-123',
  account_id: string;
  call_app_id: string;
  call_id: string;
  stream_id: string;
  message_id: number;
  data: {
    encoding: string;
    sample_rate: number;
    channels: number;
  };
}

export const useAudioCall = (onDisconnect?: () => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Calling...');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const playingAudioRef = useRef<any>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const messageIdCounterRef = useRef<number>(1);
  const audioResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const onDisconnectRef = useRef<(() => void) | undefined>(onDisconnect);
  const ringingSound = useRef<Audio.Sound | null>(null);

  const [currentStreamId, setCurrentStreamId] = useState<string>('');
  const [currentCallId, setCurrentCallId] = useState<string>('');

  const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://giancarlo-tensest-indescribably.ngrok-free.dev/media-stream';
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://giancarlo-tensest-indescribably.ngrok-free.dev';

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  useEffect(() => {
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (isConnected) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isConnected]);

  const cleanup = async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (audioResponseTimeoutRef.current) {
      clearTimeout(audioResponseTimeoutRef.current);
      audioResponseTimeoutRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks?.().forEach((track: any) => track.stop());
      } catch (e) {}
    }

    if (nativeRecordingRef.current) {
      try {
        await nativeRecordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      nativeRecordingRef.current = null;
    }

    if (nativeSoundRef.current) {
      try {
        await nativeSoundRef.current.unloadAsync();
      } catch (e) {}
      nativeSoundRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    if (playingAudioRef.current) {
      try {
        playingAudioRef.current.pause();
      } catch (e) {}
      playingAudioRef.current = null;
    }

    if (ringingSound.current) {
      try {
        await ringingSound.current.stopAsync();
        await ringingSound.current.unloadAsync();
      } catch (e) {}
      ringingSound.current = null;
    }
  };

  const connect = async () => {
    const isWeb = Platform.OS === 'web' &&
                  typeof navigator !== 'undefined' &&
                  typeof navigator.mediaDevices !== 'undefined' &&
                  typeof navigator.mediaDevices.getUserMedia !== 'undefined';

    if (isWeb) {
      await connectWeb();
    } else {
      await connectNative();
    }
  };

  const connectWeb = async () => {
    try {
      setConnectionStatus('Calling...');

      await playRingingSound();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      console.log('Microphone access granted');

      console.log('Connecting to WebSocket:', WS_URL);

      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = async () => {
        console.log('WebSocket connected');
        await stopRingingSound();
        setIsConnected(true);
        setConnectionStatus('Connected');

        const callId = `call_${Date.now()}`;
        setCurrentCallId(callId);

        const startMessage: StartMessage = {
          type: 'start',
          user_id:'demo-user-123',
          account_id: 'mobile-app',
          call_app_id: 'mobile-app',
          call_id: callId,
          stream_id: `stream_${Date.now()}`,
          message_id: 1,
          data: {
            encoding: 'audio/l16',
            sample_rate: 8000,
            channels: 1,
          },
        };

        setCurrentStreamId(startMessage.stream_id);
        messageIdCounterRef.current = 2;

        wsRef.current?.send(JSON.stringify(startMessage));
        console.log('Sent start message');

        setTimeout(() => {
          startRecording();
        }, 300);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'audio') {
            const audioData = message.audio_b64 || message.data?.audio_b64;
            if (audioData) {
              console.log('Received audio response');

              if (audioResponseTimeoutRef.current) {
                clearTimeout(audioResponseTimeoutRef.current);
                audioResponseTimeoutRef.current = null;
              }

              setIsProcessing(false);
              playAudioResponse(audioData);
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          setIsProcessing(false);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        console.log('Calling onDisconnect callback:', !!onDisconnectRef.current);
        stopRingingSound();
        setIsConnected(false);
        setIsRecording(false);
        setConnectionStatus('Disconnected');

        const callback = onDisconnectRef.current;
        if (callback) {
          console.log('Executing disconnect callback');
          callback();
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        stopRingingSound();
        setConnectionStatus('Connection Error');
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      stopRingingSound();
      const errorMessage = error instanceof Error ? error.message : String(error);
      setConnectionStatus(`Failed - ${errorMessage}`);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot start recording');
      return;
    }

    try {
      console.log('Starting recording...');

      let mimeType = 'audio/webm;codecs=pcm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
        }
      }

      const options: any = mimeType
        ? {
            mimeType,
            audioBitsPerSecond: 128000,
          }
        : {
            audioBitsPerSecond: 128000,
          };

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

      let audioChunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunks.length > 0) {
          await processRecordedAudio(audioChunks);
        }
        audioChunks = [];
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);

      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecordedAudio = async (audioChunks: Blob[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const combinedBlob = new Blob(audioChunks, {
        type: audioChunks[0]?.type || 'audio/webm',
      });

      if (combinedBlob.size === 0) {
        return;
      }

      const base64Audio = await convertAudioForTeler(combinedBlob);

      if (!base64Audio) {
        console.error('Failed to convert audio');
        return;
      }

      const audioMessage: AudioMessage = {
        type: 'audio',
        stream_id: currentStreamId,
        message_id: messageIdCounterRef.current.toString(),
        data: {
          audio_b64: base64Audio,
        },
      };

      wsRef.current.send(JSON.stringify(audioMessage));
      console.log('Sent audio message');

      messageIdCounterRef.current += 1;
      setIsProcessing(true);

      if (audioResponseTimeoutRef.current) {
        clearTimeout(audioResponseTimeoutRef.current);
      }

      audioResponseTimeoutRef.current = setTimeout(() => {
        console.warn('No audio response received within 10 seconds');
        setIsProcessing(false);

        if (wsRef.current?.readyState === WebSocket.OPEN && isConnectedRef.current && !isMutedRef.current) {
          console.log('Attempting to restart recording after timeout');
          setTimeout(() => {
            startRecording();
          }, 100);
        } else {
          console.warn('Cannot restart recording - WS state:', wsRef.current?.readyState, 'isConnected:', isConnectedRef.current, 'isMuted:', isMutedRef.current);
        }
      }, 10000);
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  const playAudioResponse = async (audioBase64: string) => {
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        console.log('Stopping recording before playing audio response');
        stopRecording();
      }

      setIsPlaying(true);
      setIsProcessing(false);

      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new (window as any).Audio(audioUrl);
      playingAudioRef.current = audio;

      audio.onended = () => {
        console.log('Audio playback finished, restarting recording');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        playingAudioRef.current = null;

        if (isConnectedRef.current && !isMutedRef.current) {
          setTimeout(() => {
            startRecording();
          }, 500);
        }
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        setIsPlaying(false);
        setIsProcessing(false);
        URL.revokeObjectURL(audioUrl);
        playingAudioRef.current = null;

        if (isConnectedRef.current && !isMutedRef.current) {
          setTimeout(() => {
            startRecording();
          }, 500);
        }
      };

      await audio.play();
      console.log('Started playing audio response');
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
      setIsProcessing(false);

      if (isConnectedRef.current && !isMutedRef.current) {
        setTimeout(() => {
          startRecording();
        }, 500);
      }
    }
  };

  const connectNative = async () => {
    try {
      setConnectionStatus('Calling...');

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setConnectionStatus('Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      console.log('Microphone access granted');

      await playRingingSound();

      console.log('Connecting to WebSocket:', WS_URL);

      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = async () => {
        console.log('WebSocket connected');
        await stopRingingSound();
        setIsConnected(true);
        setConnectionStatus('Connected');

        const callId = `call_${Date.now()}`;
        setCurrentCallId(callId);

        const startMessage: StartMessage = {
          type: 'start',
          user_id:'demo-user-123',
          account_id: 'mobile-app',
          call_app_id: 'mobile-app',
          call_id: callId,
          stream_id: `stream_${Date.now()}`,
          message_id: 1,
          data: {
            encoding: 'audio/l16',
            sample_rate: 8000,
            channels: 1,
          },
        };

        setCurrentStreamId(startMessage.stream_id);
        messageIdCounterRef.current = 2;

        wsRef.current?.send(JSON.stringify(startMessage));
        console.log('Sent start message');

        setTimeout(() => {
          startRecordingNative();
        }, 500);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'audio') {
            const audioData = message.audio_b64 || message.data?.audio_b64;
            if (audioData) {
              console.log('Received audio response');

              if (audioResponseTimeoutRef.current) {
                clearTimeout(audioResponseTimeoutRef.current);
                audioResponseTimeoutRef.current = null;
              }

              playAudioResponseNative(audioData);
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        console.log('Calling onDisconnect callback:', !!onDisconnectRef.current);
        stopRingingSound();
        setIsConnected(false);
        setIsRecording(false);
        setConnectionStatus('Disconnected');

        const callback = onDisconnectRef.current;
        if (callback) {
          console.log('Executing disconnect callback');
          callback();
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        stopRingingSound();
        setConnectionStatus('Connection Error');
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      stopRingingSound();
      const errorMessage = error instanceof Error ? error.message : String(error);
      setConnectionStatus(`Failed - ${errorMessage}`);
    }
  };

  const playRingingSound = async () => {
    try {
      const audioSource = require('@/assets/phone-ringing-382734.mp3');
      const { sound } = await Audio.Sound.createAsync(
        audioSource,
        { shouldPlay: true, isLooping: true, volume: 0.5 }
      );
      ringingSound.current = sound;
    } catch (error) {
      console.error('Failed to play ringing sound:', error);
    }
  };

  const stopRingingSound = async () => {
    if (ringingSound.current) {
      try {
        await ringingSound.current.stopAsync();
        await ringingSound.current.unloadAsync();
      } catch (e) {}
      ringingSound.current = null;
    }
  };

  const startRecordingNative = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot start recording - WebSocket not open or null', {
        wsExists: !!wsRef.current,
        readyState: wsRef.current?.readyState,
      });
      return;
    }

    try {
      console.log('Starting native recording...');

      if (nativeRecordingRef.current) {
        console.log('Cleaning up previous recording...');
        try {
          await nativeRecordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.warn('Error cleaning up previous recording:', e);
        }
        nativeRecordingRef.current = null;
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.caf',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      nativeRecordingRef.current = recording;
      setIsRecording(true);

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingNative(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to start native recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecordingNative = async (shouldRestart = false) => {
    console.log('Stopping native recording, shouldRestart:', shouldRestart);
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (nativeRecordingRef.current) {
      try {
        await nativeRecordingRef.current.stopAndUnloadAsync();
        const uri = nativeRecordingRef.current.getURI();
        console.log('Recording stopped, URI:', uri);
        setIsRecording(false);

        if (uri) {
          await processRecordedAudioNative(uri);
        }

        nativeRecordingRef.current = null;

        if (shouldRestart) {
          console.log('Scheduling restart of recording...');
          setTimeout(() => {
            console.log('Attempting to restart recording, WS state:', wsRef.current?.readyState);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              startRecordingNative();
            } else {
              console.error('WebSocket not open, cannot restart recording');
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const processRecordedAudioNative = async (uri: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not open, cannot send audio');
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) {}
      return;
    }

    try {
      console.log('Processing recorded audio from:', uri);

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      if (!base64Audio || base64Audio.length === 0) {
        console.error('Failed to read audio file or file is empty');
        return;
      }

      console.log('Audio file read successfully, size:', base64Audio.length);

      const convertedBase64 = await convertFileToRawPCM(uri, base64Audio);

      if (!convertedBase64) {
        console.error('Failed to convert audio to 16-bit raw PCM');
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch (deleteError) {}
        return;
      }

      console.log('Audio converted to 16-bit raw PCM, size:', convertedBase64.length);

      const audioMessage: AudioMessage = {
        type: 'audio',
        stream_id: currentStreamId,
        message_id: messageIdCounterRef.current.toString(),
        data: {
          audio_b64: convertedBase64,
        },
      };

      const messageString = JSON.stringify(audioMessage);
      console.log('Sending audio message, payload size:', messageString.length);
      wsRef.current.send(messageString);
      console.log('Successfully sent audio message with id:', messageIdCounterRef.current);

      messageIdCounterRef.current += 1;

      if (audioResponseTimeoutRef.current) {
        clearTimeout(audioResponseTimeoutRef.current);
      }

      audioResponseTimeoutRef.current = setTimeout(() => {
        console.warn('No audio response received within 10 seconds, restarting recording');
        setIsProcessing(false);

        if (wsRef.current?.readyState === WebSocket.OPEN && isConnectedRef.current && !isMutedRef.current) {
          console.log('Attempting to restart native recording after timeout');
          startRecordingNative();
        } else {
          console.warn('Cannot restart recording - WS state:', wsRef.current?.readyState, 'isConnected:', isConnectedRef.current, 'isMuted:', isMutedRef.current);
        }
      }, 10000);

      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (deleteError) {
        console.error('Error deleting audio file:', deleteError);
      }
    } catch (error) {
      console.error('Error processing native audio:', error);
    }
  };

  const playAudioResponseNative = async (audioBase64: string) => {
    try {
      console.log('Starting to play audio response...');
      setIsPlaying(true);
      setIsProcessing(false);

      const audioUri = `${FileSystem.cacheDirectory}audio_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
        encoding: 'base64',
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            console.log('Audio playback finished');
            setIsPlaying(false);
            sound.unloadAsync();
            FileSystem.deleteAsync(audioUri, { idempotent: true });
            nativeSoundRef.current = null;

            console.log('Restarting recording after audio playback');
            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                startRecordingNative();
              } else {
                console.error('WebSocket not open, cannot restart recording');
              }
            }, 500);
          }
        }
      );

      nativeSoundRef.current = sound;
    } catch (error) {
      console.error('Failed to play native audio:', error);
      setIsPlaying(false);
      setIsProcessing(false);

      console.log('Restarting recording after audio playback error');
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          startRecordingNative();
        }
      }, 500);
    }
  };

  const disconnect = async () => {
    await cleanup();
    setIsConnected(false);
    setIsRecording(false);
    setIsPlaying(false);
    setIsProcessing(false);
    setConnectionStatus('Disconnected');
    setCurrentStreamId('');
    setCurrentCallId('');
    messageIdCounterRef.current = 1;
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (!isMuted) {
      if (Platform.OS === 'web') {
        stopRecording();
      } else {
        stopRecordingNative(false);
      }
    } else if (isConnected && !isPlaying) {
      if (Platform.OS === 'web') {
        startRecording();
      } else {
        startRecordingNative();
      }
    }
  };

  const toggleSpeaker = async () => {
    setIsSpeakerOn((prev) => !prev);

    if (Platform.OS !== 'web') {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: !isSpeakerOn,
        });
      } catch (error) {
        console.error('Failed to toggle speaker:', error);
      }
    }
  };

  return {
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
  };
};
