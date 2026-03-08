import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NextJS Backend Example',
  description: 'NextJS backend application with CRUD operations and dependency injection',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

