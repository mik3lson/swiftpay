import { useEffect, useState } from 'react'
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
import * as api from './services/api'

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [signupFieldErrors, setSignupFieldErrors] = useState({})
  const [loginFieldErrors, setLoginFieldErrors] = useState({})
  const [_authToken, setAuthToken] = useState(() => {
    try {
      return window.localStorage.getItem('swiftpay_token') || null
    } catch {
      return null
    }
  })
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return window.localStorage.getItem('swiftpay_session') === 'active'
    } catch {
      return false
    }
  })
  const [activeTab, setActiveTab] = useState('home')
  const [toasts, setToasts] = useState([])
  const [users, setUsers] = useState([])
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
      bankName: '',
      accountNumber: '',
      accountName: '',
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

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([])
      return
    }

    const token = window.localStorage.getItem('swiftpay_token') || _authToken
    api
      .getUsers(token)
      .then((response) => {
        if (Array.isArray(response)) {
          setUsers(response)
          return
        }

        if (Array.isArray(response.data)) {
          setUsers(response.data)
          return
        }

        setUsers([])
      })
      .catch(() => {
        setUsers([])
      })
  }, [isAuthenticated, _authToken])

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
    setSignupFieldErrors({})

    api
      .signup(formData)
      .then((response) => {
        const resolvedUserId = String(response.user_id || response.user?.id || `SP-${Date.now().toString().slice(-5)}`)
        const resolvedUsername = response.username || response.user?.username || username
        const resolvedFullName = response.name || response.user?.name || fullName
        const resolvedEmail = response.email || response.user?.email || email

        const nextUser = {
          id: resolvedUserId,
          username: resolvedUsername,
          fullName: resolvedFullName,
          email: resolvedEmail,
        }

        const token = response.token || response.access_token
        if (token) {
          setAuthToken(token)
          try {
            window.localStorage.setItem('swiftpay_token', token)
          } catch {
            // Token stored in memory if localStorage unavailable
          }
        }

        try {
          window.localStorage.setItem('swiftpay_auth_user', JSON.stringify(nextUser))
          window.localStorage.setItem('swiftpay_session', 'active')
        } catch {
          // Session created in memory if localStorage unavailable
        }

        setUser({ id: nextUser.id, username: nextUser.username })
        setAccountMeta(nextUser)
        setIsAuthenticated(true)
        setAuthBusy(false)
        setSignupFieldErrors({})
        setActiveTab('home')
        setProfile((current) => ({
          ...current,
          accountName: current.accountName || fullName,
        }))
        pushToast('Account created successfully', 'success')
      })
      .catch((error) => {
        setAuthBusy(false)
        setSignupFieldErrors(error.fieldErrors || {})
        const fieldErrorMessages = Object.values(error.fieldErrors || {})
        const generalMessage = fieldErrorMessages.length > 0
          ? fieldErrorMessages[0]
          : error.message || 'Signup failed. Please try again.'
        pushToast(generalMessage, 'error')
      })
  }

  const handleLogin = (formData) => {
    const identifier = formData.identifier.trim().toLowerCase()
    const password = formData.password

    if (!identifier || !password) {
      pushToast('Please enter your login details', 'error')
      return
    }

    setAuthBusy(true)
    setLoginFieldErrors({})

    api
      .login({ identifier, password })
      .then((response) => {
        const resolvedUserId = String(response.user_id || response.user?.id || 'SP-34091')
        const resolvedUsername = response.username || response.user?.username || 'swiftqueen'
        const resolvedFullName = response.name || response.user?.name || ''
        const resolvedEmail = response.email || response.user?.email || ''

        const nextUser = {
          id: resolvedUserId,
          username: resolvedUsername,
          fullName: resolvedFullName,
          email: resolvedEmail,
        }

        const token = response.token || response.access_token
        if (token) {
          setAuthToken(token)
          try {
            window.localStorage.setItem('swiftpay_token', token)
          } catch {
            // Token stored in memory if localStorage unavailable
          }
        }

        try {
          window.localStorage.setItem('swiftpay_auth_user', JSON.stringify(nextUser))
          window.localStorage.setItem('swiftpay_session', 'active')
        } catch {
          // Session created in memory if localStorage unavailable
        }

        setUser({ id: nextUser.id, username: nextUser.username })
        setAccountMeta(nextUser)
        setIsAuthenticated(true)
        setAuthBusy(false)
        setLoginFieldErrors({})
        setActiveTab('home')
        pushToast('Welcome back', 'success')
      })
      .catch((error) => {
        setAuthBusy(false)
        setLoginFieldErrors(error.fieldErrors || {})
        const fieldErrorMessages = Object.values(error.fieldErrors || {})
        const generalMessage = fieldErrorMessages.length > 0
          ? fieldErrorMessages[0]
          : error.message || 'Login failed. Please try again.'
        pushToast(generalMessage, 'error')
      })
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthToken(null)
    setAuthMode('login')
    setActiveTab('home')
    closeRequestPage()
    closeSendMoneyPage()

    try {
      window.localStorage.removeItem('swiftpay_session')
      window.localStorage.removeItem('swiftpay_token')
      window.localStorage.removeItem('swiftpay_auth_user')
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

  const hydrateProfile = (nextProfile) => {
    setProfile((current) => ({
      ...current,
      ...nextProfile,
    }))
  }

  const saveProfile = () => {
    window.localStorage.setItem('swiftpay_profile', JSON.stringify(profile))
    pushToast('Details saved', 'success')
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
            fieldErrors={signupFieldErrors}
          />
        )
      }

      return (
        <Login
          onSubmit={handleLogin}
          onSwitchToSignup={() => setAuthMode('signup')}
          isLoading={authBusy}
          fieldErrors={loginFieldErrors}
        />
      )
    }

    if (activeTab === 'profile') {
      return (
        <Profile
          profile={profile}
          onChange={handleProfileChange}
          onSave={saveProfile}
          onHydrateProfile={hydrateProfile}
          user={accountMeta}
          onLogout={handleLogout}
        />
      )
    }

    if (activeTab === 'search' || activeTab === 'cards') {
      return (
        <section className="page placeholder-page">
          <div className="glass-card reveal">
            {activeTab === 'search' && (
              <>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
                <p className="eyebrow">Coming soon</p>
                <h1>Swift Monie</h1>
                <p className="muted">
                  Flexible payment plans and installments are coming soon.
                </p>
              </>
            )}
            {activeTab === 'cards' && (
              <>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
                <p className="eyebrow">Coming soon</p>
                <h1>NFC Instant Pay Cards</h1>
                <p className="muted">
                  Tap-enabled payment cards for seamless shopping experiences. Coming soon.
                </p>
              </>
            )}
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
        usersCount={users.length}
        onOpenRequest={openRequestPage}
        onOpenSendMoney={openSendMoneyPage}
        onNavigateToProfile={() => setActiveTab('profile')}
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
