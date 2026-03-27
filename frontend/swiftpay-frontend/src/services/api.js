const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'

const stripTrailingSlash = (value) => value.replace(/\/$/, '')

const unique = (items) => [...new Set(items.filter(Boolean))]

const getBaseCandidates = () => {
  const envUrl = import.meta.env.VITE_API_URL
  const localUrl = typeof window !== 'undefined' ? window.localStorage.getItem('swiftpay_api_base_url') : null

  return unique([
    envUrl ? stripTrailingSlash(envUrl) : null,
    localUrl ? stripTrailingSlash(localUrl) : null,
    DEFAULT_BASE_URL,
  ])
}

const buildEndpointCandidates = (baseUrl, path) => {
  const cleanBase = stripTrailingSlash(baseUrl)
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  const direct = `${cleanBase}${cleanPath}`
  const apiPrefixed = cleanPath.startsWith('/api/')
    ? direct
    : `${cleanBase}/api${cleanPath}`

  return unique([direct, apiPrefixed])
}

const extractFieldErrors = (responseData) => {
  const errors = {}
  
  if (!responseData || typeof responseData !== 'object') {
    return errors
  }

  // Handle Django REST Framework field validation errors
  // e.g., { "email": ["This email is already registered."], "username": [...] }
  Object.keys(responseData).forEach((key) => {
    const value = responseData[key]
    
    // Skip non-error fields but keep non_field_errors for display
    if (key === 'message' || key === 'detail') {
      return
    }
    
    // If it's an array (DRF format), join messages
    if (Array.isArray(value)) {
      errors[key] = value.join('; ')
    }
    // If it's a string, use it directly
    else if (typeof value === 'string') {
      errors[key] = value
    }
  })

  return errors
}

const toApiError = (message, status = null, url = null, fieldErrors = null) => {
  const error = new Error(message)
  error.status = status
  error.url = url
  error.fieldErrors = fieldErrors || {}
  return error
}

const shouldTryNextCandidate = (error) => {
  const text = String(error?.message || '').toLowerCase()
  const isNetworkError = text.includes('failed to fetch') || text.includes('networkerror')
  const isNotFound = error?.status === 404

  return isNetworkError || isNotFound
}

const apiCall = async (url, method = 'GET', data = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (url.includes('ngrok-free.app')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }

  const options = {
    method,
    headers,
  }

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data)
  }

  let response
  try {
    response = await fetch(url, options)
  } catch {
    throw toApiError('Failed to fetch. Check API base URL or backend availability.', null, url)
  }

  const rawText = await response.text()
  let responseData = {}

  try {
    responseData = rawText ? JSON.parse(rawText) : {}
  } catch {
    responseData = { message: rawText || 'Unexpected response from server' }
  }

  if (!response.ok) {
    const fieldErrors = extractFieldErrors(responseData)
    const errorMessage = responseData.message || responseData.detail || 'API request failed'
    throw toApiError(errorMessage, response.status, url, fieldErrors)
  }

  return responseData
}

const requestWithFallback = async (path, method = 'GET', data = null, token = null) => {
  const baseCandidates = getBaseCandidates()
  const endpointCandidates = unique(
    baseCandidates.flatMap((base) => buildEndpointCandidates(base, path)),
  )

  let lastError = null

  for (const endpoint of endpointCandidates) {
    try {
      return await apiCall(endpoint, method, data, token)
    } catch (error) {
      lastError = error
      if (!shouldTryNextCandidate(error)) {
        throw error
      }
    }
  }

  throw lastError || toApiError('API request failed')
}

export const signup = (userData) => requestWithFallback('/signup/', 'POST', {
  name: userData.fullName,
  email: userData.email,
  username: userData.username,
  password: userData.password,
  confirm_password: userData.confirmPassword,
})

export const login = (credentials) =>
  requestWithFallback('/login/', 'POST', credentials)

export const getUsers = (token) =>
  requestWithFallback('/users/', 'GET', null, token)

export const enterBankDetails = (bankData, userId, token) =>
  requestWithFallback('/enterbankdetails/', 'POST', { ...bankData, user: userId }, token)

export const getBankDetails = (userId, token) =>
  requestWithFallback(`/getbankdetails/${userId}/`, 'GET', null, token)

export const getTransactions = (userId, token) =>
  requestWithFallback(`/gettransactions/${userId}/`, 'GET', null, token)

export const setApiBaseUrl = (url) => {
  const newBase = stripTrailingSlash(url)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('swiftpay_api_base_url', newBase)
  }
}

export default {
  signup,
  login,
  getUsers,
  enterBankDetails,
  getBankDetails,
  getTransactions,
  setApiBaseUrl,
}
