import { ClerkProvider } from '@clerk/nextjs'
import './globals.css' // Keep your existing styles

export const metadata = {
  title: 'cθsched',
  description: 'AI-Powered Recruitment',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}