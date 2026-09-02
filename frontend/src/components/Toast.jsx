import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import './Toast.css'

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null

  return (
    <div className={`toast-container toast-${type}`}>
      <div className="toast-icon">
        {type === 'success' && <CheckCircle2 size={18} />}
        {type === 'error' && <AlertCircle size={18} />}
        {type === 'info' && <Info size={18} />}
      </div>
      <div className="toast-message">{message}</div>
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
