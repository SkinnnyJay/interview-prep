export default function Home(): JSX.Element {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>NextJS Backend Example</h1>
      <p>This is a backend-focused Next.js application demonstrating:</p>
      <ul>
        <li>API Routes with CRUD operations</li>
        <li>Dependency Injection</li>
        <li>Database integration with Prisma</li>
        <li>Authentication and Authorization</li>
      </ul>
      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>GET /api/users</code> - List users</li>
        <li><code>POST /api/users</code> - Create user</li>
      </ul>
    </main>
  )
}

