import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import * as api from '../services/api'

function Home({
  user,
  onOpenRequest,
  onOpenSendMoney,
  onNavigateToProfile,
}) {
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [scannedRaw, setScannedRaw] = useState('')
  const [scannedJson, setScannedJson] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [_transactionsLoading, setTransactionsLoading] = useState(true)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const scanFrameRef = useRef(0)

  useEffect(() => {
    // Fetch transactions from backend
    const fetchTransactions = async () => {
      try {
        const token = window.localStorage.getItem('swiftpay_token')
        const response = await api.getTransactions(user.id, token)

        const records = Array.isArray(response)
          ? response
          : Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.transactions)
              ? response.transactions
              : []

        const normalized = records.map((transaction) => {
          const amountValue = Number(transaction.amount || 0)
          const senderUserId = String(transaction.sender_user_id || transaction.sender_user || '')
          const isCredit = senderUserId && senderUserId !== String(user.id)
          const amountPrefix = isCredit ? '+' : '-'
          const dateLabel = transaction.timestamp
            ? new Date(transaction.timestamp).toLocaleString()
            : 'Recent'

          return {
            id: transaction.transaction_id || transaction.id || `${Date.now()}-${Math.random()}`,
            title: transaction.description || (isCredit ? 'Transfer Received' : 'Transfer Sent'),
            date: dateLabel,
            amount: `${amountPrefix}₦${amountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            type: isCredit ? 'credit' : 'debit',
          }
        })

        setTransactions(normalized)
        setTransactionsLoading(false)
      } catch {
        // Fallback to empty transactions if API fails
        setTransactions([])
        setTransactionsLoading(false)
      }
    }

    if (user?.id) {
      fetchTransactions()
    }
  }, [user?.id])

  const openScanner = async () => {
    setScannerError('')
    setScannedRaw('')
    setScannedJson(null)

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
            setScannedRaw(result.data)
            try {
              setScannedJson(JSON.parse(result.data))
              setScannerError('')
            } catch {
              setScannedJson(null)
            }

            stopScannerStream()
            return
          }
        }
      }

      scanFrameRef.current = window.requestAnimationFrame(scanFrame)
    }

    scanFrameRef.current = window.requestAnimationFrame(scanFrame)
  }, [scannerOpen, stopScannerStream])

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
    <section className="page home-page margin-bottom=large">
      <header className="app-header reveal">
        <div className="brand-row">
          <button
            type="button"
            className="scan-trigger"
            aria-label="Open scanner"
            onClick={openScanner}
          >
            <svg
              fill="#ffffff"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="scan-icon"
            >
              <path d="M4,4h6v6H4V4M20,4v6H14V4h6M14,15h2V13H14V11h2v2h2V11h2v2H18v2h2v3H18v2H16V18H13v2H11V16h3V15m2,0v3h2V15H16M4,20V14h6v6H4M6,6V8H8V6H6M16,6V8h2V6H16M6,16v2H8V16H6M4,11H6v2H4V11m5,0h4v4H11V13H9V11m2-5h2v4H11V6M2,2V6H0V2A2,2,0,0,1,2,0H6V2H2M22,0a2,2,0,0,1,2,2V6H22V2H18V0h4M2,18v4H6v2H2a2,2,0,0,1-2-2V18H2m20,4V18h2v4a2,2,0,0,1-2,2H18V22Z" />
            </svg>
          </button>
          <div className="brand-title">swift Pay</div>
          <button
            type="button"
            className="scan-trigger"
            aria-label="Open profile"
            onClick={onNavigateToProfile}
          >
            <svg
              fill="#ffffff"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="scan-icon"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        </div>
        <div className="brand-subtitle">tap & pay</div>
       {/*
          <div className="header-username">@{user.username}</div>
        {*/}
      </header>

      {scannerOpen && (
        <section className="scanner-sheet glass-card reveal delay-1" aria-label="Camera scanner">
          <div className="scanner-sheet-header">
            <h3>Scan</h3>
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

          {!scannedRaw && <p className="muted">Point your camera at a QR code to scan.</p>}

          {scannedRaw && (
            <article className="scan-result">
              <p className="scan-result-title">Scan result</p>
              {scannedJson ? (
                <pre className="scan-result-pre">{JSON.stringify(scannedJson, null, 2)}</pre>
              ) : (
                <pre className="scan-result-pre">{scannedRaw}</pre>
              )}
              <button type="button" className="action-btn action-secondary" onClick={openScanner}>
                Scan Again
              </button>
            </article>
          )}
        </section>
      )}

      <article className="balance-card glass-card reveal delay-1 margin-top" aria-label="Swift Monie balance">
        <p className="label">Swift Monie balance</p>
        <div className="balance-display">
          <h2>{balanceVisible ? '₦0.00' : '••••'}</h2>
          <button
            type="button"
            className="eye-toggle"
            onClick={() => setBalanceVisible(!balanceVisible)}
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            {balanceVisible ? (
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="eye-icon">
                <path d="M8 2C4.5 2 1.5 4.5 0 8c1.5 3.5 4.5 6 8 6s6.5-2.5 8-6c-1.5-3.5-4.5-6-8-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" fill="#ffffff" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="eye-icon">
                <path fillRule="evenodd" clipRule="evenodd" d="M16 16H13L10.8368 13.3376C9.96488 13.7682 8.99592 14 8 14C6.09909 14 4.29638 13.1557 3.07945 11.6953L0 8L3.07945 4.30466C3.14989 4.22013 3.22229 4.13767 3.29656 4.05731L0 0H3L16 16ZM5.35254 6.58774C5.12755 7.00862 5 7.48941 5 8C5 9.65685 6.34315 11 8 11C8.29178 11 8.57383 10.9583 8.84053 10.8807L5.35254 6.58774Z" fill="#ffffff" />
                <path d="M16 8L14.2278 10.1266L7.63351 2.01048C7.75518 2.00351 7.87739 2 8 2C9.90091 2 11.7036 2.84434 12.9206 4.30466L16 8Z" fill="#ffffff" />
              </svg>
            )}
          </button>
        </div>
        <div className="balance-row">
          <span>Ledger balance</span>
          <strong>{balanceVisible ? '₦0.00' : '•••'}</strong>
        </div>
        <div className="account-meta">
          <p>
            username <span>@{user.username}</span>
          </p>
        </div>
      </article>

      <section className="actions-grid reveal delay-2" aria-label="Primary actions">
        <button type="button" className="action-btn action-secondary" onClick={onOpenRequest}>
          Request
        </button>
        <button type="button" className="action-btn action-secondary" onClick={onOpenSendMoney}>
          Send Money
        </button>
      </section>
  {/*
      <section className="quick-actions glass-card reveal delay-3">
        <button type="button" className="quick-btn">
          Bills & Apps
        </button>
        <button type="button" className="quick-btn">
          View Requests
        </button>
      </section>
  */}
      <section className="transactions-panel glass-card reveal delay-3">
        <div className="transactions-heading">
          <h3>Transactions</h3>
          <p className="transactions-caption">Recent activity</p>
        </div>

        <div className="transactions-list">
          {transactions.length === 0 ? (
            <article className="transaction-item">
              <div className="transaction-info">
                <p className="transaction-title">No transactions yet</p>
                <p className="transaction-date">Your recent activity will appear here.</p>
              </div>
            </article>
          ) : (
            transactions.map((transaction) => (
              <article key={transaction.id} className="transaction-item">
                <div className="transaction-info">
                  <p className="transaction-title">{transaction.title}</p>
                  <p className="transaction-date">{transaction.date}</p>
                </div>
                <p
                  className={`transaction-amount ${
                    transaction.type === 'credit' ? 'transaction-credit' : 'transaction-debit'
                  }`}
                >
                  {transaction.amount}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  )
}

export default Home
