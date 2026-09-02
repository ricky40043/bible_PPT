import { Copy, Trash2, Check } from 'lucide-react'
import './HighlightToolbar.css'

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#fef08a', name: '亮黃', labelColor: '#854d0e' },
  { id: 'green', hex: '#bbf7d0', name: '清新綠', labelColor: '#166534' },
  { id: 'blue', hex: '#bae6fd', name: '天空藍', labelColor: '#075985' },
  { id: 'pink', hex: '#fbcfe8', name: '櫻花粉', labelColor: '#9d174d' },
  { id: 'orange', hex: '#fed7aa', name: '暖陽橙', labelColor: '#9a3412' },
]

export default function HighlightToolbar({
  verseNum,
  currentColor,
  onSelectColor,
  onRemoveColor,
  onCopyVerse,
  onClose,
}) {
  return (
    <div className="highlight-toolbar" onClick={(e) => e.stopPropagation()}>
      <div className="toolbar-label">第 {verseNum} 節</div>

      <div className="color-palette">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            className={`color-btn ${currentColor === c.hex ? 'active' : ''}`}
            style={{ backgroundColor: c.hex }}
            title={`標註 ${c.name}`}
            onClick={() => onSelectColor(c.hex)}
          >
            {currentColor === c.hex && <Check size={12} color="#000" />}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {currentColor && (
        <button
          className="tool-btn danger"
          title="移除畫線標註"
          onClick={onRemoveColor}
        >
          <Trash2 size={15} />
        </button>
      )}

      <button
        className="tool-btn"
        title="複製此節經文"
        onClick={onCopyVerse}
      >
        <Copy size={15} />
      </button>
    </div>
  )
}
