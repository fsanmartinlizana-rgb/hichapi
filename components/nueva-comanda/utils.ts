import type { Destination, MenuItemOption, OrderLine, TableOption } from './types'

export function calculateTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
}

export function filterByName(items: MenuItemOption[], query: string): MenuItemOption[] {
  const q = query.toLowerCase()
  return items.filter(item => item.name.toLowerCase().includes(q))
}

export function groupByCategory(items: MenuItemOption[]): Record<string, MenuItemOption[]> {
  return items.reduce<Record<string, MenuItemOption[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})
}

export function groupByZone(tables: TableOption[]): Record<string, TableOption[]> {
  return tables.reduce<Record<string, TableOption[]>>((acc, table) => {
    const key = table.zone ?? ''
    if (!acc[key]) acc[key] = []
    acc[key].push(table)
    return acc
  }, {})
}

export function getDefaultDestination(item: MenuItemOption): 'cocina' | 'barra' | 'ninguno' {
  return (item.destination as 'cocina' | 'barra' | 'ninguno') ?? 'cocina'
}

export function groupByDestination(lines: OrderLine[]): Record<Destination, OrderLine[]> {
  return lines.reduce<Record<Destination, OrderLine[]>>(
    (acc, line) => {
      const dest = line.destination
      if (!acc[dest]) acc[dest] = []
      acc[dest].push(line)
      return acc
    },
    {} as Record<Destination, OrderLine[]>
  )
}
