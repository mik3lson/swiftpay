import { useState } from 'react'

function Login({ onSubmit, onSwitchToSignup, isLoading = false, fieldErrors = {} }) {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(formData)
  }

  return (
    <section className="page auth-page">
      <header className="glass-card reveal auth-header">
        <p className="eyebrow">Welcome back</p>
        <h1>Login to Swift Pay</h1>
        <p className="muted">Use your username or email to continue.</p>
      </header>

      <form className="glass-card auth-form reveal delay-1" onSubmit={handleSubmit}>
        <label>
          Username or Email
          <input
            type="text"
            name="identifier"
            value={formData.identifier}
            onChange={handleChange}
            placeholder="swiftqueen or name@email.com"
            autoComplete="username"
            required
          />
        </label>
        {fieldErrors.identifier && <p className="field-error">{fieldErrors.identifier}</p>}

        <label>
          Password
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>
        {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
        {fieldErrors.non_field_errors && <p className="field-error">{fieldErrors.non_field_errors}</p>}

        <button type="submit" className="action-btn action-primary auth-submit" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Login'}
        </button>

        <p className="auth-switch-text">
          New to Swift Pay?
          {' '}
          <button type="button" className="auth-switch-btn" onClick={onSwitchToSignup}>
            Create an account
          </button>
        </p>
      </form>
    </section>
  )
}

export default Login
