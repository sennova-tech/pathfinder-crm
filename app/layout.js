import './globals.css'

export const metadata = {
  title: 'PathFinder',
  description: 'Student application tracking system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}