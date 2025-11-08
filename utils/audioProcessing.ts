export const convertAudioForTeler = async (
  audioBlob: Blob
): Promise<string | null> => {
  try {
    console.log('Converting audio to 16-bit PCM (8kHz mono)...');

    const audioBuffer = await audioBlob.arrayBuffer();

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    try {
      const decodedAudioData = await audioContext.decodeAudioData(audioBuffer);
      console.log('Decoded audio:', {
        sampleRate: decodedAudioData.sampleRate,
        channels: decodedAudioData.numberOfChannels,
        duration: decodedAudioData.duration,
        length: decodedAudioData.length,
      });

      const channelData = decodedAudioData.getChannelData(0);

      const targetSampleRate = 8000;
      const resampledData = await resampleAudio(
        channelData,
        decodedAudioData.sampleRate,
        targetSampleRate
      );

      const pcmData = new Int16Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        const sample = Math.max(-1, Math.min(1, resampledData[i]));
        pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }

      console.log('Converted to 16-bit PCM:', {
        originalSamples: channelData.length,
        resampledSamples: resampledData.length,
        pcmBytes: pcmData.byteLength,
        sampleRate: targetSampleRate,
        channels: 1,
        bitDepth: 16,
      });

      const uint8Array = new Uint8Array(pcmData.buffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));

      await audioContext.close();

      return base64;
    } catch (decodeError) {
      console.error('Error decoding audio:', decodeError);
      await audioContext.close();
      return null;
    }
  } catch (error) {
    console.error('Error converting audio:', error);
    return null;
  }
};

export const resampleAudio = async (
  inputData: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Promise<Float32Array> => {
  if (inputSampleRate === outputSampleRate) {
    return inputData;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(inputData.length / ratio);
  const outputData = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const inputIndex = i * ratio;
    const inputIndexFloor = Math.floor(inputIndex);
    const inputIndexCeil = Math.min(
      inputIndexFloor + 1,
      inputData.length - 1
    );
    const fraction = inputIndex - inputIndexFloor;

    outputData[i] =
      inputData[inputIndexFloor] * (1 - fraction) +
      inputData[inputIndexCeil] * fraction;
  }

  console.log('Resampled audio:', {
    inputSampleRate,
    outputSampleRate,
    inputLength: inputData.length,
    outputLength: outputData.length,
    ratio: ratio.toFixed(3),
  });

  return outputData;
};


export const convertFileToRawPCM = async (
  fileUri: string,
  base64Audio: string
): Promise<string | null> => {
  try {
    console.log('Converting file to 16-bit raw PCM (8kHz mono)...');

    const isWebEnvironment = typeof window !== 'undefined' &&
                             typeof window.AudioContext !== 'undefined';

    if (!isWebEnvironment) {
      console.warn('AudioContext not available, returning base64 audio as-is');
      return base64Audio;
    }

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
    const audioBuffer = await audioBlob.arrayBuffer();

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    try {
      const decodedAudioData = await audioContext.decodeAudioData(audioBuffer);
      console.log('Decoded PCM audio:', {
        sampleRate: decodedAudioData.sampleRate,
        channels: decodedAudioData.numberOfChannels,
        duration: decodedAudioData.duration,
        length: decodedAudioData.length,
      });

      const channelData = decodedAudioData.getChannelData(0);

      const targetSampleRate = 8000;
      const resampledData = await resampleAudio(
        channelData,
        decodedAudioData.sampleRate,
        targetSampleRate
      );

      const pcmData = new Int16Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        const sample = Math.max(-1, Math.min(1, resampledData[i]));
        pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }

      console.log('Converted to 16-bit raw PCM:', {
        originalSamples: channelData.length,
        resampledSamples: resampledData.length,
        pcmBytes: pcmData.byteLength,
        sampleRate: targetSampleRate,
        channels: 1,
        bitDepth: 16,
      });

      const uint8Array = new Uint8Array(pcmData.buffer);
      const base64PCM = btoa(String.fromCharCode(...uint8Array));

      await audioContext.close();

      return base64PCM;
    } catch (decodeError) {
      console.error('Error decoding audio for PCM:', decodeError);
      await audioContext.close();
      return null;
    }
  } catch (error) {
    console.error('Error converting file to PCM:', error);
    return null;
  }
};
