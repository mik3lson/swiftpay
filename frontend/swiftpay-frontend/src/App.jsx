import { useMemo, useState } from 'react'
import './App.css'
import BottomNav from './components/BottomNav'
import ToastStack from './components/ToastStack'
import { useNFC } from './hooks/useNFC'
import Home from './pages/Home'
import Profile from './pages/Profile'
import RequestPage from './pages/Request'
import SendMoneyPage from './pages/SendMoney'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [toasts, setToasts] = useState([])
  const [requestFlow, setRequestFlow] = useState({
    open: false,
    step: 'input',
    amount: '',
  })
  const [sendMoneyFlow, setSendMoneyFlow] = useState({
    open: false,
    step: 'scanning',
    scannedDetails: null,
  })
  const [profile, setProfile] = useState(() => {
    try {
      const saved = window.localStorage.getItem('swiftpay_profile')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Default values are used when local storage is unavailable.
    }

    return {
      bankName: 'Swift Bank',
      accountNumber: '0021947362',
      accountName: 'Adaeze Nwosu',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
    }
  })

  const { supported, error, shareBankDetails, receiveBankDetails } = useNFC()

  const user = useMemo(
    () => ({
      id: 'SP-34091',
      username: 'swiftqueen',
    }),
    [],
  )

  const pushToast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, type }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3200)
  }

  const formatExpiryDate = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)

    if (digits.length <= 2) {
      return digits
    }

    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  const handleProfileChange = (event) => {
    const { name, value } = event.target
    const nextValue = name === 'expiryDate' ? formatExpiryDate(value) : value
    setProfile((current) => ({ ...current, [name]: nextValue }))
  }

  const saveProfile = () => {
    window.localStorage.setItem('swiftpay_profile', JSON.stringify(profile))
    pushToast('Details saved locally', 'success')
  }

  const openRequestPage = () => {
    setRequestFlow({
      open: true,
      step: 'input',
      amount: '',
    })
  }

  const closeRequestPage = () => {
    setRequestFlow({
      open: false,
      step: 'input',
      amount: '',
    })
  }

  const buildRequestPayload = (amount) => ({
    type: 'swiftpay_request',
    requestId: `REQ-${Date.now()}`,
    requestedAt: new Date().toISOString(),
    amount: String(amount),
    bankName: profile.bankName,
    accountNumber: profile.accountNumber,
    accountName: profile.accountName,
    userId: user.id,
    username: user.username,
  })

  const sendRequestViaNfc = async (amount) => {
    try {
      await shareBankDetails(buildRequestPayload(amount))
      pushToast('NFC connection successful. Request details sent.', 'success')
      setRequestFlow((current) => ({ ...current, step: 'done' }))
    } catch {
      pushToast('Could not send request via NFC', 'error')
      setRequestFlow((current) => ({ ...current, step: 'input' }))
    }
  }

  const submitRequestAmount = (amount) => {
    setRequestFlow({
      open: true,
      step: 'waiting',
      amount,
    })

    window.setTimeout(() => {
      sendRequestViaNfc(amount)
    }, 80)
  }

  const handleNavChange = (tab) => {
    setActiveTab(tab)

    if (tab === 'home') {
      closeRequestPage()
      closeSendMoneyPage()
    }
  }

  const openSendMoneyPage = () => {
    setSendMoneyFlow({
      open: true,
      step: 'scanning',
      scannedDetails: null,
    })
    scanForSendMoney()
  }

  const closeSendMoneyPage = () => {
    setSendMoneyFlow({
      open: false,
      step: 'scanning',
      scannedDetails: null,
    })
  }

  const rescanSendMoney = () => {
    setSendMoneyFlow({
      open: true,
      step: 'scanning',
      scannedDetails: null,
    })
    scanForSendMoney()
  }

  const scanForSendMoney = async () => {
    try {
      const details = await receiveBankDetails()

      if (
        details?.type !== 'swiftpay_request'
        || !details?.accountName
        || !details?.accountNumber
        || !details?.amount
      ) {
        throw new Error('Received NFC data is not a valid payment request')
      }

      setSendMoneyFlow((current) => ({
        ...current,
        step: 'scanned',
        scannedDetails: details,
      }))
      pushToast('NFC connection successful. Payment details received.', 'success')
    } catch {
      pushToast('Could not read payment details from device', 'error')
      setSendMoneyFlow((current) => ({
        ...current,
        step: 'scanning',
      }))
    }
  }

  const completePayment = async (paymentMethod) => {
    try {
      if (paymentMethod === 'continue') {
        // Transition from scanned to payment-method
        setSendMoneyFlow((current) => ({
          ...current,
          step: 'payment-method',
        }))
        return
      }

      // Process payment with selected method and show success
      setSendMoneyFlow((current) => ({
        ...current,
        step: 'success',
      }))
      pushToast(`Payment successful with ${paymentMethod === 'bank-card' ? 'Bank Card' : 'Swift Money'}`, 'success')
    } catch {
      pushToast('Payment failed. Please try again.', 'error')
      setSendMoneyFlow((current) => ({
        ...current,
        step: 'payment-method',
      }))
    }
  }

  const renderPage = () => {
    if (activeTab === 'profile') {
      return (
        <Profile
          profile={profile}
          onChange={handleProfileChange}
          onSave={saveProfile}
        />
      )
    }

    if (activeTab === 'search' || activeTab === 'cards') {
      return (
        <section className="page placeholder-page">
          <div className="glass-card reveal">
            <p className="eyebrow">Coming soon</p>
            <h1>{activeTab === 'search' ? 'Search' : 'Cards'}</h1>
            <p className="muted">
              This section is reserved for future Swift Pay features.
            </p>
          </div>
        </section>
      )
    }

    if (requestFlow.open) {
      return (
        <RequestPage
          step={requestFlow.step}
          amount={requestFlow.amount}
          supported={supported}
          requestDetails={{
            bankName: profile.bankName,
            accountNumber: profile.accountNumber,
            accountName: profile.accountName,
            userId: user.id,
            username: user.username,
          }}
          onSubmitAmount={submitRequestAmount}
          onBack={closeRequestPage}
        />
      )
    }

    if (sendMoneyFlow.open) {
      return (
        <SendMoneyPage
          step={sendMoneyFlow.step}
          scannedDetails={sendMoneyFlow.scannedDetails}
          supported={supported}
          onBack={closeSendMoneyPage}
          onRescan={rescanSendMoney}
          onPaymentMethodSelect={completePayment}
        />
      )
    }

    return (
      <Home
        user={user}
        onOpenRequest={openRequestPage}
        onOpenSendMoney={openSendMoneyPage}
      />
    )
  }

  return (
    <div className="app-shell">
      {renderPage()}
      <BottomNav activeTab={activeTab} onChange={handleNavChange} />
      <ToastStack toasts={toasts} />
      {error && <p className="sr-only">{error}</p>}
    </div>
  )
}

export default App
