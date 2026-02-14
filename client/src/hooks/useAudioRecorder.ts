import { useState, useRef, useCallback } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : undefined

export interface AudioResult {
  transcript: string
  audioBlob: Blob
}

export default function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<{ stop: () => void; onend: (() => void) | null } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')

  const startRecording = useCallback(async () => {
    try {
      transcriptRef.current = ''
      chunksRef.current = []

      // Start speech recognition for transcript
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = navigator.language || 'en-US'

        recognition.onresult = (event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
          let final = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) {
              final += result[0].transcript
            }
          }
          if (final) {
            transcriptRef.current = (transcriptRef.current + ' ' + final).trim()
          }
        }

        recognition.onerror = (event: { error: string }) => {
          if (event.error !== 'aborted') {
            console.error('Speech recognition error:', event.error)
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      }

      // Start media recorder for audio blob
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }, [])

  const stopRecording = useCallback((): Promise<AudioResult> => {
    return new Promise((resolve) => {
      const recognition = recognitionRef.current
      const mediaRecorder = mediaRecorderRef.current

      const finish = () => {
        recognitionRef.current = null
        mediaRecorderRef.current = null
        setIsRecording(false)

        const transcript = transcriptRef.current.trim()
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: 'audio/webm' })
            : new Blob()
        resolve({ transcript, audioBlob: blob })
      }

      let pending = (recognition ? 1 : 0) + (mediaRecorder?.state === 'recording' ? 1 : 0)
      if (pending === 0) {
        finish()
        return
      }

      const maybeFinish = () => {
        pending--
        if (pending <= 0) finish()
      }

      if (recognition) {
        recognition.onend = maybeFinish
        recognition.stop()
      }

      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.onstop = () => {
          mediaRecorder.stream?.getTracks().forEach((track) => track.stop())
          maybeFinish()
        }
        mediaRecorder.stop()
      }
    })
  }, [])

  return { isRecording, startRecording, stopRecording }
}
