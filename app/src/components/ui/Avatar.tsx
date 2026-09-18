import { useState } from 'react'
import { UserCircle } from 'lucide-react'

const BRAND_COLOR = '#2ce0a7'

interface AvatarProps {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: number
  className?: string
  fallback?: 'initials' | 'icon' | 'auto'
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return ''
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function Avatar({
  src,
  name,
  email,
  size = 36,
  className = '',
  fallback = 'initials',
}: AvatarProps) {
  const initials = getInitials(name, email)
  const fontSize = Math.round(size * 0.35)
  const iconSize = Math.round(size * 0.5)
  const hasValidSrc = isValidImageUrl(src || '')
  const [showImage, setShowImage] = useState(hasValidSrc)

  const handleError = () => setShowImage(false)

  return (
    <div className={`relative flex-shrink-0 overflow-hidden rounded-full ${className}`} style={{ width: size, height: size }}>
      {showImage && hasValidSrc ? (
        <img
          src={src as string}
          alt={name || email || 'Avatar'}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : null}
      <div
        className="flex items-center justify-center w-full h-full"
        style={{
          backgroundColor: (!showImage || !hasValidSrc) ? BRAND_COLOR : 'transparent',
          fontSize,
          color: '#fff',
          fontWeight: 600,
          display: (!showImage || !hasValidSrc) ? 'flex' : 'none',
        }}
      >
        {fallback === 'initials' && initials ? (
          <span>{initials}</span>
        ) : fallback === 'icon' ? (
          <UserCircle size={iconSize} strokeWidth={1.5} />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <UserCircle size={iconSize} strokeWidth={1.5} />
        )}
      </div>
    </div>
  )
}