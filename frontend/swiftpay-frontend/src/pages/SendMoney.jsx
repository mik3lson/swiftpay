import { useEffect, useRef, useState } from 'react'

function SendMoneyPage({
  step,
  scannedDetails,
  supported,
  onBack,
  onRescan,
  onPaymentMethodSelect,
}) {
  const [fallbackStep, setFallbackStep] = useState('prompt')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const openScanner = async () => {
    setScannerError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Camera access is not supported on this device')
      setScannerOpen(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setScannerOpen(true)
    } catch {
      setScannerError('Unable to access camera. Please allow permission and try again.')
      setScannerOpen(true)
    }
  }

  const closeScanner = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    setScannerOpen(false)
  }

  useEffect(() => {
    if (!scannerOpen || !videoRef.current || !streamRef.current) {
      return
    }

    videoRef.current.srcObject = streamRef.current
    videoRef.current
      .play()
      .catch(() => setScannerError('Unable to start camera preview'))
  }, [scannerOpen])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop()
        }
      }
    }
  }, [])

  return (
    <section className="page send-money-page">
      <header className="request-header reveal">
        <button type="button" className="request-back" onClick={onBack}>
          Back
        </button>
        <p className="eyebrow">Send Money</p>
      </header>

      {!supported && fallbackStep === 'prompt' && (
        <article className="request-card glass-card reveal delay-1">
          <p className="unsupported">Web NFC is not supported on this device</p>
          <p className="muted">Scan a QR code to send money instead?</p>
          <button
            type="button"
            className="action-btn action-secondary"
            onClick={() => setFallbackStep('camera')}
          >
            Scan QR Code
          </button>
        </article>
      )}

      {!supported && fallbackStep === 'camera' && scannerOpen && (
        <section className="scanner-sheet glass-card reveal delay-1" aria-label="Camera scanner">
          <div className="scanner-sheet-header">
            <h3>Scan QR Code</h3>
            <button type="button" className="request-back" onClick={closeScanner}>
              Close
            </button>
          </div>
          {scannerError ? (
            <p className="unsupported">{scannerError}</p>
          ) : (
            <div className="scanner-frame">
              <video ref={videoRef} className="scanner-video" playsInline muted />
            </div>
          )}
          <p className="muted">Point your camera at a QR code to scan.</p>
        </section>
      )}

      {!supported && fallbackStep === 'camera' && !scannerOpen && (
        <article className="request-card glass-card reveal delay-1">
          <button
            type="button"
            className="action-btn action-primary"
            onClick={openScanner}
          >
            Open Camera
          </button>
          <button
            type="button"
            className="action-btn action-secondary"
            onClick={() => setFallbackStep('prompt')}
          >
            Back
          </button>
        </article>
      )}

      {supported && step === 'scanning' && (
        <article className="request-card glass-card reveal delay-1">
          <div className="signal-wrap" aria-hidden="true">
            <span className="signal-ring signal-ring-1" />
            <span className="signal-ring signal-ring-2" />
            <span className="signal-ring signal-ring-3" />
            <span className="signal-core" />
          </div>
          <h2>Scan Device</h2>
          <p className="muted">Tap a device to read payment details</p>
        </article>
      )}

      {supported && step === 'scanned' && scannedDetails && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Payment Details</h2>
          <div className="payment-details">
            <div className="detail-field">
              <label className="detail-label">Account Name</label>
              <p className="detail-value">{scannedDetails.accountName}</p>
            </div>
            <div className="detail-field">
              <label className="detail-label">Account Number</label>
              <p className="detail-value">{scannedDetails.accountNumber}</p>
            </div>
            <div className="detail-field">
              <label className="detail-label">Bank</label>
              <p className="detail-value">{scannedDetails.bankName}</p>
            </div>
            {scannedDetails.amount && (
              <div className="detail-field">
                <label className="detail-label">Amount</label>
                <p className="detail-value amount">₦{scannedDetails.amount}</p>
              </div>
            )}
          </div>
          <button type="button" className="action-btn action-primary" onClick={() => onPaymentMethodSelect('continue')}>
            Continue to Payment
          </button>
          <button
            type="button"
            className="action-btn action-secondary"
            onClick={onRescan}
          >
            Scan Again
          </button>
        </article>
      )}

      {supported && step === 'payment-method' && scannedDetails && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Choose Payment Method</h2>
          <div className="payment-details">
            <p className="detail-field">
              <span className="detail-label">Paying to:</span>
              <span className="detail-value">{scannedDetails.accountName}</span>
            </p>
            <p className="detail-field amount-preview">
              Amount: <strong>₦{scannedDetails.amount}</strong>
            </p>
          </div>

          <div className="payment-methods">
            <button
              type="button"
              className="payment-method-btn"
              onClick={() => onPaymentMethodSelect('bank-card')}
            >
              <span className="method-icon">💳</span>
              <span className="method-name">Pay With Bank Card</span>
            </button>
            <button
              type="button"
              className="payment-method-btn"
              onClick={() => onPaymentMethodSelect('swift-money')}
            >
              <span className="method-icon">⚡</span>
              <span className="method-name">Pay With Swift Money</span>
            </button>
          </div>

          <button
            type="button"
            className="action-btn action-secondary"
            onClick={onRescan}
          >
            Cancel
          </button>
        </article>
      )}

      {supported && step === 'success' && scannedDetails && (
        <article className="request-card glass-card reveal delay-1">
          <div className="success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path
                d="M7 12.5L10 15.5L17 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2>Money Sent!</h2>
          <div className="success-details">
            <p className="muted">Successfully sent to</p>
            <p className="recipient-name">{scannedDetails.accountName}</p>
            <p className="sent-amount">₦{scannedDetails.amount}</p>
          </div>
          <button type="button" className="action-btn action-primary" onClick={onBack}>
            Back To Home
          </button>
        </article>
      )}
    </section>
  )
}

export default SendMoneyPage
