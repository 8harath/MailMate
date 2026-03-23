import { Mail } from 'lucide-react'

export function Logo({ size = 'default' }: { size?: 'sm' | 'default' }) {
  const iconBox = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg'

  return (
    <div className="flex items-center gap-2">
      <div className={`${iconBox} bg-blue-600 rounded-lg flex items-center justify-center`}>
        <Mail className={`${iconSize} text-white`} />
      </div>
      <span className={`${textSize} font-bold text-gray-900`}>MailMate</span>
    </div>
  )
}
