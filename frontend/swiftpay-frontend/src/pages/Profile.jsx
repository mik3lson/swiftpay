function Profile({ profile, onChange, onSave, user, onLogout }) {
  return (
    <section className="page profile-page">
      <header className="glass-card reveal">
        <p className="eyebrow">Profile</p>
        <h1>Bank & Sender Details</h1>
        <p className="muted">Saved locally on this device</p>
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
          onSave()
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

        <button type="submit" className="action-btn action-primary save-btn">
          Save Details
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
