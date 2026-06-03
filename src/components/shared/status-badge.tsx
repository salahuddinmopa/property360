import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  occupied: { label: 'Occupied', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  vacant: { label: 'Vacant', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  partial: { label: 'Partial', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  unpaid: { label: 'Unpaid', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  overdue: { label: 'Overdue', className: 'bg-red-200 text-red-800 hover:bg-red-200' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  terminated: { label: 'Terminated', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  available: { label: 'Available', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  rented: { label: 'Rented', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  maintenance: { label: 'Maintenance', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  completed: { label: 'Completed', className: 'bg-teal-100 text-teal-700 hover:bg-teal-100' },
  terminated_staff: { label: 'Terminated', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' }
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  )
}
