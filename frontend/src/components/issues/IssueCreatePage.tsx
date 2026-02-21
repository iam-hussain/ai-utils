import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { PageContent } from '@/components/layout/PageContent'
import { socket } from '@/lib/socket'
import { IssueCreateForm } from './IssueCreateForm'
import { ArrowLeft } from 'lucide-react'

const ISSUES_PATH = '/issues'

interface IssueCreatePageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function IssueCreatePage({ currentView, onNavigate }: IssueCreatePageProps) {
  const navigate = useNavigate()
  const [isConnected, setIsConnected] = useState(socket.connected)

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }
    function onDisconnect() {
      setIsConnected(false)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (!socket.connected) socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      title="New Issue / Bug Report"
      headerActions={
        <Button variant="ghost" size="sm" onClick={() => navigate(ISSUES_PATH)} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      }
    >
      <div className="flex flex-col h-full overflow-hidden">
        <PageContent maxWidth="2xl">
          <IssueCreateForm
            onSuccess={() => navigate(ISSUES_PATH)}
            onCancel={() => navigate(ISSUES_PATH)}
          />
        </PageContent>
      </div>
    </AppLayout>
  )
}
