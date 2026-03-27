import { useEffect, useState } from 'react'
import * as api from '../services/api'

function Profile({ profile, onChange, onSave, onHydrateProfile, user, onLogout }) {
  const [isSaving, setIsSaving] = useState(false)
  const [_bankDetailsFromApi, setBankDetailsFromApi] = useState(null)

  useEffect(() => {
    // Fetch bank details from backend when component mounts
    if (user?.id) {
      const token = window.localStorage.getItem('swiftpay_token')
      api
        .getBankDetails(user.id, token)
        .then((response) => {
          const records = Array.isArray(response) ? response : response.data
          if (Array.isArray(records) && records.length > 0) {
            const latest = records[records.length - 1]
            setBankDetailsFromApi(latest)
            onHydrateProfile({
              bankName: latest.bank_name || '',
              accountNumber: latest.account_number || '',
              accountName: latest.account_name || '',
            })
          }
        })
        .catch(() => {
          // Details not yet stored, which is fine
        })
    }
  }, [onHydrateProfile, user?.id])

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      const token = window.localStorage.getItem('swiftpay_token')

      const bankData = {
        bank_name: profile.bankName,
        account_number: profile.accountNumber,
        account_name: profile.accountName,
        card_number: profile.cardNumber,
        expiry_date: profile.expiryDate,
        cvv: profile.cvv,
      }

      // Try to save to backend
      if (token && user?.id) {
        try {
          await api.enterBankDetails(bankData, user.id, token)
        } catch (apiError) {
          console.error('Failed to save to backend:', apiError)
          // Continue to save locally even if API fails
        }
      }

      // Always save locally as fallback
      window.localStorage.setItem('swiftpay_profile', JSON.stringify(profile))
      onSave()
      setIsSaving(false)
    } catch (error) {
      setIsSaving(false)
      console.error('Error saving profile:', error)
      // Still call onSave to show that we attempted to save
      onSave()
    }
  }

  return (
    <section className="page profile-page">
      <header className="glass-card reveal">
        <p className="eyebrow">Profile</p>
        <h1>Bank & Sender Details</h1>
        <p className="muted">Saved to your account</p>
        {user?.username && (
          <p className="muted profile-account-line">
            Signed in as <strong>@{user.username}</strong>
          </p>
        )}
      </header>

      <form
        className="profile-form glass-card reveal delay-1"
        onSubmit={(event) => {
          event.preventDefault()
          handleSaveProfile()
        }}
      >
        <h3>Bank Details</h3>

        <label>
          Bank Name
          <input
            name="bankName"
            value={profile.bankName}
            onChange={onChange}
            placeholder="e.g. Swift Bank"
          />
        </label>

        <label>
          Account Number
          <input
            name="accountNumber"
            value={profile.accountNumber}
            onChange={onChange}
            placeholder="0123456789"
          />
        </label>

        <label>
          Account Holder Name
          <input
            name="accountName"
            value={profile.accountName}
            onChange={onChange}
            placeholder="Full name"
          />
        </label>

        <h3>Sender Info</h3>

        <label>
          Credit Card Number
          <input
            name="cardNumber"
            value={profile.cardNumber}
            onChange={onChange}
            placeholder="1234 5678 9012 3456"
          />
        </label>

        <div className="split-row">
          <label>
            Expiry Date
            <input
              name="expiryDate"
              value={profile.expiryDate}
              onChange={onChange}
              placeholder="MM/YY"
            />
          </label>

          <label>
            CVV
            <input
              name="cvv"
              value={profile.cvv}
              onChange={onChange}
              placeholder="123"
            />
          </label>
        </div>

        <button type="submit" className="action-btn action-primary save-btn" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Details'}
        </button>

        <button
          type="button"
          className="action-btn action-secondary logout-btn"
          onClick={onLogout}
        >
          Logout
        </button>
      </form>
    </section>
  )
}

export default Profile
