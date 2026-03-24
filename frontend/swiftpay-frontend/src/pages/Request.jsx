import { useState } from 'react'

function normalizeAmount(value) {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')

  if (parts.length <= 2) {
    return cleaned
  }

  return `${parts[0]}.${parts.slice(1).join('')}`
}

function RequestPage({
  step,
  amount,
  supported,
  requestDetails,
  onSubmitAmount,
  onBack,
}) {
  const [inputAmount, setInputAmount] = useState('')
  const [fallbackStep, setFallbackStep] = useState('prompt')
  const [qrAmount, setQrAmount] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    const trimmed = inputAmount.trim()
    if (!trimmed) {
      return
    }

    onSubmitAmount(trimmed)
  }

  const handleQrSubmit = (event) => {
    event.preventDefault()

    const trimmed = inputAmount.trim()
    if (!trimmed) {
      return
    }

    setQrAmount(trimmed)
    setFallbackStep('qr')
  }

  const qrPayload = encodeURIComponent(
    JSON.stringify({
      type: 'swiftpay_request',
      amount: qrAmount,
      ...requestDetails,
    }),
  )
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${qrPayload}`

  return (
    <section className="page request-page">
      <header className="request-header reveal">
        <button type="button" className="request-back" onClick={onBack}>
          Back
        </button>
        <p className="eyebrow">Request Payment</p>
      </header>

      {!supported && fallbackStep === 'prompt' && (
        <article className="request-card glass-card reveal delay-1">
          <p className="unsupported">Web NFC is not supported on this device</p>
          <p className="muted">Request with QR code instead?</p>
          <button
            type="button"
            className="action-btn action-secondary"
            onClick={() => {
              setInputAmount('')
              setFallbackStep('input')
            }}
          >
            Request With QR Code
          </button>
        </article>
      )}

      {!supported && fallbackStep === 'input' && (
        <form className="request-card glass-card reveal delay-1" onSubmit={handleQrSubmit}>
          <h2>Enter Amount</h2>
          <label className="request-label" htmlFor="request-amount-qr">
            Amount
          </label>
          <input
            id="request-amount-qr"
            className="request-amount-input"
            inputMode="decimal"
            placeholder="e.g. 5000"
            value={inputAmount}
            onChange={(event) => setInputAmount(normalizeAmount(event.target.value))}
            autoFocus
          />
          <p className="request-help">Press Enter to generate QR code</p>
        </form>
      )}

      {!supported && fallbackStep === 'qr' && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Scan To Receive</h2>
          <img className="qr-image" src={qrUrl} alt="Payment request QR code" />
          <p className="request-amount-preview">Amount: ₦{qrAmount}</p>
          <p className="qr-note">Share this QR code for payment request details.</p>
          <button
            type="button"
            className="action-btn action-secondary"
            onClick={() => {
              setInputAmount('')
              setFallbackStep('input')
            }}
          >
            Change Amount
          </button>
        </article>
      )}

      {supported && step === 'input' && (
        <form className="request-card glass-card reveal delay-1" onSubmit={handleSubmit}>
          <h2>Enter Amount</h2>
          <label className="request-label" htmlFor="request-amount">
            Amount
          </label>
          <input
            id="request-amount"
            className="request-amount-input"
            inputMode="decimal"
            placeholder="e.g. 5000"
            value={inputAmount}
            onChange={(event) => setInputAmount(normalizeAmount(event.target.value))}
            autoFocus
          />
          <p className="request-help">Press Enter to continue</p>
        </form>
      )}

      {supported && step === 'waiting' && (
        <article className="request-card glass-card reveal delay-1">
          <div className="signal-wrap" aria-hidden="true">
            <span className="signal-ring signal-ring-1" />
            <span className="signal-ring signal-ring-2" />
            <span className="signal-ring signal-ring-3" />
            <span className="signal-core" />
          </div>
          <h2>Waiting For Device</h2>
          <p className="muted">Tap a device to send request</p>
          <p className="request-amount-preview">Amount: ₦{amount}</p>
        </article>
      )}

      {supported && step === 'done' && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Sent Successfully</h2>
          <p className="muted">NFC connection successful. Your request has been shared.</p>
          <p className="request-amount-preview">Amount: ₦{amount}</p>
          <button type="button" className="action-btn action-primary" onClick={onBack}>
            Back To Home
          </button>
        </article>
      )}
    </section>
  )
}

export default RequestPage
