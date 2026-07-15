import Link from 'next/link'
import { APP_NAME } from '@/lib/config'

// Helper component to render the App Name in the branded layout
// where the last word is in the italic serif style.
function Logo() {
  const words = APP_NAME.split(' ')
  if (words.length > 1) {
    const lastWord = words[words.length - 1]
    const mainPart = words.slice(0, -1).join(' ')
    return (
      <>
        {mainPart}{' '}
        <span className="font-serif italic font-light">{lastWord}</span>
      </>
    )
  }
  return <>{APP_NAME}</>
}

function CreditLine() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
      <div className="text-center sm:text-left text-mute">
        Made by <span className="text-body-strong font-medium">Manas Parauha</span>
      </div>
      <div className="flex items-center gap-6">
        <a
          href="https://github.com/ManasParauha"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-mute hover:text-ink transition-colors"
          aria-label="GitHub profile of Manas Parauha"
        >
          {/* GitHub Icon */}
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
          </svg>
          <span>GitHub</span>
        </a>
        <a
          href="https://www.linkedin.com/in/manas-parauha-61b44031a"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-mute hover:text-ink transition-colors"
          aria-label="LinkedIn profile of Manas Parauha"
        >
          {/* LinkedIn Icon */}
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
          <span>LinkedIn</span>
        </a>
      </div>
    </div>
  )
}

interface FooterProps {
  variant: 'landing' | 'dashboard'
}

export function Footer({ variant }: FooterProps) {
  if (variant === 'landing') {
    return (
      <footer className="border-t border-hairline/60 bg-canvas">
        <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-1">
              <h4 className="text-sm font-normal text-ink tracking-tight">
                <Logo />
              </h4>
              <p className="text-xs text-mute font-mono uppercase">
                A personal project to solve read-it-later clutter. Not a company.
              </p>
            </div>
            <div>
              <Link
                href="/login"
                className="text-xs font-mono text-mute hover:text-ink transition-colors border border-hairline/60 rounded-sm px-3.5 py-1.5 bg-canvas-soft/20 hover:bg-canvas-soft/50"
              >
                SIGN IN
              </Link>
            </div>
          </div>
          <div className="border-t border-hairline/40 pt-6 text-xs text-mute font-mono">
            <CreditLine />
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-hairline pt-6 text-xs text-mute font-mono mt-auto max-w-4xl mx-auto w-full">
      <CreditLine />
    </footer>
  )
}
