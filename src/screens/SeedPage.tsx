import { useState } from 'react'
import { seedRealRestaurants } from '../lib/seedRestaurants'

export default function SeedPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null)
  const [log, setLog] = useState<string[]>([])

  async function runSeed() {
    setStatus('running')
    setLog(['🚀 Starting seed...'])

    try {
      // Intercept console.log to show in UI
      const originalLog = console.log
      console.log = (...args) => {
        originalLog(...args)
        setLog(prev => [...prev, args.join(' ')])
      }

      const res = await seedRealRestaurants()
      console.log = originalLog

      setResult(res)
      setStatus(res.errors.length > 0 ? 'error' : 'done')
    } catch (err) {
      setLog(prev => [...prev, `❌ ${err}`])
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070d1f',
      color: '#fff',
      fontFamily: 'Manrope, sans-serif',
      padding: '40px 24px',
    }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        🍽️ Restaurant Data Seed
      </h1>
      <p style={{ opacity: 0.5, fontSize: 14, marginBottom: 32 }}>
        Pulls real LA/OC restaurants from Google Places and adds them to Supabase.
        Safe to run multiple times — skips duplicates automatically.
      </p>

      {status === 'idle' && (
        <button
          onClick={runSeed}
          style={{
            background: '#0048f9',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Run Seed Now
        </button>
      )}

      {status === 'running' && (
        <div style={{ opacity: 0.7, fontSize: 14 }}>⏳ Running... this takes ~30 seconds</div>
      )}

      {(status === 'done' || status === 'error') && result && (
        <div style={{
          background: status === 'done' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${status === 'done' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {status === 'done' ? '✅ Seed Complete!' : '⚠️ Seed finished with errors'}
          </p>
          <p>Added: <strong>{result.added}</strong> restaurants</p>
          <p>Skipped: <strong>{result.skipped}</strong> (already existed)</p>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ color: '#f87171' }}>Errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} style={{ fontSize: 12, opacity: 0.7 }}>{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: 16,
              background: '#0048f9',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to App →
          </button>
        </div>
      )}

      {/* Live log */}
      {log.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 16,
          marginTop: 24,
          fontFamily: 'monospace',
          fontSize: 12,
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          {log.map((line, i) => (
            <div key={i} style={{ marginBottom: 4, opacity: 0.8 }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
