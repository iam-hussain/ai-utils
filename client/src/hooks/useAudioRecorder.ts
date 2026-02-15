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

function getAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export default function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<{ stop: () => void; onend: (() => void) | null } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')

  const clearError = useCallback(() => setError(null), [])

  const startRecording = useCallback(async () => {
    setError(null)
    transcriptRef.current = ''
    chunksRef.current = []

    try {
      if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
        setError('Microphone not supported in this browser')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = getAudioMimeType()
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = () => {
        setError('Recording failed')
      }

      mediaRecorder.start(100)
      setIsRecording(true)

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
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.warn('Speech recognition:', event.error)
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recording failed'
      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        setError('Microphone permission denied. Allow access in your browser settings.')
      } else if (msg.includes('NotFound') || msg.includes('not found')) {
        setError('No microphone found')
      } else {
        setError(msg || 'Could not start recording')
      }
      console.error('Error starting recording:', err)
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
        const mime = mediaRecorder?.mimeType || getAudioMimeType() || 'audio/webm'
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mime || 'audio/webm' })
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

  return { isRecording, startRecording, stopRecording, error, clearError }
}
