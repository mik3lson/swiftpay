import { useState } from 'react'
import './App.css'
import BottomNav from './components/BottomNav'
import ToastStack from './components/ToastStack'
import { useNFC } from './hooks/useNFC'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import RequestPage from './pages/Request'
import SendMoneyPage from './pages/SendMoney'
import Signup from './pages/Signup'

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return window.localStorage.getItem('swiftpay_session') === 'active'
    } catch {
      return false
    }
  })
  const [activeTab, setActiveTab] = useState('home')
  const [toasts, setToasts] = useState([])
  const [requestFlow, setRequestFlow] = useState({
    open: false,
    step: 'input',
    amount: '',
  })
  const [requestNfcSupported, setRequestNfcSupported] = useState(false)
  const [sendMoneyFlow, setSendMoneyFlow] = useState({
    open: false,
    step: 'scanning',
    scannedDetails: null,
  })
  const [sendMoneyNfcSupported, setSendMoneyNfcSupported] = useState(false)
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

  const [user, setUser] = useState(() => {
    try {
      const savedAuth = window.localStorage.getItem('swiftpay_auth_user')
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth)
        return {
          id: parsed.id || 'SP-34091',
          username: parsed.username || 'swiftqueen',
        }
      }
    } catch {
      // Fallback values are used when local storage is unavailable.
    }

    return {
      id: 'SP-34091',
      username: 'swiftqueen',
    }
  })

  const [accountMeta, setAccountMeta] = useState(() => {
    try {
      const savedAuth = window.localStorage.getItem('swiftpay_auth_user')
      if (savedAuth) {
        return JSON.parse(savedAuth)
      }
    } catch {
      // Empty account metadata is safe when local storage is unavailable.
    }

    return null
  })

  const pushToast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, type }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3200)
  }

  const persistAuthSession = (nextUser) => {
    try {
      window.localStorage.setItem('swiftpay_auth_user', JSON.stringify(nextUser))
      window.localStorage.setItem('swiftpay_session', 'active')
    } catch {
      // Auth can still work for the current tab without persistence.
    }
  }

  const handleSignup = (formData) => {
    const fullName = formData.fullName.trim()
    const email = formData.email.trim().toLowerCase()
    const username = formData.username.trim()

    if (formData.password !== formData.confirmPassword) {
      pushToast('Passwords do not match', 'error')
      return
    }

    if (!fullName || !email || !username) {
      pushToast('Please complete all fields', 'error')
      return
    }

    setAuthBusy(true)
    const nextUser = {
      id: `SP-${Date.now().toString().slice(-5)}`,
      username,
      fullName,
      email,
      password: formData.password,
    }

    persistAuthSession(nextUser)
    setUser({ id: nextUser.id, username: nextUser.username })
    setAccountMeta(nextUser)
    setIsAuthenticated(true)
    setAuthBusy(false)
    setActiveTab('home')
    setProfile((current) => ({
      ...current,
      accountName: current.accountName || fullName,
    }))
    pushToast('Account created successfully', 'success')
  }

  const handleLogin = (formData) => {
    const identifier = formData.identifier.trim().toLowerCase()
    const password = formData.password

    if (!identifier || !password) {
      pushToast('Please enter your login details', 'error')
      return
    }

    let savedUser = null
    try {
      const raw = window.localStorage.getItem('swiftpay_auth_user')
      if (raw) {
        savedUser = JSON.parse(raw)
      }
    } catch {
      // Login continues with in-memory defaults.
    }

    if (!savedUser) {
      pushToast('No account found. Please sign up first.', 'error')
      setAuthMode('signup')
      return
    }

    const matchesIdentifier =
      savedUser.username?.toLowerCase() === identifier
      || savedUser.email?.toLowerCase() === identifier

    if (!matchesIdentifier || savedUser.password !== password) {
      pushToast('Incorrect username/email or password', 'error')
      return
    }

    setAuthBusy(true)
    persistAuthSession(savedUser)
    setUser({ id: savedUser.id || 'SP-34091', username: savedUser.username || 'swiftqueen' })
    setAccountMeta(savedUser)
    setIsAuthenticated(true)
    setAuthBusy(false)
    setActiveTab('home')
    pushToast('Welcome back', 'success')
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthMode('login')
    setActiveTab('home')
    closeRequestPage()
    closeSendMoneyPage()

    try {
      window.localStorage.removeItem('swiftpay_session')
    } catch {
      // Session-only logout still works without local storage.
    }

    pushToast('You have been logged out', 'info')
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
    setRequestNfcSupported(supported)
    setRequestFlow({
      open: true,
      step: 'input',
      amount: '',
    })
  }

  const closeRequestPage = () => {
    setRequestNfcSupported(supported)
    setRequestFlow({
      open: false,
      step: 'input',
      amount: '',
    })
  }

  const isNfcUnavailableError = (transferError) => {
    const message = transferError?.message?.toLowerCase() || ''
    const name = transferError?.name?.toLowerCase() || ''

    return (
      message.includes('not supported')
      || message.includes('ndefreader')
      || message.includes('nfc')
      || name.includes('notsupportederror')
      || name.includes('notallowederror')
      || name.includes('securityerror')
    )
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
    } catch (transferError) {
      if (isNfcUnavailableError(transferError)) {
        setRequestNfcSupported(false)
        setRequestFlow((current) => ({ ...current, step: 'input' }))
        pushToast('NFC unavailable on this device. Use QR request instead.', 'info')
        return
      }

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
    setSendMoneyNfcSupported(supported)
    setSendMoneyFlow({
      open: true,
      step: 'scanning',
      scannedDetails: null,
    })

    if (supported) {
      scanForSendMoney()
    }
  }

  const closeSendMoneyPage = () => {
    setSendMoneyNfcSupported(supported)
    setSendMoneyFlow({
      open: false,
      step: 'scanning',
      scannedDetails: null,
    })
  }

  const rescanSendMoney = () => {
    setSendMoneyNfcSupported(supported)
    setSendMoneyFlow({
      open: true,
      step: 'scanning',
      scannedDetails: null,
    })

    if (supported) {
      scanForSendMoney()
    }
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
    } catch (scanError) {
      if (isNfcUnavailableError(scanError)) {
        setSendMoneyNfcSupported(false)
        setSendMoneyFlow((current) => ({
          ...current,
          step: 'scanning',
        }))
        pushToast('NFC unavailable on this device. Use QR scan instead.', 'info')
        return
      }

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
    if (!isAuthenticated) {
      if (authMode === 'signup') {
        return (
          <Signup
            onSubmit={handleSignup}
            onSwitchToLogin={() => setAuthMode('login')}
            isLoading={authBusy}
          />
        )
      }

      return (
        <Login
          onSubmit={handleLogin}
          onSwitchToSignup={() => setAuthMode('signup')}
          isLoading={authBusy}
        />
      )
    }

    if (activeTab === 'profile') {
      return (
        <Profile
          profile={profile}
          onChange={handleProfileChange}
          onSave={saveProfile}
          user={accountMeta}
          onLogout={handleLogout}
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
          supported={requestNfcSupported}
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
          supported={sendMoneyNfcSupported}
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
      {isAuthenticated && <BottomNav activeTab={activeTab} onChange={handleNavChange} />}
      <ToastStack toasts={toasts} />
      {error && <p className="sr-only">{error}</p>}
    </div>
  )
}

export default App
