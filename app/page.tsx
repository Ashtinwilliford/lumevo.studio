export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          AutoInfluence AI
        </p>
        <h1 className="max-w-4xl text-5xl font-bold leading-tight sm:text-6xl">
          Turn raw content into branded short-form videos that feel like you.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-600">
          Upload your videos or images, describe what the content is about, and let AI
          generate polished, on-brand videos with voice, captions, and titles.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button className="rounded-full bg-black px-6 py-3 text-white transition hover:opacity-90">
            Start Creating
          </button>
          <button className="rounded-full border border-gray-300 px-6 py-3 text-gray-900 transition hover:bg-gray-50">
            See Demo
          </button>
        </div>
      </section>
    </main>
  );
}