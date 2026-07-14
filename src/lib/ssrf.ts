import dns from 'dns'
import { promisify } from 'util'

const dnsLookup = promisify(dns.lookup)

export function isIpBlocked(ip: string): boolean {
  // IPv4 check
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) {
      return true // Invalid IP format: block it
    }
    const [a, b, c, d] = parts
    
    // 127.0.0.0/8
    if (a === 127) return true
    // 10.0.0.0/8
    if (a === 10) return true
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 169.254.0.0/16
    if (a === 169 && b === 254) return true

    return false
  }

  // IPv6 check
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase()
    
    // ::1 loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
      return true
    }

    // fc00::/7 (unique local address starts with fc or fd)
    const firstBlock = normalized.split(':')[0] || ''
    if (firstBlock) {
      const val = parseInt(firstBlock, 16)
      if (!isNaN(val)) {
        if ((val >> 9) === 126) {
          return true
        }
      }
    }

    return false
  }

  return true // Neither IPv4 nor IPv6: block it
}

export async function isUrlSafe(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }

    const hostname = url.hostname.toLowerCase()

    // Explicitly block standard localhost/metadata hostnames
    const FORBIDDEN_HOSTNAMES = new Set([
      'localhost',
      'metadata',
      'metadata.google.internal',
      'instance-data',
    ])
    if (FORBIDDEN_HOSTNAMES.has(hostname)) {
      return false
    }

    // Direct check if hostname is already a raw IP
    if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
      if (isIpBlocked(hostname)) {
        return false
      }
    }

    // DNS lookup
    const addresses = await dnsLookup(url.hostname, { all: true })
    for (const addr of addresses) {
      if (isIpBlocked(addr.address)) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

export async function safeFetch(
  initialUrl: string,
  options: {
    timeoutMs?: number
    maxBytes?: number
    userAgent?: string
  } = {}
): Promise<{ text: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 10000
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024 // 5MB
  const userAgent = options.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  let currentUrl = initialUrl
  let redirects = 0
  const maxRedirects = 10

  while (redirects < maxRedirects) {
    // 1. Verify URL is safe (blocks SSRF)
    const safe = await isUrlSafe(currentUrl)
    if (!safe) {
      throw new Error(`SSRF Blocked: URL points to unsafe or internal destination.`)
    }

    // 2. Setup timeout controller
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
        signal: controller.signal,
      })

      clearTimeout(timer)

      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location) {
          throw new Error(`Redirect status ${response.status} returned no location header.`)
        }
        
        // Resolve location relative to currentUrl
        const resolvedUrl = new URL(location, currentUrl).toString()
        
        const parsed = new URL(resolvedUrl)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error(`Invalid redirect protocol: ${parsed.protocol}`)
        }

        currentUrl = resolvedUrl
        redirects++
        continue
      }

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`)
      }

      // Check Content-Type is HTML-like
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error(`Invalid response Content-Type: ${contentType}. Only HTML responses are allowed.`)
      }

      // Read response body with size limit
      const contentLengthStr = response.headers.get('content-length')
      if (contentLengthStr) {
        const contentLength = parseInt(contentLengthStr, 10)
        if (!isNaN(contentLength) && contentLength > maxBytes) {
          throw new Error(`Response size exceeds limit of ${maxBytes} bytes.`)
        }
      }

      if (!response.body) {
        throw new Error('Response body is empty.')
      }

      // Read stream chunks manually to enforce maxBytes
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          totalBytes += value.length
          if (totalBytes > maxBytes) {
            await reader.cancel()
            throw new Error(`Response size limit of ${maxBytes} bytes exceeded during download.`)
          }
          chunks.push(value)
        }
      }

      const concatenated = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        concatenated.set(chunk, offset)
        offset += chunk.length
      }

      const text = new TextDecoder('utf-8').decode(concatenated)
      return { text, finalUrl: currentUrl }

    } catch (err: any) {
      clearTimeout(timer)
      throw err
    }
  }

  throw new Error(`Too many redirects (limit: ${maxRedirects})`)
}
