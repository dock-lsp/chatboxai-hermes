import { IconBrain } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { HermesSettingsTab } from '@/components/hermes'

export const Route = createFileRoute('/settings/hermes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <HermesSettingsTab />
}
