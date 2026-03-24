import { useCallback, useMemo, useState } from 'react'

const textDecoder = new TextDecoder()

function getReader() {
  if (typeof window === 'undefined' || !('NDEFReader' in window)) {
    return null
  }

  return new window.NDEFReader()
}

function parseTextRecord(record) {
  if (!record.data) {
    return ''
  }

  return textDecoder.decode(record.data)
}

export function useNFC() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [receivedDetails, setReceivedDetails] = useState(null)

  const supported = useMemo(
    () => typeof window !== 'undefined' && 'NDEFReader' in window,
    [],
  )

  const shareBankDetails = useCallback(async (bankDetails) => {
    const reader = getReader()

    if (!reader) {
      const message = 'Web NFC is not supported on this device'
      setError(message)
      setStatus('error')
      throw new Error(message)
    }

    setError('')
    setStatus('writing')

    try {
      const payload = JSON.stringify(bankDetails)
      await reader.write({
        records: [
          {
            recordType: 'text',
            data: payload,
          },
        ],
      })

      setStatus('written')
      return true
    } catch (writeError) {
      const message = writeError?.message || 'Unable to write bank details to NFC'
      setError(message)
      setStatus('error')
      throw writeError
    }
  }, [])

  const receiveBankDetails = useCallback(async () => {
    const reader = getReader()

    if (!reader) {
      const message = 'Web NFC is not supported on this device'
      setError(message)
      setStatus('error')
      throw new Error(message)
    }

    setError('')
    setStatus('scanning')

    try {
      await reader.scan()

      return await new Promise((resolve, reject) => {
        const handleReading = ({ message }) => {
          try {
            for (const record of message.records) {
              if (record.recordType !== 'text') {
                continue
              }

              const rawText = parseTextRecord(record)
              const parsed = JSON.parse(rawText)
              setReceivedDetails(parsed)
              setStatus('received')
              resolve(parsed)
              return
            }

            throw new Error('No compatible NFC text record was found')
          } catch (parseError) {
            setError(parseError.message || 'Unable to parse NFC payload')
            setStatus('error')
            reject(parseError)
          }
        }

        const handleReadingError = () => {
          const scanError = new Error('Unable to read from NFC tag')
          setError(scanError.message)
          setStatus('error')
          reject(scanError)
        }

        reader.onreading = handleReading
        reader.onreadingerror = handleReadingError
      })
    } catch (scanError) {
      if (scanError?.message) {
        setError(scanError.message)
      } else {
        setError('Unable to start NFC scan')
      }
      setStatus('error')
      throw scanError
    }
  }, [])

  return {
    supported,
    status,
    error,
    receivedDetails,
    shareBankDetails,
    receiveBankDetails,
  }
}
