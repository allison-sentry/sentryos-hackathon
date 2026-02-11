'use client'

import { Folder, FileText, MessageCircle, Mail } from 'lucide-react'
import { useState, useRef } from 'react'

export interface FolderItem {
  id: string
  name: string
  type: 'folder' | 'file' | 'app'
  icon?: 'folder' | 'document' | 'chat' | 'mail'
  onOpen?: () => void
}

interface FolderViewProps {
  items: FolderItem[]
  folderName: string
}

const iconComponents = {
  folder: Folder,
  document: FileText,
  chat: MessageCircle,
  mail: Mail,
}

export function FolderView({ items, folderName }: FolderViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const clickCountRef = useRef(0)
  const lastClickedIdRef = useRef<string | null>(null)

  const handleItemClick = (e: React.MouseEvent, item: FolderItem) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Reset if clicking a different item
    if (lastClickedIdRef.current !== item.id) {
      clickCountRef.current = 0
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
    lastClickedIdRef.current = item.id
    
    clickCountRef.current += 1
    
    if (clickCountRef.current === 1) {
      // First click - wait to see if there's a second click
      clickTimeoutRef.current = setTimeout(() => {
        // Single click - just select
        if (clickCountRef.current === 1) {
          setSelectedId(item.id)
        }
        clickCountRef.current = 0
      }, 250)
    } else if (clickCountRef.current === 2) {
      // Double click detected
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
      clickCountRef.current = 0
      setSelectedId(item.id)
      item.onOpen?.()
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1a2a]">
      {/* Menu bar */}
      <div className="flex items-center gap-4 px-2 py-1 border-b border-[#362552] bg-[#2a2438] text-xs text-[#9086a3]">
        <span className="hover:text-[#e8e4f0] cursor-pointer">File</span>
        <span className="hover:text-[#e8e4f0] cursor-pointer">Edit</span>
        <span className="hover:text-[#e8e4f0] cursor-pointer">View</span>
        <span className="hover:text-[#e8e4f0] cursor-pointer">Help</span>
      </div>

      {/* Path bar */}
      <div className="px-3 py-1.5 border-b border-[#362552] bg-[#2a2438]/30 text-xs text-[#9086a3] flex items-center gap-1">
        <Folder className="w-3.5 h-3.5" />
        <span>/home/sentry/{folderName}</span>
      </div>

      {/* Content area - grid of items */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => {
            const IconComponent = iconComponents[item.icon || 'folder']
            const isSelected = selectedId === item.id

            return (
              <div
                key={item.id}
                onClick={(e) => handleItemClick(e, item)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded cursor-default select-none transition-colors ${
                  isSelected
                    ? 'bg-[#7553ff]/20 ring-1 ring-[#7553ff]/50'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className={`p-3 rounded transition-colors ${
                  isSelected ? 'bg-[#7553ff]/30' : 'bg-[#2a2438]/50'
                }`}>
                  <IconComponent className="w-10 h-10 text-[#7553ff]" />
                </div>
                <span className="text-xs text-center text-[#e8e4f0]/80 break-words w-full leading-tight">
                  {item.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#362552] bg-[#2a2438] text-xs text-[#9086a3]">
        <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <span>SentryOS File Manager</span>
      </div>
    </div>
  )
}
