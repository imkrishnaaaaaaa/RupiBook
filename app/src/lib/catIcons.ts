import {
  Banknote, Car, Clapperboard, HeartPulse, ReceiptText,
  ShoppingBag, ShoppingCart, UtensilsCrossed, Wallet, type LucideIcon,
} from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  Food: UtensilsCrossed,
  Transport: Car,
  Shopping: ShoppingBag,
  Bills: ReceiptText,
  Health: HeartPulse,
  Entertainment: Clapperboard,
  Groceries: ShoppingCart,
  Others: Wallet,
}

export function catIcon(name: string): LucideIcon {
  return MAP[name] ?? Banknote
}
