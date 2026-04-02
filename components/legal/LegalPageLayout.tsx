import Header from '@/components/layout/Header'

interface LegalSection {
  heading: string
  body: React.ReactNode
}

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}

export default function LegalPageLayout({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="flex flex-col bg-white">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-400">{lastUpdated}</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-slate-600 leading-relaxed">{intro}</p>

          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">{section.heading}</h2>
              <div className="text-slate-600 leading-relaxed space-y-2">{section.body}</div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
