import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

// Web Speech API types
interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList
  error?: string
}
interface ISpeechRecognitionResultList {
  length: number
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } }
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

type ListenState = 'idle' | 'listening' | 'processing'

export default function VoiceSearchScreen() {
  const navigate = useNavigate()
  const [listenState, setListenState] = useState<ListenState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  // Auto-start listening on mount
  useEffect(() => {
    startListening()
    return () => recognitionRef.current?.abort()
  }, [])

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Voice search is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setListenState('listening')
      setTranscript('')
      setError('')
    }

    recognition.onresult = (event) => {
      const results = event.results
      let current = ''
      for (let i = 0; i < results.length; i++) {
        current += results[i][0].transcript
      }
      setTranscript(current)

      if (results[results.length - 1].isFinal) {
        setListenState('processing')
        handleVoiceQuery(current)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Tap the mic to try again.')
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow mic permission.')
      } else {
        setError(`Error: ${event.error}`)
      }
      setListenState('idle')
    }

    recognition.onend = () => {
      if (listenState === 'listening') setListenState('idle')
    }

    recognition.start()
  }

  function handleVoiceQuery(query: string) {
    const lower = query.toLowerCase()

    // Semantic understanding
    let filter = ''
    if (lower.includes('sushi') || lower.includes('japanese')) filter = 'Japanese'
    else if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('quick')) filter = 'Coffee'
    else if (lower.includes('jazz')) filter = 'Jazz'
    else if (lower.includes('music') || lower.includes('dj') || lower.includes('club')) filter = 'Music'
    else if (lower.includes('dinner') || lower.includes('romantic') || lower.includes('italian')) filter = 'Italian'
    else if (lower.includes('american') || lower.includes('burger')) filter = 'American'

    setTimeout(() => {
      navigate('/list', { state: { voiceQuery: query, filter } })
    }, 800)
  }

  function handleMicClick() {
    if (listenState === 'listening') {
      recognitionRef.current?.stop()
      setListenState('idle')
    } else {
      startListening()
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-between"
      style={{ background: 'rgba(7, 17, 38, 0.97)', backdropFilter: 'blur(12px)' }}
    >
      {/* Close button */}
      <div className="w-full flex justify-end pt-14 pr-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center rounded-full w-10 h-10 transition-opacity opacity-70 hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#FAFBFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center gap-8 flex-1 justify-center px-8">
        {/* Animated mic button */}
        <div className="relative flex items-center justify-center">
          {/* Pulse rings — only when listening */}
          {listenState === 'listening' && (
            <>
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 90 + i * 36,
                    height: 90 + i * 36,
                    border: '1.5px solid rgba(69, 118, 239, 0.4)',
                  }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </>
          )}

          {/* Processing spinner ring */}
          {listenState === 'processing' && (
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 110,
                height: 110,
                border: '2px solid transparent',
                borderTopColor: '#4576EF',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Mic circle */}
          <motion.button
            onClick={handleMicClick}
            whileTap={{ scale: 0.93 }}
            animate={
              listenState === 'listening'
                ? { scale: [1, 1.05, 1] }
                : { scale: 1 }
            }
            transition={
              listenState === 'listening'
                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
            className="relative z-10 flex items-center justify-center rounded-full"
            style={{
              width: 90,
              height: 90,
              background:
                listenState === 'listening'
                  ? 'linear-gradient(135deg, #4576EF 0%, #2a56d4 100%)'
                  : listenState === 'processing'
                  ? 'linear-gradient(135deg, #2a56d4 0%, #1a3a8f 100%)'
                  : 'rgba(69, 118, 239, 0.2)',
              boxShadow:
                listenState === 'listening'
                  ? '0 0 40px rgba(69, 118, 239, 0.6)'
                  : '0 0 20px rgba(69, 118, 239, 0.2)',
              border: '2px solid rgba(69, 118, 239, 0.5)',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="11" rx="3" fill="white" />
              <path
                d="M5 10a7 7 0 0014 0"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>

        {/* Status text */}
        <AnimatePresence mode="wait">
          {listenState === 'listening' && (
            <motion.p
              key="listening"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-lg font-semibold tracking-wide"
              style={{ fontFamily: 'Open Sans, sans-serif', color: '#4576EF' }}
            >
              Listening...
            </motion.p>
          )}
          {listenState === 'processing' && (
            <motion.p
              key="processing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-lg font-semibold tracking-wide"
              style={{ fontFamily: 'Open Sans, sans-serif', color: '#FAFBFF' }}
            >
              Finding results...
            </motion.p>
          )}
          {listenState === 'idle' && !error && (
            <motion.p
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-base opacity-50"
              style={{ fontFamily: 'Open Sans, sans-serif', color: '#FAFBFF' }}
            >
              Tap the mic to start
            </motion.p>
          )}
        </AnimatePresence>

        {/* Transcript display */}
        <AnimatePresence>
          {transcript ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full rounded-2xl px-5 py-4 text-center"
              style={{
                background: 'rgba(69, 118, 239, 0.1)',
                border: '1px solid rgba(69, 118, 239, 0.25)',
              }}
            >
              <p
                className="text-base"
                style={{ fontFamily: 'Open Sans, sans-serif', color: '#FAFBFF' }}
              >
                {transcript || 'Start speaking...'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full rounded-2xl px-5 py-4 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p
                className="text-sm opacity-40"
                style={{ fontFamily: 'Open Sans, sans-serif', color: '#FAFBFF' }}
              >
                Start speaking...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-center px-4"
            style={{ color: '#f87171', fontFamily: 'Open Sans, sans-serif' }}
          >
            {error}
          </motion.p>
        )}

        {/* Suggestion hints */}
        {listenState === 'idle' && !transcript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-2 mt-2"
          >
            <p className="text-xs opacity-30 mb-1" style={{ color: '#FAFBFF', fontFamily: 'Open Sans' }}>
              Try saying
            </p>
            {['"best sushi near me"', '"dinner for two"', '"jazz bar tonight"'].map((hint) => (
              <p
                key={hint}
                className="text-sm opacity-50 italic"
                style={{ color: '#FAFBFF', fontFamily: 'Open Sans, sans-serif' }}
              >
                {hint}
              </p>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bottom: skip link */}
      <div className="pb-14">
        <button
          onClick={() => navigate('/map')}
          className="text-sm underline underline-offset-4 opacity-40 hover:opacity-70 transition-opacity"
          style={{ fontFamily: 'Open Sans, sans-serif', color: '#FAFBFF' }}
        >
          Skip to Discovery Map
        </button>
      </div>
    </div>
  )
}
