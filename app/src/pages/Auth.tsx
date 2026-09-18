import { motion } from 'framer-motion'
import { LogIn } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export default function Auth() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center"
      >
        <img
          src="/icons/icon.svg"
          alt="RupiBook"
          className="mb-5 h-20 w-20 rounded-3xl shadow-[var(--shadow-float)]"
        />

        <h1 className="font-display text-3xl font-bold tracking-tight text-text-1">RupiBook</h1>
        <p className="mt-2 max-w-[26ch] text-sm leading-relaxed text-text-2">
          Every rupee, logged in seconds. Private to your account, synced everywhere.
        </p>

        <Button onClick={() => void signInWithGoogle()} className="mt-8 w-full py-3.5" loading={false}>
          <LogIn size={17} />
          Continue with Google
        </Button>

        <p className="mt-6 text-[11px] leading-relaxed text-text-3">
          Your data is protected by row level security. Only you can ever read or write your books.
        </p>
      </motion.div>
    </div>
  )
}
