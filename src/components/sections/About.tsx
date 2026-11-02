interface AboutProps {
  dotColor: string;
}

export function About({ dotColor }: AboutProps) {
  return (
    <section className="px-2 sm:px-14 md:px-40 pt-8 sm:pt-12 pb-6 sm:pb-8 mx-auto text-left">
      <div data-text-repulsor className="page-text mb-4 text-left">
        About
      </div>

      <h2 data-text-repulsor className="page-text text-left" style={{ color: dotColor }}>
        Acoustic research atelier, independent label, and recording studio
      </h2>

      <p data-text-repulsor className="page-text mt-6 text-left" style={{ color: dotColor }}>
        Founded in Berlin-Kreuzberg, Tezett – Platte is an independent label and recording studio.
        Musicians, sound artists, and composers come to record, perform, and develop work here.
        The space supports a wide range of practices — from electroacoustic and improvised music
        to contemporary composition and experimental sound — and is available for sessions,
        residencies, and label releases.
      </p>
    </section>
  );
}
