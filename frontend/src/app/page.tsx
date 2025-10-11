import ChatInterface from './components/ChatInterface'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#AED4E6' }}>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChatInterface />
      </main>
    </div>
  )
}