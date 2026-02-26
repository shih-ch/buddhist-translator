import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/translator': '翻譯工作區',
  '/articles': '文章管理',
  '/glossary': '術語表',
  '/settings': '設定',
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? ''

  return (
    <header className="flex h-14 items-center border-b px-6">
      <h2 className="text-lg font-semibold">{title}</h2>
    </header>
  )
}
