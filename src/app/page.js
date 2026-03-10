import { LocalesTable } from "@/components/LocalesTable"
import { getAllData } from "@/lib/fs-utils"

// Force dynamic since we're reading from the filesystem which might change
export const dynamic = 'force-dynamic'

export default async function Home() {
  const initialData = await getAllData()

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-muted/20">
      <div className="z-10 w-full max-w-4xl items-center justify-between text-sm">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold tracking-tight">tolka</h1>
        </div>
        <LocalesTable initialData={initialData} />
      </div>
    </main>
  )
}
