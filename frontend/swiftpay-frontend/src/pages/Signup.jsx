import { useState } from 'react'

function Signup({ onSubmit, onSwitchToLogin, isLoading = false }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
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
        <p className="eyebrow">Join Swift Pay</p>
        <h1>Create your account</h1>
        <p className="muted">Set up your profile to start sending and requesting money.</p>
      </header>

      <form className="glass-card auth-form reveal delay-1" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Adaeze Nwosu"
            autoComplete="name"
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Username
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="swiftqueen"
            autoComplete="username"
            required
          />
        </label>

        <div className="split-row auth-password-row">
          <label>
            Password
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <label>
            Confirm Password
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        </div>

        <button type="submit" className="action-btn action-primary auth-submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p className="auth-switch-text">
          Already have an account?
          {' '}
          <button type="button" className="auth-switch-btn" onClick={onSwitchToLogin}>
            Login
          </button>
        </p>
      </form>
    </section>
  )
}

export default Signup
