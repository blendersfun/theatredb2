import { useState, useEffect } from 'react'

function parseHash() {
  const result = {}
  const str = window.location.hash
  const params = new URLSearchParams(str.slice(1))
  for (const [key, val] of params.entries()) {
    result[key] = val
  }
  return result
}

export function navigateToHash(newHash) {
  const newHashStr = Object.keys(newHash)
    .map(key => `${key}=${newHash[key]}`)
    .join('&')
  window.location.hash = newHashStr
}

export function useHash() {
  const [hash, updateHash] = useState(parseHash())
  useEffect(() => {
    const listener = () => updateHash(parseHash())
    window.addEventListener('hashchange', listener)
    return () => {
      window.removeEventListener('hashchange', listener)
    }
  }, [hash])
  return hash
}
