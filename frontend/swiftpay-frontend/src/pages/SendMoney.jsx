import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import * as api from '../services/api'

function SendMoneyPage({
  step,
  scannedDetails,
  supported,
  onBack,
  onRescan,
  onPaymentMethodSelect,
  user,
  profile,
  onTransferSuccess,
}) {
  const [fallbackStep, setFallbackStep] = useState('prompt')
  const [fallbackScannedDetails, setFallbackScannedDetails] = useState(null)
  const [fallbackScannedRaw, setFallbackScannedRaw] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    pin: '',
  })
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [transferResponse, setTransferResponse] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const scanFrameRef = useRef(0)

  const stopScannerStream = useCallback(() => {
    if (scanFrameRef.current) {
      window.cancelAnimationFrame(scanFrameRef.current)
      scanFrameRef.current = 0
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
  }, [])

  const openScanner = async () => {
    setScannerError('')
    setFallbackScannedRaw('')
    setFallbackScannedDetails(null)

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
    stopScannerStream()
    setScannerOpen(false)
  }

  const startDecodeLoop = useCallback(() => {
    const scanFrame = () => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!scannerOpen || !video || !canvas || !streamRef.current) {
        return
      }

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(imageData.data, imageData.width, imageData.height)

          if (result?.data) {
            setFallbackScannedRaw(result.data)

            try {
              const parsed = JSON.parse(result.data)
              setFallbackScannedDetails(parsed)
              setFallbackStep('scanned')
              setScannerError('')
            } catch {
              setFallbackScannedDetails(null)
              setScannerError('Scanned QR payload is not valid JSON')
            }

            stopScannerStream()
            setScannerOpen(false)
            return
          }
        }
      }

      scanFrameRef.current = window.requestAnimationFrame(scanFrame)
    }

    scanFrameRef.current = window.requestAnimationFrame(scanFrame)
  }, [scannerOpen, stopScannerStream])

  const resetFallbackScanner = () => {
    setFallbackStep('camera')
    setFallbackScannedRaw('')
    setFallbackScannedDetails(null)
    setScannerError('')
  }

  const continueFallbackPayment = () => {
    setFallbackStep('payment-method')
  }

  const handleCardInputChange = (e) => {
    const { name, value } = e.target
    setCardData((current) => ({ ...current, [name]: value }))
  }

  const initiateCardPayment = async () => {
    if (!cardData.cardNumber || !cardData.expiryDate || !cardData.cvv || !cardData.pin) {
      setPaymentError('Please enter all card details')
      return
    }

    if (!fallbackScannedDetails || !user?.id) {
      setPaymentError('Missing payment details')
      return
    }

    setPaymentProcessing(true)
    setPaymentError('')

    try {
      const payload = {
        sender_id: Number(user.id),
        receiver_id: fallbackScannedDetails.userId ? Number(fallbackScannedDetails.userId) : 1,
        receiver_account_number: fallbackScannedDetails.accountNumber,
        receiver_bank_code: '000',
        receiver_account_name: fallbackScannedDetails.accountName,
        amount_kobo: Math.round(Number(fallbackScannedDetails.amount) * 100),
        currency: 'NGN',
        card_pan: cardData.cardNumber.replace(/\s/g, ''),
        card_pin: cardData.pin,
        card_expiry: cardData.expiryDate.replace('/', ''),
        card_cvv2: cardData.cvv,
      }

      const response = await api.initiateTransfer(payload)
      setTransferResponse(response)
      setFallbackStep('success')
      setPaymentProcessing(false)

      if (onTransferSuccess) {
        onTransferSuccess(response)
      }
    } catch (error) {
      setPaymentError(error.message || 'Payment failed. Please try again.')
      setPaymentProcessing(false)
    }
  }

  const completeFallbackPayment = (method) => {
    if (method === 'bank-card') {
      setFallbackStep('payment-card-form')
    } else if (method === 'swift-money') {
      setFallbackStep('success')
    }
  }

  useEffect(() => {
    if (!scannerOpen || !videoRef.current || !streamRef.current) {
      return
    }

    videoRef.current.srcObject = streamRef.current
    videoRef.current
      .play()
      .then(() => startDecodeLoop())
      .catch(() => setScannerError('Unable to start camera preview'))
  }, [scannerOpen, startDecodeLoop])

  useEffect(() => {
    return () => {
      stopScannerStream()
    }
  }, [stopScannerStream])

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
              <canvas ref={canvasRef} className="scanner-canvas-hidden" aria-hidden="true" />
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

      {!supported && fallbackStep === 'scanned' && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Payment Details</h2>

          {fallbackScannedDetails ? (
            <div className="payment-details">
              <div className="detail-field">
                <label className="detail-label">Account Name</label>
                <p className="detail-value">{fallbackScannedDetails.accountName || 'N/A'}</p>
              </div>
              <div className="detail-field">
                <label className="detail-label">Account Number</label>
                <p className="detail-value">{fallbackScannedDetails.accountNumber || 'N/A'}</p>
              </div>
              <div className="detail-field">
                <label className="detail-label">Bank</label>
                <p className="detail-value">{fallbackScannedDetails.bankName || 'N/A'}</p>
              </div>
              {fallbackScannedDetails.amount && (
                <div className="detail-field">
                  <label className="detail-label">Amount</label>
                  <p className="detail-value amount">₦{fallbackScannedDetails.amount}</p>
                </div>
              )}
            </div>
          ) : (
            <article className="scan-result">
              <p className="scan-result-title">Scan result</p>
              <pre className="scan-result-pre">{fallbackScannedRaw || 'No QR payload found.'}</pre>
            </article>
          )}

          {fallbackScannedDetails && (
            <button type="button" className="action-btn action-primary" onClick={continueFallbackPayment}>
              Continue to Payment
            </button>
          )}
          <button type="button" className="action-btn action-secondary" onClick={resetFallbackScanner}>
            Scan Again
          </button>
        </article>
      )}

      {!supported && fallbackStep === 'payment-method' && fallbackScannedDetails && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Choose Payment Method</h2>
          <div className="payment-details">
            <p className="detail-field">
              <span className="detail-label">Paying to:</span>
              <span className="detail-value">{fallbackScannedDetails.accountName || 'N/A'}</span>
            </p>
            <p className="detail-field amount-preview">
              Amount: <strong>₦{fallbackScannedDetails.amount || '0.00'}</strong>
            </p>
          </div>

          <div className="payment-methods">
            <button
              type="button"
              className="payment-method-btn"
              onClick={() => completeFallbackPayment('bank-card')}
              disabled={paymentProcessing}
            >
              <span className="method-icon">💳</span>
              <span className="method-name">Pay With Bank Card</span>
            </button>
            <button
              type="button"
              className="payment-method-btn"
              onClick={() => completeFallbackPayment('swift-money')}
              disabled={paymentProcessing}
            >
              <span className="method-icon">⚡</span>
              <span className="method-name">Pay With Swift Money</span>
            </button>
          </div>

          <button
            type="button"
            className="action-btn action-secondary"
            onClick={resetFallbackScanner}
          >
            Cancel
          </button>
        </article>
      )}

      {!supported && fallbackStep === 'payment-card-form' && fallbackScannedDetails && (
        <article className="request-card glass-card reveal delay-1">
          <h2>Card Payment</h2>
          <div className="payment-details">
            <p className="detail-field">
              <span className="detail-label">Paying to:</span>
              <span className="detail-value">{fallbackScannedDetails.accountName || 'N/A'}</span>
            </p>
            <p className="detail-field amount-preview">
              Amount: <strong>₦{fallbackScannedDetails.amount || '0.00'}</strong>
            </p>
          </div>

          {paymentError && (
            <p style={{ color: '#ff9dac', fontSize: '14px', marginBottom: '12px' }}>
              {paymentError}
            </p>
          )}

          <form
            style={{ display: 'grid', gap: '12px' }}
            onSubmit={(e) => {
              e.preventDefault()
              initiateCardPayment()
            }}
          >
            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', color: '#c7b8e5' }}>
              Card Number
              <input
                type="text"
                name="cardNumber"
                value={cardData.cardNumber}
                onChange={handleCardInputChange}
                placeholder="1234 5678 9012 3456"
                maxLength="19"
                required
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', color: '#c7b8e5' }}>
                Expiry (MM/YY)
                <input
                  type="text"
                  name="expiryDate"
                  value={cardData.expiryDate}
                  onChange={handleCardInputChange}
                  placeholder="12/25"
                  maxLength="5"
                  required
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', color: '#c7b8e5' }}>
                CVV
                <input
                  type="text"
                  name="cvv"
                  value={cardData.cvv}
                  onChange={handleCardInputChange}
                  placeholder="123"
                  maxLength="4"
                  required
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', color: '#c7b8e5' }}>
              PIN
              <input
                type="password"
                name="pin"
                value={cardData.pin}
                onChange={handleCardInputChange}
                placeholder="••••"
                maxLength="4"
                required
              />
            </label>

            <button
              type="submit"
              className="action-btn action-primary"
              disabled={paymentProcessing}
            >
              {paymentProcessing ? 'Processing...' : 'Pay Now'}
            </button>
          </form>

          <button
            type="button"
            className="action-btn action-secondary"
            onClick={() => setFallbackStep('payment-method')}
            disabled={paymentProcessing}
          >
            Back
          </button>
        </article>
      )}

      {!supported && fallbackStep === 'success' && fallbackScannedDetails && (
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
            <p className="recipient-name">{fallbackScannedDetails.accountName || 'Recipient'}</p>
            <p className="sent-amount">₦{fallbackScannedDetails.amount || '0.00'}</p>
          </div>
          <button type="button" className="action-btn action-primary" onClick={onBack}>
            Back To Home
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
