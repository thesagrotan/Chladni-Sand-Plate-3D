interface AboutProps {
  dotColor: string;
}

export function About({ dotColor }: AboutProps) {
  return (
    <section className="min-h-[70vh] px-2 sm:px-14 md:px-40 py-16 sm:py-20  mx-auto flex flex-col justify-center text-left">
      <div
        data-text-repulsor
        className="text-3xl font-sans font-normal mb-4 tracking-wide text-left"
      >
        About
      </div>

      <h2
        data-text-repulsor
        className="text-3xl font-serif font-normal leading-tight text-left"
        style={{ color: dotColor }}
      >
        Acoustic research atelier, independent label, and recording studio
      </h2>

      <p
        data-text-repulsor
        className="mt-6 text-3xl font-serif leading-tight font-light text-left"
        style={{ color: dotColor, opacity: 0.88 }}
      >
        Founded in Berlin-Kreuzberg, Tezett – Platte is an independent label and recording studio.
        Musicians, sound artists, and composers come to record, perform, and develop work here.
        The space supports a wide range of practices — from electroacoustic and improvised music
        to contemporary composition and experimental sound — and is available for sessions,
        residencies, and label releases.
      </p>
    </section>
  );
}
