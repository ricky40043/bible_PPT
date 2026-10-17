import { Copy, Trash2, Check, X } from 'lucide-react'
import './HighlightToolbar.css'

const HIGHLIGHT_COLORS = [
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
  selectionCount = 1,
  canRemove = Boolean(currentColor),
}) {
  const selectionLabel = selectionCount > 1 ? `已選 ${selectionCount} 節` : `第 ${verseNum} 節`

  return (
    <div className="highlight-toolbar" role="toolbar" aria-label={`${selectionLabel}操作`} onClick={(e) => e.stopPropagation()}>
      <div className="toolbar-label">{selectionLabel}</div>

      <div className="color-palette">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            type="button"
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

      {canRemove && (
        <button
          type="button"
          className="tool-btn danger"
          title="移除畫線標註"
          onClick={onRemoveColor}
        >
          <Trash2 size={15} />
        </button>
      )}

      <button
        type="button"
        className="tool-btn"
        title={selectionCount > 1 ? '複製已選經文' : '複製此節經文'}
        onClick={onCopyVerse}
      >
        <Copy size={15} />
      </button>

      <button
        type="button"
        className="tool-btn"
        title="取消選取"
        aria-label="取消選取"
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </div>
  )
}
